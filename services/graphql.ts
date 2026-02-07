import { GRAPHQL_URL } from '../constants';
import { Transaction, Claim } from '../types';
import { hexToString, formatEther, parseEther } from 'viem';

// Request guard to prevent parallel overlapping global claims fetches
let isGlobalClaimsFetching = false;

/**
 * WELL_KNOWN_DESCRIPTIONS: The "Gold Standard" for core protocol nodes.
 * These are used as a primary lookup for high-priority identity atoms.
 */
const WELL_KNOWN_DESCRIPTIONS: Record<string, string> = {
    // Intuition Protocol Atom
    '0x000000000000000000000000000000000000000000000000000000000000bc48': "The base protocol for semantic truth. Intuition allows anyone to claim, verify, and signal on any piece of information, creating a global, decentralized reputation graph for the era of AI and information overload.",
    'intuition': "The base protocol for semantic truth. Intuition allows anyone to claim, verify, and signal on any piece of information, creating a global, decentralized reputation graph for the era of AI and information overload.",
    
    // Core Predicates
    '0x0000000000000000000000000000000000000000000000000000000000003a73': "The standard trust predicate. Used by network participants to signal directional conviction and stake capital on the reputation of another node or claim.",
    
    // Core Identities
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

    // 1. Hardcoded Well-Known database check
    if (WELL_KNOWN_DESCRIPTIONS[normId]) {
        description = WELL_KNOWN_DESCRIPTIONS[normId];
    } else if (WELL_KNOWN_DESCRIPTIONS[normLabel]) {
        description = WELL_KNOWN_DESCRIPTIONS[normLabel];
    }

    // 2. Hex Data Field extraction
    if (atom?.data && atom.data !== '0x') {
        try {
            const raw = atom.data.startsWith('0x') ? atom.data : `0x${atom.data}`;
            const decoded = hexToString(raw as `0x${string}`);
            const cleaned = decoded.replace(/\0/g, '').trim();
            
            if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
                try {
                    const parsed = JSON.parse(cleaned);
                    if (parsed.name && (!label || label.startsWith('0x'))) label = parsed.name;
                    if (!description) {
                        description = parsed.description || parsed.bio || parsed.about || parsed.summary || '';
                    }
                } catch (e) {
                    if (!label || label === '0x') label = cleaned;
                }
            } else {
                if (!label || label === '0x' || label === '0x00') label = cleaned;
            }
        } catch (e) {}
    }

    // 3. Smart fallbacks for identities
    if (!description) {
        if (normLabel.endsWith('.eth')) {
            description = `A verified Ethereum Name Service (ENS) identity established on the Intuition Network. Establish semantic links to this node to quantify its global trust magnitude.`;
        } else if (atom?.type === 'ACCOUNT' || normId.startsWith('0x')) {
            description = `A unique identity node on the Intuition trust graph. Use capital signaling to establish conviction and participate in the reputation market for this entity.`;
        } else {
            description = `A verified semantic atom within the Intuition global trust graph. Ready for capital signaling, logic establishing, and reputation quantification.`;
        }
    }
    
    return { 
        label: (label && label !== '0x' && !label.startsWith('0x00')) ? label : `${atom?.term_id?.slice(0, 8)}...`,
        description: description || ''
    };
};

const chunkArray = (array: any[], size: number) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

