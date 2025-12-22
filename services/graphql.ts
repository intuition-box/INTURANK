
import { GRAPHQL_URL } from '../constants';
import { Transaction, Claim } from '../types';
import { hexToString, formatEther, parseEther } from 'viem';

// -------------------------------------------------------
// BASIC FETCH WRAPPER WITH TIMEOUT
// -------------------------------------------------------
const fetchGraphQL = async (query: string, variables: any = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); 

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
    if (error.name === 'AbortError') {
      console.warn("GraphQL Request Timed Out");
    } else {
      console.warn("GraphQL Network Error:", error);
    }
    return { data: null };
  }
};

const normalize = (x: string) => x ? x.toLowerCase() : '';

const resolveLabel = (atom: any, fallbackId: string) => {
    if (atom?.label && atom.label !== '0x' && !atom.label.startsWith('0x00')) {
        return atom.label;
    }
    if (atom?.data && atom.data !== '0x') {
        try {
            const raw = atom.data.startsWith('0x') ? atom.data : `0x${atom.data}`;
            const decoded = hexToString(raw as `0x${string}`);
            const cleaned = decoded.replace(/\0/g, '').trim();
            if (cleaned && cleaned.length > 0) return cleaned;
        } catch (e) {}
    }
    return fallbackId ? `${fallbackId.slice(0, 6)}...` : 'Unknown';
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
          subject { label term_id image } 
          predicate { label }
          object { label term_id image }
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
      let label = resolveLabel(a, v.term_id);
      let type = (a?.type || "ATOM").toUpperCase();
      let image = a?.image;

      if (t) {
          const subj = t.subject?.label || '...';
          const pred = t.predicate?.label || 'LINK';
          const obj = t.object?.label || '...';
          if (subj !== '...' || obj !== '...') {
              label = `${subj} ${pred} ${obj}`;
              type = "CLAIM";
              image = t.subject?.image || t.object?.image;
          }
      }

      return {
        id: v.term_id,
        label: label,
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
       return { id: termId, label: 'Unknown Agent', image: null, type: 'ATOM', totalAssets: "0", totalShares: "0", currentSharePrice: "0", curveId: "0" };
    }

    let resolvedLabel = 'Agent (Unlabeled)';
    let type = (atom?.type || "ATOM").toUpperCase();

    if (triple) {
        const subj = resolveLabel(triple.subject, triple.subject?.term_id);
        const pred = triple.predicate?.label || 'LINKS TO';
        const obj = resolveLabel(triple.object, triple.object?.term_id);
        resolvedLabel = `${subj} ${pred} ${obj}`;
        type = "CLAIM";
    } else {
        resolvedLabel = resolveLabel(atom, termId);
    }

    return {
      id: termId,
      label: resolvedLabel,
      image: atom?.image,
      type: type,
      creator: atom?.creator,
      totalAssets: vault?.total_assets ?? "0",
      totalShares: vault?.total_shares ?? "0",
      currentSharePrice: vault?.current_share_price ?? "0",
      curveId: vault?.curve_id ?? "0"
    };
  } catch (e) {
    return { id: termId, label: 'Agent (Offline)', image: null, type: 'ATOM', totalAssets: "0", totalShares: "0", currentSharePrice: "0", curveId: "0" };
  }
};

export const getUserHistory = async (userAddress: string): Promise<Transaction[]> => {
  const ids = [userAddress, userAddress.toLowerCase()];
  const query = `
    query GetUserHistory($ids: [String!]!) {
      deposits(where: { sender: { id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 100) {
        id
        shares
        created_at
        sender { id }
        vault { term_id }
      }
      redemptions(where: { receiver: { id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 100) {
        id
        shares
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
      assets: "0", 
      timestamp: new Date(d.created_at).getTime(),
      vaultId: d.vault?.term_id,
      assetLabel: d.vault?.term_id?.slice(0, 6),
      user: d.sender?.id
    }));
    const redeems = (data?.redemptions ?? []).map((r: any) => ({
      id: r.id,
      type: "REDEEM",
      shares: r.shares,
      assets: "0", 
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
  const query = `query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }) { term_id predicate { label term_id } object { label term_id image type } block_number } }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return data?.triples ?? [];
  } catch (e) {
    return [];
  }
};

