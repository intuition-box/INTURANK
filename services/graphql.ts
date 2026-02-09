
import { GRAPHQL_URL, IS_PREDICATE_ID, DISTRUST_ATOM_ID } from '../constants';
import { Transaction, Claim } from '../types';
import { hexToString, formatEther, parseEther } from 'viem';

// Request guard to prevent parallel overlapping global claims fetches
let isGlobalClaimsFetching = false;

/**
 * WELL_KNOWN_DESCRIPTIONS: The "Gold Standard" for core protocol nodes.
 */
const WELL_KNOWN_DESCRIPTIONS: Record<string, string> = {
    '0x000000000000000000000000000000000000000000000000000000000000bc48': "The base protocol for semantic truth. Intuition allows anyone to claim, verify, and signal on any piece of information, creating a global, decentralized reputation graph for the era of AI and information overload.",
    'intuition': "The base protocol for semantic truth. Intuition allows anyone to claim, verify, and signal on any piece of information, creating a global, decentralized reputation graph for the era of AI and information overload.",
    '0x0000000000000000000000000000000000000000000000000000000000003a73': "The standard trust predicate. Used by network participants to signal directional conviction and stake capital on the reputation of another node or claim.",
    'intuitionbilly.eth': "Lead Architect and technical visionary at Intuition Systems. Architect of the semantic trust primitives and the decentralized reputation systems of the future.",
    'billy.eth': "Lead Architect and technical visionary at Intuition Systems. Billy is building the primitives for decentralized identity and semantic logic that power the global trust graph.",
    'sam.eth': "Founding member and product lead at Intuition. Focused on creating the human interface for semantic capitalism and scaling decentralized reputation to the masses.",
};

const fetchGraphQL = async (query: string, variables: any = {}, retries = 2) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); 

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: 'no-store' 
    });
    clearTimeout(timeoutId);
    const result = await response.json();
    if (result.errors) {
      console.warn("GraphQL Query Error:", result.errors);
      return { data: null };
    }
    return result.data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (retries > 0 && error.name !== 'AbortError') {
      await new Promise(r => setTimeout(r, 1000 * (3 - retries)));
      return fetchGraphQL(query, variables, retries - 1);
    }
    return { data: null };
  }
};

const normalize = (x: string) => x ? x.toLowerCase() : '';

const prepareQueryIds = (id: string) => {
    if (!id) return [];
    const base = id.trim();
    const variants = new Set<string>([base, base.toLowerCase()]);
    if (base.startsWith('0x')) {
        variants.add(base);
        if (base.length === 42) {
            const padded = '0x' + '0'.repeat(24) + base.slice(2);
            variants.add(padded);
            variants.add(padded.toLowerCase());
        }
        if (base.length === 66 && base.startsWith('0x000000000000000000000000')) {
            const unpadded = '0x' + base.slice(26);
            variants.add(unpadded);
            variants.add(unpadded.toLowerCase());
        }
    }
    return Array.from(variants);
};

const resolveMetadata = (atom: any) => {
    if (!atom) return { label: 'Unknown', description: '', type: 'ATOM' };
    let label = atom.label;
    let description = '';
    const normId = normalize(atom.term_id || '');
    const normLabel = normalize(atom.label || '');

    if (WELL_KNOWN_DESCRIPTIONS[normId]) description = WELL_KNOWN_DESCRIPTIONS[normId];
    else if (WELL_KNOWN_DESCRIPTIONS[normLabel]) description = WELL_KNOWN_DESCRIPTIONS[normLabel];

    if (atom.value) {
        const v = atom.value;
        const meta = v.person || v.thing || v.organization;
        if (meta) {
            if (!description) description = meta.description || '';
        }
    }

    if (atom.data && atom.data !== '0x' && !description) {
        try {
            const raw = atom.data.startsWith('0x') ? atom.data : `0x${atom.data}`;
            const decoded = hexToString(raw as `0x${string}`);
            const cleaned = decoded.replace(/\0/g, '').trim();
            if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
                try {
                    const parsed = JSON.parse(cleaned);
                    if (parsed.name && (!label || label.startsWith('0x'))) label = parsed.name;
                    if (!description) description = parsed.description || parsed.bio || parsed.about || '';
                } catch (e) {}
            } else { if (!label || label === '0x' || label === '0x00') label = cleaned; }
        } catch (e) {}
    }

    if (!description) {
        if (normLabel.endsWith('.eth')) description = `Verified ENS identity. Establish semantic links to quantify trust magnitude.`;
        else if (atom.type === 'ACCOUNT' || normId.startsWith('0x')) description = `Unique identity node on the trust graph. Participates in global reputation markets.`;
        else description = `Verified semantic atom within the Intuition global trust graph.`;
    }
    
    return { 
        label: (label && label !== '0x' && !label.startsWith('0x00')) ? label : `${atom.term_id?.slice(0, 8)}...`, 
        description,
        type: atom.type || 'ATOM'
    };
};

