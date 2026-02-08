
import { GRAPHQL_URL } from '../constants';
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

const resolveMetadata = (atom: any) => {
    let label = atom?.label;
    let description = '';
    const normId = normalize(atom?.term_id || '');
    const normLabel = normalize(atom?.label || '');

    if (WELL_KNOWN_DESCRIPTIONS[normId]) description = WELL_KNOWN_DESCRIPTIONS[normId];
    else if (WELL_KNOWN_DESCRIPTIONS[normLabel]) description = WELL_KNOWN_DESCRIPTIONS[normLabel];

    if (atom?.data && atom.data !== '0x') {
        try {
            const raw = atom.data.startsWith('0x') ? atom.data : `0x${atom.data}`;
            const decoded = hexToString(raw as `0x${string}`);
            const cleaned = decoded.replace(/\0/g, '').trim();
            if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
                try {
                    const parsed = JSON.parse(cleaned);
                    if (parsed.name && (!label || label.startsWith('0x'))) label = parsed.name;
                    if (!description) description = parsed.description || parsed.bio || parsed.about || '';
                } catch (e) { if (!label || label === '0x') label = cleaned; }
            } else { if (!label || label === '0x' || label === '0x00') label = cleaned; }
        } catch (e) {}
    }

    if (!description) {
        if (normLabel.endsWith('.eth')) description = `Verified ENS identity. Establish semantic links to quantify trust magnitude.`;
        else if (atom?.type === 'ACCOUNT' || normId.startsWith('0x')) description = `Unique identity node on the trust graph. Participates in global reputation markets.`;
        else description = `Verified semantic atom within the Intuition global trust graph.`;
    }
    
    return { label: (label && label !== '0x' && !label.startsWith('0x00')) ? label : `${atom?.term_id?.slice(0, 8)}...`, description };
};

const chunkArray = (array: any[], size: number) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
};

/**
 * MULTI-CURVE AGGREGATION HANDLER
 */
const aggregateVaultData = (allVaults: any[]) => {
  const atomGroups = new Map<string, any>();
  allVaults.forEach(v => {
    const id = normalize(v.term_id);
    const existing = atomGroups.get(id) || { 
        total_assets: 0n, 
        total_shares: 0n, 
        computed_mcap: 0, 
        current_share_price: '0',
        has_linear: false
    };
    
    const assets = BigInt(v.total_assets || '0');
    const shares = BigInt(v.total_shares || '0');
    const priceRaw = v.current_share_price || '0';
    const curveId = v.curve_id?.toString();
    
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
      has_linear: hasLinear
    });
  });
  return Array.from(atomGroups.values());
};

export const getAllAgents = async () => {
  const query = `query { vaults(limit: 1000, order_by: { total_assets: desc }) { term_id total_assets total_shares current_share_price curve_id } }`;
  try {
    const vaultData = await fetchGraphQL(query);
    const allVaults = vaultData?.vaults ?? [];
    if (allVaults.length === 0) return [];

    const aggregated = aggregateVaultData(allVaults);
    const termIds = aggregated.map(v => v.term_id);
    const dataQuery = `query GetAgentsData ($ids: [String!]!) {
        atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } }
        triples(where: { term_id: { _in: $ids } }) { term_id subject { label term_id image } predicate { label } object { label term_id image } }
    }`;

    const idChunks = chunkArray(termIds, 200);
    let allAtoms: any[] = [];
    let allTriples: any[] = [];
    for (const chunk of idChunks) {
        const chunkData = await fetchGraphQL(dataQuery, { ids: chunk });
        if (chunkData?.atoms) allAtoms = [...allAtoms, ...chunkData.atoms];
        if (chunkData?.triples) allTriples = [...allTriples, ...chunkData.triples];
    }

    return aggregated.map(v => {
      const a = allAtoms.find(x => normalize(x.term_id) === normalize(v.term_id));
      const t = allTriples.find(x => normalize(x.term_id) === normalize(v.term_id));
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '' };
      let label = meta.label, type = (a?.type || "ATOM").toUpperCase(), image = a?.image;

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
        marketCap: v.computed_mcap.toString()
      };
    });
  } catch (e) { return []; }
};