export const getIncomingTriples = async (termId: string) => {
  const ids = [termId, termId.toLowerCase()];
  const query = `query ($ids: [String!]!) { triples(where: { object: { term_id: { _in: $ids } } }, limit: 50, order_by: { block_number: desc }) { term_id subject { label term_id image type } predicate { label term_id } block_number } }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return data?.triples ?? [];
  } catch (e) {
    return [];
  }
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
             // Fix: correctly reference the 'atoms' variable defined in local scope
             if (atomData?.atoms) atoms = [...atoms, ...atomData.atoms];
         }
     }
     return positions.map((p: any) => {
         const atom = atoms.find((a: any) => normalize(a.term_id) === normalize(p.vault?.term_id));
         return { ...p, vault: { ...p.vault, atom: atom ? { label: resolveLabel(atom, p.vault.term_id), image: atom.image } : null } };
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
             return { id: a.term_id, label: resolveLabel(a, a.term_id), image: a.image, type: (a.type || "ATOM").toUpperCase(), creator: a.creator, totalAssets: bestVault?.total_assets ?? "0", totalShares: bestVault?.total_shares ?? "0", currentSharePrice: bestVault?.current_share_price ?? "0", curveId: bestVault?.curve_id ?? "0" };
        });
        let formattedVault = addressVault.length > 0 ? [{ id: addressVault[0].term_id, label: resolveLabel(atomForVault, addressVault[0].term_id), image: atomForVault?.image, type: (atomForVault?.type || "ATOM").toUpperCase(), creator: atomForVault?.creator, totalAssets: addressVault[0].total_assets, totalShares: addressVault[0].total_shares, currentSharePrice: addressVault[0].current_share_price, curveId: addressVault[0].curve_id }] : [];
        const combined = [...formattedVault, ...formattedAtoms];
        return combined.filter((obj, index, self) => index === self.findIndex((t) => (t.id === obj.id)));
    } catch (e) { return []; }
};

export const getGlobalClaims = async (): Promise<Claim[]> => {
  const query = `query { triples(order_by: { block_number: desc }, limit: 300) { term_id block_number transaction_hash created_at subject { term_id label data image type } predicate { term_id label } object { term_id label data image type } } }`;
  try {
    const data = await fetchGraphQL(query);
    const triples = data?.triples ?? [];
    return triples.map((t: any) => {
      if (!t.subject || !t.object) return null;
      const predLabelRaw = t.predicate?.label || 'SIGNAL';
      const predLabelLower = predLabelRaw.toLowerCase().trim();
      let sentiment = 'SIGNAL'; 
      if (predLabelLower.includes('support') || predLabelLower.includes('trust') || predLabelLower.includes('like')) sentiment = 'TRUST';
      else if (predLabelLower.includes('oppose') || predLabelLower.includes('distrust') || predLabelLower.includes('dislike')) sentiment = 'DISTRUST';
      else sentiment = predLabelRaw.toUpperCase();
      return { id: t.term_id || t.transaction_hash, subject: { id: t.subject?.term_id, label: resolveLabel(t.subject, t.subject?.term_id), image: t.subject?.image }, predicate: sentiment, object: { id: t.object?.term_id, label: resolveLabel(t.object, t.object?.term_id), image: t.object?.image, type: (t.object?.type || 'ATOM').toUpperCase() }, confidence: 75, timestamp: t.created_at ? new Date(t.created_at).getTime() : Date.now(), txHash: t.transaction_hash, block: t.block_number, reason: t.object?.label?.length > 20 ? t.object.label : undefined };
    }).filter(Boolean) as Claim[];
  } catch (e) { return []; }
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
        let marketCapWei = BigInt(0);
        if (vault) {
            const shares = BigInt(vault.total_shares || '0');
            const spotPrice = BigInt(vault.current_share_price || '0');
            marketCapWei = spotPrice > 0 ? (shares * spotPrice) / BigInt(1e18) : BigInt(vault.total_assets || '0');
        }
        return { id: t.term_id, subject: { id: t.subject?.term_id, label: resolveLabel(t.subject, t.subject?.term_id), image: t.subject?.image }, predicate: t.predicate?.label || 'LINK', object: { id: t.object?.term_id, label: resolveLabel(t.object, t.object?.term_id), image: t.object?.image }, value: marketCapWei.toString() };
    }).sort((a: any, b: any) => BigInt(b.value) > BigInt(a.value) ? 1 : -1);
  } catch (e) { return []; }
};

export const getAgentOpinions = async (termId: string) => {
  const ids = [termId, termId.toLowerCase()];
  const query = `query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }, order_by: { block_number: desc }, limit: 100) { predicate { label } object { label } block_number } }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return (data?.triples ?? []).map((t: any) => {
      const predLabel = (t.predicate?.label || '').toLowerCase().trim();
      return { id: Math.random(), text: t.object?.label, isBullish: predLabel.includes("trust") || predLabel.includes("support"), timestamp: Date.now() };
    });
  } catch (e) { return []; }
};