const chunkArray = (array: any[], size: number) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
};

const aggregateVaultData = (allVaults: any[]) => {
  const atomGroups = new Map<string, any>();
  allVaults.forEach(v => {
    const id = normalize(v.term_id);
    const existing = atomGroups.get(id) || { 
        total_assets: 0n, 
        total_shares: 0n, 
        computed_mcap: 0, 
        current_share_price: '0',
        has_linear: false,
        position_count: 0
    };
    
    const assets = BigInt(v.total_assets || '0');
    const shares = BigInt(v.total_shares || '0');
    const priceRaw = v.current_share_price || '0';
    const curveId = v.curve_id?.toString();
    const posCount = Number(v.position_count || 0);
    
    const sharesNum = parseFloat(formatEther(shares));
    const priceNum = parseFloat(formatEther(BigInt(priceRaw))) || (sharesNum > 0 ? parseFloat(formatEther(assets)) / sharesNum : 0.1);
    const vaultMCap = sharesNum * priceNum;

    let displayPrice = existing.current_share_price;
    let hasLinear = existing.has_linear;

    if (curveId === '1') {
      displayPrice = priceRaw;
      hasLinear = true;
    } else if (!hasLinear) {
      displayPrice = priceRaw;
    }

    atomGroups.set(id, {
      term_id: v.term_id,
      total_assets: existing.total_assets + assets,
      total_shares: existing.total_shares + shares,
      computed_mcap: existing.computed_mcap + vaultMCap,
      current_share_price: displayPrice,
      has_linear: hasLinear,
      position_count: existing.position_count + posCount
    });
  });
  return Array.from(atomGroups.values());
};

export const getAllAgents = async (limit = 40, offset = 0) => {
  const query = `query GetAgents($limit: Int!, $offset: Int!) { vaults(limit: $limit, offset: $offset, order_by: { total_assets: desc }) { term_id total_assets total_shares current_share_price curve_id position_count } }`;
  try {
    const vaultData = await fetchGraphQL(query, { limit, offset });
    const allVaults = vaultData?.vaults ?? [];
    if (allVaults.length === 0) return { items: [], hasMore: false };

    const aggregated = aggregateVaultData(allVaults);
    const termIds = aggregated.map(v => v.term_id);
    const dataQuery = `query GetAgentsData ($ids: [String!]!) {
        atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } }
        triples(where: { term_id: { _in: $ids } }) { term_id subject { label term_id image type } predicate { label } object { label term_id image type } }
    }`;

    const idChunks = chunkArray(termIds, 200);
    let allAtoms: any[] = [];
    let allTriples: any[] = [];
    for (const chunk of idChunks) {
        const chunkData = await fetchGraphQL(dataQuery, { ids: chunk });
        if (chunkData?.atoms) allAtoms = [...allAtoms, ...chunkData.atoms];
        if (chunkData?.triples) allTriples = [...allTriples, ...chunkData.triples];
    }

    const items = aggregated.map(v => {
      const a = allAtoms.find(x => normalize(x.term_id) === normalize(v.term_id));
      const t = allTriples.find(x => normalize(x.term_id) === normalize(v.term_id));
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '', type: 'ATOM' };
      let label = meta.label, type = (meta.type || "ATOM").toUpperCase(), image = a?.image;

      if (t) {
          const sMeta = resolveMetadata(t.subject), oMeta = resolveMetadata(t.object);
          label = `${sMeta.label} ${t.predicate?.label || 'LINK'} ${oMeta.label}`;
          type = "CLAIM";
          image = t.subject?.image || t.object?.image;
      }

      return {
        id: v.term_id,
        label,
        description: meta.description,
        image,
        type,
        creator: a?.creator,
        totalAssets: v.total_assets.toString(), 
        totalShares: v.total_shares.toString(),
        currentSharePrice: v.current_share_price,
        marketCap: v.computed_mcap.toString(),
        positionCount: v.position_count
      };
    });

    return { items, hasMore: allVaults.length === limit };
  } catch (e) { return { items: [], hasMore: false }; }
};