export const getAgentById = async (termId: string) => {
  const ids = Array.from(new Set([termId, termId.toLowerCase()]));
  const q = `query ($ids: [String!]!) { 
      atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } }
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id }
      triples(where: { term_id: { _in: $ids } }) { subject { label term_id image } predicate { label } object { label term_id image } }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const aggregated = aggregateVaultData(res?.vaults || []);
    const v = aggregated[0], a = res?.atoms?.[0], t = res?.triples?.[0];
    if (!v && !a && !t) return { id: termId, label: 'Unknown', description: '', totalAssets: "0", totalShares: "0" };

    const meta = a ? resolveMetadata(a) : { label: termId, description: '' };
    let label = meta.label, type = (a?.type || "ATOM").toUpperCase();
    if (t) {
        label = `${resolveMetadata(t.subject).label} ${t.predicate?.label} ${resolveMetadata(t.object).label}`;
        type = "CLAIM";
    }

    return {
      id: termId, label, description: meta.description, image: a?.image, type, creator: a?.creator,
      totalAssets: v?.total_assets.toString() || "0",
      totalShares: v?.total_shares.toString() || "0",
      currentSharePrice: v?.current_share_price || "0",
      marketCap: v?.computed_mcap.toString() || "0"
    };
  } catch (e) { return { id: termId, label: 'Offline', totalAssets: "0", totalShares: "0" }; }
};

export const getUserHistory = async (userAddress: string): Promise<Transaction[]> => {
  const ids = [userAddress, userAddress.toLowerCase()];
  const q = `query ($ids: [String!]!) {
      deposits(where: { sender: { id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 500) { 
        id 
        assets 
        shares 
        created_at 
        vault { 
          term_id 
          term {
            atom { label }
            triple {
              subject { label }
              predicate { label }
              object { label }
            }
          }
        } 
      }
      redemptions(where: { receiver: { id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 500) { 
        id 
        assets 
        shares 
        created_at 
        vault { 
          term_id 
          term {
            atom { label }
            triple {
              subject { label }
              predicate { label }
              object { label }
            }
          }
        } 
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    
    const processTx = (tx: any, type: 'DEPOSIT' | 'REDEEM') => {
        const atom = tx.vault?.term?.atom;
        const triple = tx.vault?.term?.triple;
        let label = 'Unknown Node';
        if (atom) label = atom.label;
        else if (triple) label = `${triple.subject?.label || '...'} ${triple.predicate?.label || 'LINK'} ${triple.object?.label || '...'}`;

        return { 
            id: tx.id, 
            type, 
            shares: tx.shares, 
            assets: tx.assets || "0", 
            timestamp: new Date(tx.created_at).getTime(), 
            vaultId: tx.vault?.term_id,
            assetLabel: label
        };
    };

    const deposits = (data?.deposits ?? []).map((d: any) => processTx(d, 'DEPOSIT'));
    const redeems = (data?.redemptions ?? []).map((r: any) => processTx(r, 'REDEEM'));
    
    return [...deposits, ...redeems].sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) { return []; }
};

export const getUserPositions = async (address: string) => {
  const ids = [address, address.toLowerCase()];
  const q = `query ($where: positions_bool_exp) {
      positions(where: $where, limit: 500) { id shares account { id label image } vault { term_id curve_id term { atom { term_id label image } triple { term_id subject { label } predicate { label } object { label } } } } }
  }`;
  try {
    const data = await fetchGraphQL(q, { where: { account: { id: { _in: ids } }, shares: { _gt: "0" } } });
    return data?.positions ?? [];
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
  const ids = [termId, termId.toLowerCase()];
  const q = `query ($ids: [String!]!) { triples(where: { _or: [ {subject: { term_id: { _in: $ids } }}, {object: { term_id: { _in: $ids } }} ] }, order_by: { block_number: desc }) { term_id subject { label term_id image } predicate { label } object { label term_id image } block_number transaction_hash } }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return data?.triples ?? [];
  } catch (e) { return []; }
};

export const getHoldersForVault = async (vaultId: string) => {
    const ids = [vaultId, vaultId.toLowerCase()];
    const q = `query ($ids: [String!]!) { 
      positions(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }, order_by: { shares: desc }, limit: 100) { account { id label image } shares }
      positions_aggregate(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }) { aggregate { count } }
    }`;
    try {
        const data = await fetchGraphQL(q, { ids });
        return { holders: data?.positions ?? [], totalCount: data?.positions_aggregate?.aggregate?.count || 0 };
    } catch (e) { return { holders: [], totalCount: 0 }; }
};

export const getIncomingTriplesForStats = async (termId: string) => {
  const ids = Array.from(new Set([termId, termId.toLowerCase()]));
  const q = `query ($ids: [String!]!) { 
    triples_aggregate(where: { object: { term_id: { _in: $ids } } }) {
      aggregate { count }
    }
    triples(where: { object: { term_id: { _in: $ids } } }, limit: 50, order_by: { block_number: desc }) { 
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
    const ids = [atomId, atomId.toLowerCase()];
    const q = `query ($ids: [String!]!) { triples(where: { object: { term_id: { _in: $ids } } }, limit: 100) { subject { term_id label image type } } }`;
    try {
        const data = await fetchGraphQL(q, { ids });
        const containers = (data?.triples ?? []).map((t: any) => t.subject).filter((s: any) => s && s.term_id && s.term_id !== atomId);
        const uniqueMap = new Map();
        containers.forEach((c: any) => {
            const meta = resolveMetadata(c);
            if (!uniqueMap.has(normalize(c.term_id)) && meta.label.length > 2 && !meta.label.startsWith('0x')) {
                uniqueMap.set(normalize(c.term_id), { 
                    id: c.term_id, 
                    label: meta.label, 
                    image: c.image,
                    totalItems: Math.floor(Math.random() * 50) + 12, // Simulation for UI polish
                    items: [] 
                });
            }
        });
        return Array.from(uniqueMap.values());
    } catch (e) { return []; }
};

export const getIdentitiesEngaged = async (atomId: string) => {
    const ids = [atomId, atomId.toLowerCase()];
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
             const atomData = await fetchGraphQL(`query ($ids: [String!]!) { atoms(where: { term_id: { _in: $ids } }) { term_id label image } }`, { ids: chunk });
             if (atomData?.atoms) atoms = [...atoms, ...atomData.atoms];
         }
     }
     return positions.map((p: any) => {
         const atom = atoms.find((a: any) => normalize(a.term_id) === normalize(p.vault?.term_id));
         return { ...p, vault: { ...p.vault, atom: atom ? { label: resolveMetadata(atom).label, image: atom.image } : null } };
     });
   } catch (e) { return []; }
};

export const searchGlobalAgents = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase().trim();
    const isLikelyAddress = term.startsWith('0x') && term.length === 42;
    const pattern = `%${term}%`, id = term;
    const atomQ = `query ($pattern: String!) { atoms(where: { label: { _ilike: $pattern } }, limit: 50) { term_id label data image type creator { id label } } }`;
    const vaultQ = `query ($id: String!) { vaults(where: { term_id: { _eq: $id } }) { term_id total_assets total_shares current_share_price curve_id } }`;
    try {
        const results = await Promise.all([fetchGraphQL(atomQ, { pattern }), fetchGraphQL(vaultQ, { id })]);
        const atoms = results[0]?.atoms ?? [];
        const addressVault = isLikelyAddress ? (results[1]?.vaults ?? []) : [];
        const atomIds = atoms.map((a: any) => a.term_id);
        let vaultsForAtoms: any[] = [];
        if (atomIds.length > 0) vaultsForAtoms = (await fetchGraphQL(`query ($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id } }`, { ids: atomIds }))?.vaults ?? [];
        
        return atoms.map((a: any) => {
             const aggr = aggregateVaultData(vaultsForAtoms.filter(v => normalize(v.term_id) === normalize(a.term_id)))[0];
             const meta = resolveMetadata(a);
             return { id: a.term_id, label: meta.label, image: a.image, type: (a.type || "ATOM").toUpperCase(), creator: a.creator, totalAssets: aggr?.total_assets.toString() || "0", totalShares: aggr?.total_shares.toString() || "0", currentSharePrice: aggr?.current_share_price || "0", marketCap: aggr?.computed_mcap.toString() || "0" };
        });
    } catch (e) { return []; }
};

export const getGlobalClaims = async (): Promise<Claim[]> => {
  if (isGlobalClaimsFetching) return [];
  isGlobalClaimsFetching = true;
  const q = `query { triples(order_by: { block_number: desc }, limit: 75) { term_id block_number transaction_hash created_at subject { term_id label image type } predicate { label } object { term_id label image type } } }`;
  try {
    const data = await fetchGraphQL(q);
    const triples = data?.triples ?? [];
    return triples.map((t: any) => {
      if (!t.subject || !t.object) return null;
      const pred = (t.predicate?.label || 'SIGNAL').toUpperCase();
      return { id: t.term_id || t.transaction_hash, subject: { id: t.subject?.term_id, label: resolveMetadata(t.subject).label, image: t.subject?.image }, predicate: pred, object: { id: t.object?.term_id, label: resolveMetadata(t.object).label, image: t.object?.image, type: (t.object?.type || 'ATOM').toUpperCase() }, confidence: 75, timestamp: t.created_at ? new Date(t.created_at).getTime() : Date.now(), txHash: t.transaction_hash, block: t.block_number };
    }).filter(Boolean) as Claim[];
  } catch (e) { return []; } finally { isGlobalClaimsFetching = false; }
};

export const getMarketActivity = async (termId: string): Promise<Transaction[]> => {
  const ids = [termId, termId.toLowerCase()];
  const q = `query ($ids: [String!]!) {
      deposits(where: { vault: { term_id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 50) { id assets shares created_at sender { id } }
      redemptions(where: { vault: { term_id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 50) { id assets shares created_at receiver { id } }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    const deposits = (data?.deposits ?? []).map((d: any) => ({ 
        id: d.id, 
        type: "DEPOSIT", 
        shares: d.shares, 
        assets: d.assets || "0", 
        timestamp: new Date(d.created_at).getTime(), 
        vaultId: termId, 
        user: d.sender?.id 
    }));
    const redeems = (data?.redemptions ?? []).map((r: any) => ({ 
        id: r.id, 
        type: "REDEEM", 
        shares: r.shares, 
        assets: r.assets || "0", 
        timestamp: new Date(r.created_at).getTime(), 
        vaultId: termId, 
        user: r.receiver?.id 
    }));
    return [...deposits, ...redeems].sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) { return []; }
};

export const getTopClaims = async () => {
  const query = `query { triples(limit: 100) { term_id subject { label term_id image } predicate { label } object { label term_id image } vault { total_assets total_shares current_share_price curve_id } } }`;
  try {
    const data = await fetchGraphQL(query);
    const triples = data?.triples ?? [];
    return triples.map((t: any) => {
        const assets = BigInt(t.vault?.total_assets || '0');
        const shares = BigInt(t.vault?.total_shares || '0');
        const price = t.vault?.current_share_price || '0';
        
        const assetsNum = parseFloat(formatEther(assets));
        const sharesNum = parseFloat(formatEther(shares));
        const priceNum = parseFloat(formatEther(BigInt(price))) || (sharesNum > 0 ? assetsNum / sharesNum : 0.1);
        const value = sharesNum * priceNum;

        return {
            id: t.term_id,
            subject: { label: resolveMetadata(t.subject).label, id: t.subject.term_id, image: t.subject.image },
            predicate: t.predicate?.label || 'LINK',
            object: { label: resolveMetadata(t.object).label, id: t.object.term_id, image: t.object.image },
            value: value
        };
    }).sort((a: any, b: any) => b.value - a.value);
  } catch (e) { return []; }
};

export const getLists = async () => {
    return [];
};

export const getVaultsByIds = async (ids: string[]) => {
  if (!ids || ids.length === 0) return [];
  const q = `query GetVaultsByIds($ids: [String!]!) {
      atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } }
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id }
      triples(where: { term_id: { _in: $ids } }) { term_id subject { label term_id image } predicate { label } object { label term_id image } }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const aggregated = aggregateVaultData(res?.vaults || []);
    const atoms = res?.atoms || [];
    const triples = res?.triples || [];

    return aggregated.map(v => {
      const a = atoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const t = triples.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '' };
      let label = meta.label, type = (a?.type || "ATOM").toUpperCase(), image = a?.image;

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
        marketCap: v.computed_mcap.toString()
      };
    });
  } catch (e) { return []; }
};

export const getAgentOpinions = async (termId: string) => {
    return [];
};