export const getUserPositions = async (address: string) => {
  const ids = [address, address.toLowerCase()];
  const query = `query ($ids: [String!]!) { positions(where: { account: { id: { _in: $ids } } }) { shares vault { term_id total_assets total_shares curve_id } } }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return data?.positions ?? [];
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
             return { id: v.term_id, label: resolveLabel(a, v.term_id), image: a?.image, type: (a?.type || 'ATOM').toUpperCase(), curveId: v.curve_id, currentSharePrice: v.current_share_price };
        });
    } catch (e) { return []; }
};

export const getLists = async () => {
  const query = `query { atoms(limit: 200, where: { image: { _is_null: false } }) { term_id label image type creator { id label } } }`;
  try {
      const data = await fetchGraphQL(query);
      const listAtoms = data?.atoms || [];
      if (listAtoms.length === 0) return [];
      const listIds = listAtoms.map((a: any) => a.term_id);
      const triplesQuery = `query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }, limit: 1000) { subject { term_id } object { term_id label image } } }`;
      const triplesData = await fetchGraphQL(triplesQuery, { ids: listIds });
      const triples = triplesData?.triples || [];
      return listAtoms.map((atom: any) => {
          const items = triples.filter((t: any) => normalize(t.subject?.term_id) === normalize(atom.term_id)).map((t: any) => t.object).filter((obj: any) => obj && (obj.image || obj.label));
          const uniqueItems = Array.from(new Map(items.map((i:any) => [i.term_id, i])).values());
          return { id: atom.term_id, label: resolveLabel(atom, atom.term_id), image: atom.image, type: 'LIST', creator: atom.creator, items: uniqueItems.slice(0, 10), totalItems: uniqueItems.length };
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
        created_at
        sender { id }
      }
      redemptions(where: { vault: { term_id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 50) {
        id
        shares
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
      assets: "0",
      timestamp: new Date(d.created_at).getTime(),
      vaultId: termId,
      assetLabel: "Share",
      user: d.sender?.id
    }));
    const redeems = (data?.redemptions ?? []).map((r: any) => ({
      id: r.id,
      type: "REDEEM",
      shares: r.shares,
      assets: "0",
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
  const query = `query ($ids: [String!]!) { triples(where: { object: { term_id: { _in: $ids } } }, limit: 50, order_by: { block_number: desc }) { term_id subject { label term_id image type } predicate { label term_id } block_number } }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return data?.triples ?? [];
  } catch (e) {
    return [];
  }
};