export const getAgentById = async (termId: string) => {
  const ids = prepareQueryIds(termId);
  const q = `query ($ids: [String!]!) { 
      atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } }
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      triples(where: { term_id: { _in: $ids } }) { subject { label term_id image type } predicate { label } object { label term_id image type } }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const aggregated = aggregateVaultData(res?.vaults || []);
    const v = aggregated[0], a = res?.atoms?.[0], t = res?.triples?.[0];
    if (!v && !a && !t) return { id: termId, label: 'Unknown', description: '', totalAssets: "0", totalShares: "0", type: 'ATOM' };

    const meta = a ? resolveMetadata(a) : { label: termId, description: '', type: 'ATOM' };
    let label = meta.label, type = (meta.type || "ATOM").toUpperCase();
    if (t) {
        label = `${resolveMetadata(t.subject).label} ${t.predicate?.label} ${resolveMetadata(t.object).label}`;
        type = "CLAIM";
    }

    return {
      id: termId, label, description: meta.description, image: a?.image, type, creator: a?.creator,
      totalAssets: v?.total_assets.toString() || "0",
      totalShares: v?.total_shares.toString() || "0",
      currentSharePrice: v?.current_share_price || "0",
      marketCap: v?.computed_mcap.toString() || "0",
      positionCount: v?.position_count || 0
    };
  } catch (e) { return { id: termId, label: 'Offline', totalAssets: "0", totalShares: "0", type: 'ATOM' }; }
};

export const getUserHistory = async (userAddress: string): Promise<Transaction[]> => {
  const ids = [userAddress, userAddress.toLowerCase()];
  const q = `query ($ids: [String!]!) {
      events(where: { account_id: { _in: $ids } }, order_by: { created_at: desc }, limit: 100) {
        id
        name
        assets
        shares
        created_at
        vault {
          term_id
          term {
            atom { label term_id type image }
            triple {
              subject { label term_id image type }
              predicate { label }
              object { label term_id image type }
            }
          }
        }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    const events = data?.events ?? [];
    
    return events.map((ev: any) => {
        const atom = ev.vault?.term?.atom;
        const triple = ev.vault?.term?.triple;
        let label = 'Unknown Node';
        if (atom) label = resolveMetadata(atom).label;
        else if (triple) label = `${resolveMetadata(triple.subject).label} ${triple.predicate?.label || 'LINK'} ${resolveMetadata(triple.object).label}`;

        const type = ev.name?.toUpperCase().includes('REDEEM') ? 'REDEEM' : 'DEPOSIT';

        return { 
            id: ev.id, 
            type, 
            shares: ev.shares || "0", 
            assets: ev.assets || "0", 
            timestamp: ev.created_at ? new Date(ev.created_at).getTime() : Date.now(), 
            vaultId: ev.vault?.term_id,
            assetLabel: label
        };
    });
  } catch (e) { return []; }
};

export const getUserPositions = async (address: string) => {
  const ids = [address, address.toLowerCase()];
  const q = `query ($ids: [String!]!) {
      positions(where: { account: { id: { _in: $ids } }, shares: { _gt: "0" } }, limit: 500) { 
        id 
        shares 
        account { id label image } 
        vault { 
          term_id 
          curve_id 
          term { 
            atom { term_id label image type } 
            triple { 
              term_id 
              subject { label term_id type image } 
              predicate { label } 
              object { label term_id type image } 
            } 
          } 
        } 
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return data?.positions ?? [];
  } catch (e) { return []; }
};

export const getVaultsByIds = async (ids: string[]) => {
  if (!ids || ids.length === 0) return [];
  const q = `query GetVaultsByIds($ids: [String!]!) {
      atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } }
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      triples(where: { term_id: { _in: $ids } }) { term_id subject { label term_id image type } predicate { label } object { label term_id image type } }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const aggregated = aggregateVaultData(res?.vaults || []);
    const atoms = res?.atoms || [];
    const triples = res?.triples || [];

    return aggregated.map(v => {
      const a = atoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const t = triples.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '', type: 'ATOM' };
      let label = meta.label, type = (meta.type || "ATOM").toUpperCase(), image = a?.image;

      if (t) {
          const sMeta = resolveMetadata(t.subject), oMeta = resolveMetadata(t.object);
          label = `${sMeta.label} ${t.predicate?.label || 'LINK'} ${oMeta.label}`;
          type = "CLAIM";
          image = t.subject?.image || t.object?.image;
      }

      return {
        id: v.term_id,
        label,
        description: meta.description,
        image,
        type,
        creator: a?.creator,
        totalAssets: v.total_assets.toString(), 
        totalShares: v.total_shares.toString(),
        currentSharePrice: v.current_share_price,
        marketCap: v.computed_mcap.toString(),
        positionCount: v.position_count
      };
    });
  } catch (e) { return []; }
};