export const getAllAgents = async () => {
  const query = `
    query GetAllAgents {
      vaults(limit: 1000, order_by: { total_assets: desc }) {
        term_id
        total_assets
        total_shares
        current_share_price
        curve_id
      }
    }
  `;

  try {
    const vaultData = await fetchGraphQL(query);
    const allVaults = vaultData?.vaults ?? [];
    if (allVaults.length === 0) return [];

    const uniqueVaultsMap = new Map<string, any>();
    allVaults.forEach((v: any) => {
        if (!v.term_id) return;
        const id = normalize(v.term_id);
        if (!uniqueVaultsMap.has(id)) {
            uniqueVaultsMap.set(id, v);
        }
    });
    const vaults = Array.from(uniqueVaultsMap.values());
    const termIds = vaults.map((v: any) => v.term_id);
    const queryIds = Array.from(new Set([...termIds, ...termIds.map(id => id.toLowerCase())]));

    const dataQuery = `
      query GetAgentsData ($ids: [String!]!) {
        atoms(where: { term_id: { _in: $ids } }) {
          term_id
          label
          data
          image
          type
          creator { id label }
        }
        triples(where: { term_id: { _in: $ids } }) {
          term_id
          subject { label term_id image data } 
          predicate { label }
          object { label term_id image data }
        }
      }
    `;

    const idChunks = chunkArray(queryIds, 200);
    let allAtoms: any[] = [];
    let allTriples: any[] = [];

    for (const chunk of idChunks) {
        const chunkData = await fetchGraphQL(dataQuery, { ids: chunk });
        if (chunkData?.atoms) allAtoms = [...allAtoms, ...chunkData.atoms];
        if (chunkData?.triples) allTriples = [...allTriples, ...chunkData.triples];
    }

    return vaults.map((v: any) => {
      const a = allAtoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const t = allTriples.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '' };
      let label = meta.label;
      let description = meta.description;
      let type = (a?.type || "ATOM").toUpperCase();
      let image = a?.image;

      if (t) {
          const sMeta = resolveMetadata(t.subject);
          const oMeta = resolveMetadata(t.object);
          const subj = sMeta.label;
          const pred = t.predicate?.label || 'LINK';
          const obj = oMeta.label;
          label = `${subj} ${pred} ${obj}`;
          type = "CLAIM";
          image = t.subject?.image || t.object?.image;
      }

      return {
        id: v.term_id,
        label: label,
        description: description,
        image: image,
        type: type,
        creator: a?.creator,
        totalAssets: v.total_assets,
        totalShares: v.total_shares,
        currentSharePrice: v.current_share_price,
        curveId: v.curve_id
      };
    });
  } catch (e) {
    return [];
  }
};

export const getAgentById = async (termId: string) => {
  const idsToQuery = [termId, termId.toLowerCase()];
  const atomQ = `query ($ids: [String!]!) { atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } } }`;
  const vaultQ = `query ($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }, order_by: { total_assets: desc }, limit: 1) { term_id total_assets total_shares current_share_price curve_id } }`;
  const tripleQ = `query ($ids: [String!]!) { triples(where: { term_id: { _in: $ids } }) { subject { label term_id data } predicate { label term_id } object { label term_id data } } }`;

  try {
    const [atomRes, vaultRes, tripleRes] = await Promise.all([
      fetchGraphQL(atomQ, { ids: idsToQuery }),
      fetchGraphQL(vaultQ, { ids: idsToQuery }),
      fetchGraphQL(tripleQ, { ids: idsToQuery })
    ]);

    const atom = atomRes?.atoms?.[0];
    const vault = vaultRes?.vaults?.[0];
    const triple = tripleRes?.triples?.[0];

    if (!atom && !vault && !triple) {
       return { id: termId, label: 'Unknown Agent', description: '', image: null, type: 'ATOM', totalAssets: "0", totalShares: "0", currentSharePrice: "0", curveId: "0" };
    }

    const meta = atom ? resolveMetadata(atom) : { label: termId, description: '' };
    let resolvedLabel = meta.label;
    let description = meta.description;
    let type = (atom?.type || "ATOM").toUpperCase();

    if (triple) {
        const sMeta = resolveMetadata(triple.subject);
        const oMeta = resolveMetadata(triple.object);
        const subj = sMeta.label;
        const pred = triple.predicate?.label || 'LINKS TO';
        const obj = oMeta.label;
        resolvedLabel = `${subj} ${pred} ${obj}`;
        type = "CLAIM";
    }

    return {
      id: termId,
      label: resolvedLabel,
      description: description,
      image: atom?.image,
      type: type,
      creator: atom?.creator,
      totalAssets: vault?.total_assets ?? "0",
      totalShares: vault?.total_shares ?? "0",
      currentSharePrice: vault?.current_share_price ?? "0",
      curveId: vault?.curve_id ?? "0"
    };
  } catch (e) {
    return { id: termId, label: 'Agent (Offline)', description: '', image: null, type: 'ATOM', totalAssets: "0", totalShares: "0", currentSharePrice: "0", curveId: "0" };
  }
};