export const getNetworkStats = async () => {
  const q = `query { vaults_aggregate { aggregate { sum { total_assets } } } atoms_aggregate { aggregate { count } } triples_aggregate { aggregate { count } } }`;
  try {
    const data = await fetchGraphQL(q);
    return { tvl: data?.vaults_aggregate?.aggregate?.sum?.total_assets || "0", atoms: data?.atoms_aggregate?.aggregate?.count || 0, signals: data?.triples_aggregate?.aggregate?.count || 0, positions: 0 };
  } catch (e) { return { tvl: "0", atoms: 0, signals: 0, positions: 0 }; }
};

export const getAgentTriples = async (termId: string) => {
  const ids = prepareQueryIds(termId);
  const q = `query ($ids: [String!]!) { triples(where: { _or: [ {subject: { term_id: { _in: $ids } }}, {object: { term_id: { _in: $ids } }} ] }, order_by: { block_number: desc }) { term_id subject { label term_id image type } predicate { label } object { label term_id image type } block_number transaction_hash } }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return data?.triples ?? [];
  } catch (e) { return []; }
};

export const getHoldersForVault = async (vaultId: string) => {
    const ids = prepareQueryIds(vaultId);
    const q = `query ($ids: [String!]!) { 
      positions(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }, order_by: { shares: desc }, limit: 100) { account { id label image } shares }
      vaults(where: { term_id: { _in: $ids } }) { position_count }
    }`;
    try {
        const data = await fetchGraphQL(q, { ids });
        const totalPosCount = (data?.vaults || []).reduce((acc: number, v: any) => acc + Number(v.position_count || 0), 0);
        return { holders: data?.positions ?? [], totalCount: totalPosCount };
    } catch (e) { return { holders: [], totalCount: 0 }; }
};

export const getIncomingTriplesForStats = async (termId: string) => {
  const ids = prepareQueryIds(termId);
  const q = `query ($ids: [String!]!) { 
    triples_aggregate(where: { object_id: { _in: $ids } }) {
      aggregate { count }
    }
    triples(where: { object_id: { _in: $ids } }, limit: 50, order_by: { block_number: desc }) { 
      term_id subject { label term_id data image type } predicate { label term_id } block_number 
    }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return {
      triples: data?.triples ?? [],
      totalCount: data?.triples_aggregate?.aggregate?.count || 0
    };
  } catch (e) { return { triples: [], totalCount: 0 }; }
};

export const getAtomInclusionLists = async (atomId: string) => {
    const ids = prepareQueryIds(atomId);
    const q = `query ($ids: [String!]!) { 
        triples(where: { object: { term_id: { _in: $ids } } }, limit: 50) { 
            subject { 
                term_id label image type 
                subject_triples_aggregate { aggregate { count } }
                vaults { total_assets total_shares }
            } 
        } 
    }`;
    try {
        const data = await fetchGraphQL(q, { ids });
        const uniqueMap = new Map();
        
        (data?.triples ?? []).forEach((t: any) => {
            const s = t.subject;
            if (!s || !s.term_id || ids.includes(normalize(s.term_id))) return;
            
            const meta = resolveMetadata(s);
            const totalItems = s.subject_triples_aggregate?.aggregate?.count || 0;
            
            if (!uniqueMap.has(normalize(s.term_id)) && (totalItems > 1 || !meta.label.startsWith('0x'))) {
                const aggregatedVault = aggregateVaultData(s.vaults || [])[0];
                uniqueMap.set(normalize(s.term_id), { 
                    id: s.term_id, 
                    label: meta.label, 
                    image: s.image,
                    totalItems: totalItems, 
                    value: aggregatedVault ? parseFloat(formatEther(aggregatedVault.total_assets)) : 0,
                    items: [] 
                });
            }
        });
        return Array.from(uniqueMap.values());
    } catch (e) { return []; }
};

export const getIdentitiesEngaged = async (atomId: string) => {
    const ids = prepareQueryIds(atomId);
    const q = `query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }, limit: 100) { object { term_id label image type } predicate { label } } }`;
    try {
        const data = await fetchGraphQL(q, { ids });
        const engaged = (data?.triples ?? []).map((t: any) => ({ ...t.object, label: resolveMetadata(t.object).label, predicate: t.predicate?.label })).filter(e => e.term_id);
        return Array.from(new Map(engaged.map((e: any) => [normalize(e.term_id), e])).values());
    } catch (e) { return []; }
};

export const getTopPositions = async () => {
   const q = `query { positions(limit: 200, order_by: { shares: desc }, where: { shares: { _gt: "0" } }) { account { id label image } shares vault { term_id } } }`;
   try {
     const data = await fetchGraphQL(q);
     const positions = data?.positions ?? [];
     if (positions.length === 0) return [];
     const termIds = Array.from(new Set(positions.map((p: any) => p.vault?.term_id).filter(Boolean))) as string[];
     let atoms: any[] = [];
     if (termIds.length > 0) {
         const ids = Array.from(new Set([...termIds, ...termIds.map(id => id.toLowerCase())]));
         const chunks = chunkArray(ids, 200);
         for (const chunk of chunks) {
             const atomData = await fetchGraphQL(`query ($ids: [String!]!) { atoms(where: { term_id: { _in: $ids } }) { term_id label image type } }`, { ids: chunk });
             if (atomData?.atoms) atoms = [...atoms, ...atomData.atoms];
         }
     }
     return positions.map((p: any) => {
         const atom = atoms.find((a: any) => normalize(a.term_id) === normalize(p.vault?.term_id));
         return { ...p, vault: { ...p.vault, atom: atom ? { label: resolveMetadata(atom).label, image: atom.image, type: atom.type } : null } };
     });
   } catch (e) { return []; }
};