export const getUserHistory = async (userAddress: string): Promise<Transaction[]> => {
  const ids = [userAddress, userAddress.toLowerCase()];
  const query = `
    query GetUserHistory($ids: [String!]!) {
      deposits(where: { sender: { id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 500) {
        id
        shares
        assets
        created_at
        sender { id }
        vault { term_id }
      }
      redemptions(where: { receiver: { id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 500) {
        id
        shares
        assets
        created_at
        receiver { id }
        vault { term_id }
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { ids });
    const deposits = (data?.deposits ?? []).map((d: any) => ({
      id: d.id,
      type: "DEPOSIT",
      shares: d.shares,
      assets: d.assets || "0", 
      timestamp: new Date(d.created_at).getTime(),
      vaultId: d.vault?.term_id,
      assetLabel: d.vault?.term_id?.slice(0, 6),
      user: d.sender?.id
    }));
    const redeems = (data?.redemptions ?? []).map((r: any) => ({
      id: r.id,
      type: "REDEEM",
      shares: r.shares,
      assets: r.assets || "0", 
      timestamp: new Date(r.created_at).getTime(),
      vaultId: r.vault?.term_id,
      assetLabel: r.vault?.term_id?.slice(0, 6),
      user: r.receiver?.id
    }));
    return [...deposits, ...redeems].sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    return [];
  }
};

export const getUserPositions = async (address: string) => {
  const ids = [address, address.toLowerCase()];
  const query = `
    query GetPositions($where: positions_bool_exp) {
      positions(where: $where, limit: 500) {
        id
        shares
        account {
          id
          label
          image
        }
        vault {
          term {
            atom {
              term_id
              label
              image
              term {
                vaults(where: { curve_id: { _eq: "1" } }) {
                  term_id
                  total_shares
                  current_share_price
                }
              }
            }
            triple {
              term_id
              subject { term_id label image }
              predicate { term_id label image }
              object { term_id label image }
              term {
                vaults(where: { curve_id: { _eq: "2" } }) {
                  current_share_price
                }
              }
            }
          }
        }
      }
    }
  `;
  try {
    const data = await fetchGraphQL(query, { where: { account: { id: { _in: ids } }, shares: { _gt: "0" } } });
    return data?.positions ?? [];
  } catch (e) { return []; }
};

export const getNetworkStats = async () => {
  const query = `
    query GetNetworkStats {
      vaults_aggregate { aggregate { sum { total_assets } } }
      atoms_aggregate { aggregate { count } }
      triples_aggregate { aggregate { count } }
      positions_aggregate { aggregate { count } }
    }
  `;
  try {
    const data = await fetchGraphQL(query);
    return {
      tvl: data?.vaults_aggregate?.aggregate?.sum?.total_assets || "0",
      atoms: data?.atoms_aggregate?.aggregate?.count || 0,
      signals: data?.triples_aggregate?.aggregate?.count || 0,
      positions: data?.positions_aggregate?.aggregate?.count || 0
    };
  } catch (e) {
    return { tvl: "0", atoms: 0, signals: 0, positions: 0 };
  }
};

export const getAgentTriples = async (termId: string) => {
  const ids = [termId, termId.toLowerCase()];
  const query = `query ($ids: [String!]!) { triples(where: { _or: [ {subject: { term_id: { _in: $ids } }}, {object: { term_id: { _in: $ids } }} ] }, order_by: { block_number: desc }) { term_id subject { label term_id image data } predicate { label term_id } object { label term_id image data type } block_number } }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return data?.triples ?? [];
  } catch (e) {
    return [];
  }
};

export const getHoldersForVault = async (vaultId: string) => {
    const ids = [vaultId, vaultId.toLowerCase()];
    const query = `query ($ids: [String!]!) { 
      positions(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }, order_by: { shares: desc }, limit: 100) { 
        account { id label image } 
        shares 
        vault { curve_id } 
      }
      positions_aggregate(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }) {
        aggregate { count }
      }
    }`;
    try {
        const data = await fetchGraphQL(query, { ids });
        return {
          holders: data?.positions ?? [],
          totalCount: data?.positions_aggregate?.aggregate?.count || 0
        };
    } catch (e) { return { holders: [], totalCount: 0 }; }
};

export const getAtomInclusionLists = async (atomId: string) => {
    const ids = [atomId, atomId.toLowerCase()];
    const query = `query ($ids: [String!]!) { triples(where: { object: { term_id: { _in: $ids } } }, limit: 100) { subject { term_id label image type data } } }`;
    try {
        const data = await fetchGraphQL(query, { ids });
        const containers = (data?.triples ?? []).map((t: any) => t.subject).filter((s: any) => s && s.term_id && s.term_id !== atomId);
        const uniqueMap = new Map();
        containers.forEach((c: any) => {
            const meta = resolveMetadata(c);
            if (!uniqueMap.has(normalize(c.term_id)) && meta.label.length > 2 && !meta.label.startsWith('0x')) {
                uniqueMap.set(normalize(c.term_id), { ...c, label: meta.label });
            }
        });
        return Array.from(uniqueMap.values());
    } catch (e) { return []; }
};