export const searchGlobalAgents = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase().trim();
    const isLikelyAddress = term.startsWith('0x') && term.length === 42;
    const pattern = `%${term}%`, id = term;
    const atomQ = `query ($pattern: String!) { atoms(where: { label: { _ilike: $pattern } }, limit: 50) { term_id label data image type creator { id label } } }`;
    const vaultQ = `query ($id: String!) { vaults(where: { term_id: { _eq: $id } }) { term_id total_assets total_shares current_share_price curve_id position_count } }`;
    try {
        const results = await Promise.all([fetchGraphQL(atomQ, { pattern }), fetchGraphQL(vaultQ, { id })]);
        const atoms = results[0]?.atoms ?? [];
        const addressVault = isLikelyAddress ? (results[1]?.vaults ?? []) : [];
        const atomIds = atoms.map((a: any) => a.term_id);
        let vaultsForAtoms: any[] = [];
        if (atomIds.length > 0) vaultsForAtoms = (await fetchGraphQL(`query ($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count } }`, { ids: atomIds }))?.vaults ?? [];
        
        return atoms.map((a: any) => {
             const aggr = aggregateVaultData(vaultsForAtoms.filter(v => normalize(v.term_id) === normalize(a.term_id)))[0];
             const meta = resolveMetadata(a);
             return { id: a.term_id, label: meta.label, image: a.image, type: (meta.type || "ATOM").toUpperCase(), creator: a.creator, totalAssets: aggr?.total_assets.toString() || "0", totalShares: aggr?.total_shares.toString() || "0", currentSharePrice: aggr?.current_share_price || "0", marketCap: aggr?.computed_mcap.toString() || "0", positionCount: aggr?.position_count || 0 };
        });
    } catch (e) { return []; }
};

export const getGlobalClaims = async (limit = 40, offset = 0) => {
  if (isGlobalClaimsFetching && offset === 0) return { items: [], hasMore: false };
  isGlobalClaimsFetching = true;
  const q = `query GetGlobalClaims($limit: Int!, $offset: Int!) { triples(order_by: { block_number: desc }, limit: $limit, offset: $offset) { term_id block_number transaction_hash created_at subject { term_id label image type } predicate { label } object { term_id label image type } } }`;
  try {
    const data = await fetchGraphQL(q, { limit, offset });
    const triples = data?.triples ?? [];
    const items = triples.map((t: any) => {
      if (!t.subject || !t.object) return null;
      const pred = (t.predicate?.label || 'SIGNAL').toUpperCase();
      return { id: t.term_id || t.transaction_hash, subject: { id: t.subject?.term_id, label: resolveMetadata(t.subject).label, image: t.subject?.image }, predicate: pred, object: { id: t.object?.term_id, label: resolveMetadata(t.object).label, image: t.object?.image, type: (t.object?.type || 'ATOM').toUpperCase() }, confidence: 75, timestamp: t.created_at ? new Date(t.created_at).getTime() : Date.now(), txHash: t.transaction_hash, block: t.block_number };
    }).filter(Boolean) as Claim[];
    
    return { items, hasMore: triples.length === limit };
  } catch (e) { return { items: [], hasMore: false }; } finally { isGlobalClaimsFetching = false; }
};

export const getMarketActivity = async (termId: string): Promise<Transaction[]> => {
  const ids = prepareQueryIds(termId);
  const q = `query ($ids: [String!]!) {
      events(
        where: { vault: { term_id: { _in: $ids } } }, 
        order_by: { created_at: desc }, 
        limit: 100
      ) { 
        id name assets shares created_at account { id label } 
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    const events = data?.events ?? [];
    
    return events.map((ev: any) => ({ 
        id: ev.id, 
        type: ev.name?.toUpperCase().includes('REDEEM') ? "REDEEM" : "DEPOSIT", 
        shares: ev.shares || "0", 
        assets: ev.assets || "0", 
        timestamp: ev.created_at ? new Date(ev.created_at).getTime() : Date.now(), 
        vaultId: termId, 
        user: ev.account?.label || ev.account?.id 
    })).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) { return []; }
};

export const getTopClaims = async (limit = 40, offset = 0) => {
  const query = `query GetTopTripleVaults($limit: Int!, $offset: Int!) {
    vaults(
      where: { term: { triple: { term_id: { _is_null: false } } } },
      order_by: { total_assets: desc },
      limit: $limit,
      offset: $offset
    ) {
      total_assets
      position_count
      term_id
      term {
        triple {
          term_id
          subject { label term_id image data type }
          predicate { label term_id }
          object { label term_id image data type }
          counter_term {
            vaults { total_assets position_count }
          }
        }
      }
    }
  }`;
  
  try {
    const data = await fetchGraphQL(query, { limit, offset });
    const vaults = data?.vaults ?? [];
    
    const items = vaults.map((v: any) => {
        const t = v.term?.triple;
        if (!t) return null;

        const supportAssets = parseFloat(formatEther(BigInt(v.total_assets || '0')));
        const supportHolders = Number(v.position_count || 0);

        const counterVaults = t.counter_term?.vaults || [];
        const opposeAssets = counterVaults.reduce((acc: number, cv: any) => acc + parseFloat(formatEther(BigInt(cv.total_assets || '0'))), 0);
        const opposeHolders = counterVaults.reduce((acc: number, cv: any) => acc + Number(cv.position_count || 0), 0);

        return {
            id: t.term_id,
            subject: { label: resolveMetadata(t.subject).label, id: t.subject.term_id, image: t.subject.image },
            predicate: (t.predicate?.label || 'LINK').toUpperCase(),
            object: { label: resolveMetadata(t.object).label, id: t.object.term_id, image: t.object.image },
            value: supportAssets,
            holders: supportHolders,
            opposeValue: opposeAssets,
            opposeHolders: opposeHolders
        };
    }).filter(Boolean);

    return { items, hasMore: vaults.length === limit };
  } catch (e) { 
    console.error("GET_TOP_CLAIMS_ERROR:", e);
    return { items: [], hasMore: false }; 
  }
};

export const getLists = async (limit = 40, offset = 0) => {
    const q = `query GetLists($limit: Int!, $offset: Int!) {
        atoms(
            limit: $limit, 
            offset: $offset, 
            where: { subject_triples_aggregate: { count: { _gt: 1 } } },
            order_by: { subject_triples_aggregate: { count: desc } }
        ) {
            term_id
            label
            image
            type
            vaults { total_assets total_shares position_count curve_id }
            subject_triples_aggregate { aggregate { count } }
            subject_triples(limit: 5) {
                object { label image }
            }
        }
    }`;
    try {
        const data = await fetchGraphQL(q, { limit, offset });
        const atoms = data?.atoms ?? [];
        const items = atoms.map((a: any) => {
            const aggregatedVault = aggregateVaultData(a.vaults || [])[0];
            const meta = resolveMetadata(a);
            return {
                id: a.term_id,
                label: meta.label,
                image: a.image,
                totalItems: a.subject_triples_aggregate?.aggregate?.count || 0,
                items: (a.subject_triples || []).map((t: any) => ({ label: t.object.label, image: t.object.image })),
                value: aggregatedVault ? parseFloat(formatEther(aggregatedVault.total_assets)) : 0
            };
        });
        return { items, hasMore: atoms.length === limit };
    } catch (e) { return { items: [], hasMore: false }; }
};

export const getAgentOpinions = async (termId: string) => {
    return [];
};

export const getOppositionTriple = async (subjectId: string) => {
    const sIds = prepareQueryIds(subjectId);
    const pIds = prepareQueryIds(IS_PREDICATE_ID);
    const oIds = prepareQueryIds(DISTRUST_ATOM_ID);

    const q = `query ($sIds: [String!], $pIds: [String!], $oIds: [String!]) {
        triples(where: { 
            subject_id: { _in: $sIds }, 
            predicate_id: { _in: $pIds }, 
            object_id: { _in: $oIds } 
        }, limit: 1) {
            term_id
            subject { label term_id image type }
            predicate { label }
            object { label term_id image type }
            term {
                vaults { term_id total_assets total_shares current_share_price curve_id position_count }
            }
        }
    }`;
    
    try {
        const res = await fetchGraphQL(q, { sIds, pIds, oIds });
        const t = res?.triples?.[0];
        if (!t) return null;

        const aggregated = aggregateVaultData(t.term?.vaults || []);
        const v = aggregated[0];
        const sMeta = resolveMetadata(t.subject);

        return {
            id: t.term_id,
            label: `Opposing ${sMeta.label}`,
            totalAssets: v?.total_assets.toString() || "0",
            totalShares: v?.total_shares.toString() || "0",
            currentSharePrice: v?.current_share_price || "0",
            marketCap: v?.computed_mcap.toString() || "0",
            positionCount: v?.position_count || 0
        };
    } catch (e) { return null; }
};