export const getIdentitiesEngaged = async (atomId: string) => {
    const ids = [atomId, atomId.toLowerCase()];
    const query = `query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }, limit: 100) { object { term_id label image data type } predicate { label } } }`;
    try {
        const data = await fetchGraphQL(query, { ids });
        const engaged = (data?.triples ?? []).map((t: any) => ({ ...t.object, label: resolveMetadata(t.object).label, predicate: t.predicate?.label })).filter(e => e.term_id);
        return Array.from(new Map(engaged.map((e: any) => [normalize(e.term_id), e])).values());
    } catch (e) { return []; }
};

export const getTopPositions = async () => {
   const query = `query { positions(limit: 200, order_by: { shares: desc }, where: { shares: { _gt: "0" } }) { account { id label image } shares vault { term_id } } }`;
   try {
     const data = await fetchGraphQL(query);
     const positions = data?.positions ?? [];
     if (positions.length === 0) return [];
     const termIds = Array.from(new Set(positions.map((p: any) => p.vault?.term_id).filter(Boolean))) as string[];
     let atoms: any[] = [];
     if (termIds.length > 0) {
         const queryIds = Array.from(new Set([...termIds, ...termIds.map(id => id.toLowerCase())]));
         const chunks = chunkArray(queryIds, 200);
         for (const chunk of chunks) {
             const atomQuery = `query ($ids: [String!]!) { atoms(where: { term_id: { _in: $ids } }) { term_id label data image } }`;
             const atomData = await fetchGraphQL(atomQuery, { ids: chunk });
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
    const pattern = `%${term}%`;
    const isLikelyAddress = term.startsWith('0x') && term.length > 10;
    const atomQuery = `query ($pattern: String!) { atoms(where: { label: { _ilike: $pattern } }, limit: 50) { term_id label data image type creator { id label } } }`;
    const vaultQuery = `query ($id: String!) { vaults(where: { term_id: { _eq: $id } }) { term_id total_assets total_shares current_share_price curve_id } }`;
    try {
        const promises = [fetchGraphQL(atomQuery, { pattern })];
        if (isLikelyAddress) promises.push(fetchGraphQL(vaultQuery, { id: term }));
        const results = await Promise.all(promises);
        const atoms = results[0]?.atoms ?? [];
        const addressVault = isLikelyAddress ? (results[1]?.vaults ?? []) : [];
        const atomIds = atoms.map((a: any) => a.term_id);
        let vaultsForAtoms: any[] = [];
        if (atomIds.length > 0) {
             const vQ = `query ($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id } }`;
             const vData = await fetchGraphQL(vQ, { ids: atomIds });
             vaultsForAtoms = vData?.vaults ?? [];
        }
        let atomForVault: any = null;
        if (addressVault.length > 0) {
             const aQ = `query ($id: String!) { atoms(where: { term_id: { _eq: $id } }) { term_id label data image type creator { id label } } }`;
             const aData = await fetchGraphQL(aQ, { id: addressVault[0].term_id });
             atomForVault = aData?.atoms?.[0];
        }
        const formattedAtoms = atoms.map((a: any) => {
             const matchingVaults = vaultsForAtoms.filter((v: any) => normalize(v.term_id) === normalize(a.term_id));
             const bestVault = matchingVaults.sort((x:any, y:any) => BigInt(y.total_assets || 0) > BigInt(x.total_assets || 0) ? 1 : -1)[0];
             const meta = resolveMetadata(a);
             return { id: a.term_id, label: meta.label, description: meta.description, image: a.image, type: (a.type || "ATOM").toUpperCase(), creator: a.creator, totalAssets: bestVault?.total_assets ?? "0", totalShares: bestVault?.total_shares ?? "0", currentSharePrice: bestVault?.current_share_price ?? "0", curveId: bestVault?.curve_id ?? "0" };
        });
        let formattedVault = addressVault.length > 0 ? [{ id: addressVault[0].term_id, label: resolveMetadata(atomForVault).label, description: resolveMetadata(atomForVault).description, image: atomForVault?.image, type: (atomForVault?.type || "ATOM").toUpperCase(), creator: atomForVault?.creator, totalAssets: addressVault[0].total_assets, totalShares: addressVault[0].total_shares, currentSharePrice: addressVault[0].current_share_price, curveId: addressVault[0].curve_id }] : [];
        const combined = [...formattedVault, ...formattedAtoms];
        return combined.filter((obj, index, self) => index === self.findIndex((t) => (t.id === obj.id)));
    } catch (e) { return []; }
};

export const getGlobalClaims = async (): Promise<Claim[]> => {
  if (isGlobalClaimsFetching) return [];
  isGlobalClaimsFetching = true;

  const query = `query { 
    triples(order_by: { block_number: desc }, limit: 75) { 
      term_id 
      block_number 
      transaction_hash 
      created_at 
      subject { term_id label data image type } 
      predicate { term_id label } 
      object { term_id label data image type } 
    } 
  }`;

  try {
    const data = await fetchGraphQL(query);
    const triples = data?.triples ?? [];
    const results = triples.map((t: any) => {
      if (!t.subject || !t.object) return null;
      const predLabelRaw = t.predicate?.label || 'SIGNAL';
      const predLabelLower = predLabelRaw.toLowerCase().trim();
      let sentiment = 'SIGNAL'; 
      if (predLabelLower.includes('support') || predLabelLower.includes('trust') || predLabelLower.includes('like')) sentiment = 'TRUST';
      else if (predLabelLower.includes('oppose') || predLabelLower.includes('distrust') || predLabelLower.includes('dislike')) sentiment = 'DISTRUST';
      else sentiment = predLabelRaw.toUpperCase();
      
      const sMeta = resolveMetadata(t.subject);
      const oMeta = resolveMetadata(t.object);

      return { id: t.term_id || t.transaction_hash, subject: { id: t.subject?.term_id, label: sMeta.label, image: t.subject?.image }, predicate: sentiment, object: { id: t.object?.term_id, label: oMeta.label, image: t.object?.image, type: (t.object?.type || 'ATOM').toUpperCase() }, confidence: 75, timestamp: t.created_at ? new Date(t.created_at).getTime() : Date.now(), txHash: t.transaction_hash, block: t.block_number, reason: oMeta.description || t.object?.label?.length > 20 ? t.object.label : undefined };
    }).filter(Boolean) as Claim[];
    
    return results;
  } catch (e) { 
    return []; 
  } finally {
    isGlobalClaimsFetching = false;
  }
};

export const getTopClaims = async () => {
  const query = `query { vaults(limit: 300, order_by: { total_assets: desc }, where: { total_assets: { _gt: "0" } }) { term_id total_assets total_shares current_share_price } }`;
  try {
    const data = await fetchGraphQL(query);
    const vaults = data?.vaults || [];
    if (vaults.length === 0) return [];
    const termIds = vaults.map((v: any) => v.term_id);
    const tripleQuery = `query ($ids: [String!]!) { triples(where: { term_id: { _in: $ids } }) { term_id subject { term_id label image type data } predicate { term_id label } object { term_id label image type data } } }`;
    const triplesData = await fetchGraphQL(tripleQuery, { ids: termIds });
    const triples = triplesData?.triples || [];
    return triples.map((t: any) => {
        const vault = vaults.find((v: any) => normalize(v.term_id) === normalize(t.term_id));
        let marketCapNum = 0;
        if (vault) {
            const shares = parseFloat(formatEther(BigInt(vault.total_shares || '0')));
            const price = vault.current_share_price && vault.current_share_price !== "0" 
                ? parseFloat(formatEther(BigInt(vault.current_share_price)))
                : (parseFloat(formatEther(BigInt(vault.total_assets || '0'))) / shares || 0.1);
            marketCapNum = shares * price;
        }
        return { 
          id: t.term_id, 
          subject: { id: t.subject?.term_id, label: resolveMetadata(t.subject).label, image: t.subject?.image }, 
          predicate: t.predicate?.label || 'LINK', 
          object: { id: t.object?.term_id, label: resolveMetadata(t.object).label, image: t.object?.image }, 
          value: marketCapNum 
        };
    }).sort((a: any, b: any) => b.value - a.value);
  } catch (e) { return []; }
};

export const getAgentOpinions = async (termId: string) => {
  const ids = [termId, termId.toLowerCase()];
  const query = `query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }, order_by: { block_number: desc }, limit: 100) { predicate { label } object { label data } block_number } }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return (data?.triples ?? []).map((t: any) => {
      const predLabel = (t.predicate?.label || '').toLowerCase().trim();
      const oMeta = resolveMetadata(t.object);
      return { id: Math.random(), text: oMeta.label, isBullish: predLabel.includes("trust") || predLabel.includes("support"), timestamp: Date.now() };
    });
  } catch (e) { return []; }
};

export const getVaultsByIds = async (ids: string[]) => {
    if (ids.length === 0) return [];
    const queryIds = Array.from(new Set([...ids, ...ids.map(id => id.toLowerCase())]));
    const query = `query ($ids: [String!]!) { atoms(where: { term_id: { _in: $ids } }) { term_id label data image type } vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id } }`;
    try {
        const data = await fetchGraphQL(query, { ids: queryIds });
        const atoms = data?.atoms ?? [];
        const vaults = data?.vaults ?? [];
        return vaults.map((v: any) => {
             const a = atoms.find((atom: any) => normalize(atom.term_id) === normalize(v.term_id));
             const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '' };
             return { id: v.term_id, label: meta.label, description: meta.description, image: a?.image, type: (a?.type || 'ATOM').toUpperCase(), curveId: v.curve_id, currentSharePrice: v.current_share_price, totalAssets: v.total_assets, totalShares: v.total_shares };
        });
    } catch (e) { return []; }
};

export const getLists = async () => {
  const query = `query { atoms(limit: 200, where: { image: { _is_null: false } }) { term_id label image type data creator { id label } } }`;
  try {
      const data = await fetchGraphQL(query);
      const listAtoms = data?.atoms || [];
      if (listAtoms.length === 0) return [];
      const listIds = listAtoms.map((a: any) => a.term_id);
      const triplesQuery = `query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }, limit: 1000) { subject { term_id } object { term_id label data image } } }`;
      const triplesData = await fetchGraphQL(triplesQuery, { ids: listIds });
      const triples = triplesData?.triples || [];
      return listAtoms.map((atom: any) => {
          const items = triples.filter((t: any) => normalize(t.subject?.term_id) === normalize(atom.term_id)).map((t: any) => t.object).filter((obj: any) => obj && (obj.image || obj.label));
          const uniqueItems = Array.from(new Map(items.map((i:any) => [i.term_id, i])).values());
          const meta = resolveMetadata(atom);
          return { id: atom.term_id, label: meta.label, description: meta.description, image: atom.image, type: 'LIST', creator: atom.creator, items: uniqueItems.slice(0, 10), totalItems: uniqueItems.length };
      });
  } catch (e) { return []; }
};

export const getMarketActivity = async (termId: string): Promise<Transaction[]> => {
  const ids = [termId, termId.toLowerCase()];
  const query = `
    query GetMarketActivity ($ids: [String!]!) {
      deposits(where: { vault: { term_id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 50) {
        id
        shares
        assets
        created_at
        sender { id }
      }
      redemptions(where: { vault: { term_id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 50) {
        id
        shares
        assets
        created_at
        receiver { id }
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { ids });
    const deposits = (data?.deposits ?? []).map((d: any) => ({
      id: d.id,
      type: "DEPOSIT",
      shares: d.shares,
      assets: d.assets || "0",
      timestamp: new Date(d.created_at).getTime(),
      vaultId: termId,
      assetLabel: "Share",
      user: d.sender?.id
    }));
    const redeems = (data?.redemptions ?? []).map((r: any) => ({
      id: r.id,
      type: "REDEEM",
      shares: r.shares,
      assets: r.assets || "0",
      timestamp: new Date(r.created_at).getTime(),
      vaultId: termId,
      assetLabel: "Share",
      user: r.receiver?.id
    }));
    return [...deposits, ...redeems].sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    return [];
  }
};

export const getIncomingTriplesForStats = async (termId: string) => {
  const ids = [termId, termId.toLowerCase()];
  const query = `query ($ids: [String!]!) { 
    triples(where: { object: { term_id: { _in: $ids } } }, limit: 50, order_by: { block_number: desc }) { 
      term_id subject { label term_id data image type } predicate { label term_id } block_number 
    }
    triples_aggregate(where: { object: { term_id: { _in: $ids } } }) {
      aggregate { count }
    }
  }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return {
      triples: data?.triples ?? [],
      totalCount: data?.triples_aggregate?.aggregate?.count || 0
    };
  } catch (e) {
    return { triples: [], totalCount: 0 };
  }
};