import { GRAPHQL_URL } from '../constants';
import { Transaction, Claim } from '../types';
import { hexToString } from 'viem';

// -------------------------------------------------------
// BASIC FETCH WRAPPER WITH TIMEOUT
// -------------------------------------------------------
const fetchGraphQL = async (query: string, variables: any = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s

  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: 'no-store' // CRITICAL: Prevent browser caching to ensure live feed updates
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

const cleanString = (str: string) => {
  // Remove non-printable characters and trim
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
};

const resolveLabel = (atom: any, fallbackId: string) => {
    // 1. Try explicit label
    if (atom?.label && atom.label !== '0x' && !atom.label.startsWith('0x00')) {
        return atom.label;
    }

    // 2. Try decoding data
    if (atom?.data && atom.data !== '0x') {
        try {
            const decoded = hexToString(atom.data as `0x${string}`);
            const cleaned = cleanString(decoded);
            // Ensure it looks like a valid name (at least 2 chars, not just whitespace)
            if (cleaned && cleaned.length > 1) return cleaned;
        } catch (e) {
            // ignore decode error
        }
    }

    // 3. Fallback to ID
    return `Agent ${fallbackId.slice(0, 6)}...`;
};

// Helper to chunk arrays to avoid GraphQL query limits
const chunkArray = (array: any[], size: number) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

// -------------------------------------------------------
// 1. GET ALL AGENTS
// -------------------------------------------------------
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

    // DEDUPLICATION: Keep only the first occurrence of each term_id
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
    
    // ROBUST ID COLLECTION: Collect both raw and lowercase IDs to ensure hits
    const queryIds = Array.from(new Set([
        ...termIds, 
        ...termIds.map(id => id.toLowerCase())
    ]));

    const atomQuery = `
      query GetAtoms ($ids: [String!]!) {
        atoms(where: { term_id: { _in: $ids } }) {
          term_id
          label
          data
          image
          type
          creator { id label }
        }
      }
    `;

    // Process in chunks
    const idChunks = chunkArray(queryIds, 200);
    let allAtoms: any[] = [];

    for (const chunk of idChunks) {
        const chunkData = await fetchGraphQL(atomQuery, { ids: chunk });
        if (chunkData?.atoms) {
            allAtoms = [...allAtoms, ...chunkData.atoms];
        }
    }

    return vaults.map((v: any) => {
      const a = allAtoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));

      return {
        id: v.term_id,
        label: resolveLabel(a, v.term_id),
        image: a?.image,
        type: a?.type || "ATOM",
        creator: a?.creator,
        totalAssets: v.total_assets,
        totalShares: v.total_shares,
        currentSharePrice: v.current_share_price,
        curveId: v.curve_id
      };
    });
  } catch (e) {
    console.warn("getAllAgents failed:", e);
    return [];
  }
};

// -------------------------------------------------------
// 2. GET AGENT BY ID
// -------------------------------------------------------
export const getAgentById = async (termId: string) => {
  const idLower = termId.toLowerCase();
  
  // Try finding by raw ID or lowercase ID to catch edge cases
  const atomQ = `
    query GetAtomDetails ($ids: [String!]!) {
      atoms(where: { term_id: { _in: $ids } }) {
        term_id
        label
        data
        image
        type
        creator { id label }
      }
    }
  `;

  const vaultQ = `
    query GetVaultDetails ($ids: [String!]!) {
      vaults(where: { term_id: { _in: $ids } }, order_by: { total_assets: desc }, limit: 1) {
        term_id
        total_assets
        total_shares
        current_share_price
        curve_id
      }
    }
  `;

  const idsToQuery = [termId, idLower];

  try {
    const [atomRes, vaultRes] = await Promise.all([
      fetchGraphQL(atomQ, { ids: idsToQuery }),
      fetchGraphQL(vaultQ, { ids: idsToQuery })
    ]);

    const atom = atomRes?.atoms?.[0];
    const vault = vaultRes?.vaults?.[0];

    if (!atom && !vault) {
       return {
          id: termId,
          label: 'Unknown Agent',
          image: null,
          type: 'ATOM',
          totalAssets: "0",
          totalShares: "0",
          currentSharePrice: "0",
          curveId: "0"
       };
    }

    return {
      id: termId,
      label: resolveLabel(atom, termId),
      image: atom?.image,
      type: atom?.type || "ATOM",
      creator: atom?.creator,
      totalAssets: vault?.total_assets ?? "0",
      totalShares: vault?.total_shares ?? "0",
      currentSharePrice: vault?.current_share_price ?? "0",
      curveId: vault?.curve_id ?? "0"
    };
  } catch (e) {
    console.warn("getAgentById failed:", e);
    return {
       id: termId,
       label: 'Agent (Offline)',
       image: null,
       type: 'ATOM',
       totalAssets: "0",
       totalShares: "0",
       currentSharePrice: "0",
       curveId: "0"
    };
  }
};

// -------------------------------------------------------
// 3. TRIPLES (Agent Profile - Outgoing)
// -------------------------------------------------------
export const getAgentTriples = async (termId: string) => {
  const ids = [termId, termId.toLowerCase()];
  const query = `
    query GetAgentTriples ($ids: [String!]!) {
      triples(where: { subject: { term_id: { _in: $ids } } }) {
        predicate { label term_id }
        object { label term_id image type }
        block_number
      }
    }
  `;
  try {
    const data = await fetchGraphQL(query, { ids });
    return data?.triples ?? [];
  } catch (e) {
    return [];
  }
};

// -------------------------------------------------------
// 3b. INCOMING TRIPLES (Who is signaling ON this agent?)
// -------------------------------------------------------
export const getIncomingTriples = async (termId: string) => {
  const ids = [termId, termId.toLowerCase()];
  const query = `
    query GetIncomingTriples ($ids: [String!]!) {
      triples(
        where: { object: { term_id: { _in: $ids } } }
        limit: 20
        order_by: { block_number: desc }
      ) {
        subject { label term_id image type }
        predicate { label term_id }
        block_number
      }
    }
  `;
  try {
    const data = await fetchGraphQL(query, { ids });
    return data?.triples ?? [];
  } catch (e) {
    return [];
  }
};

// -------------------------------------------------------
// 4. OPINIONS (Agent Profile)
// -------------------------------------------------------
export const getAgentOpinions = async (termId: string) => {
  const ids = [termId, termId.toLowerCase()];
  const query = `
    query GetAgentOpinions ($ids: [String!]!) {
      triples(
        where: { subject: { term_id: { _in: $ids } } }
        order_by: { block_number: desc }
        limit: 40
      ) {
        predicate { label }
        object { label }
        block_number
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { ids });

    return (data?.triples ?? []).map((t: any) => {
      const predLabel = (t.predicate?.label || '').toLowerCase().trim();
      const isBullish = 
        predLabel === 'support' ||
        predLabel.includes("trust") ||
        predLabel.includes("support") ||
        predLabel.includes("bull") ||
        predLabel.includes("like");

      return {
        id: Math.random(),
        text: t.object?.label,
        isBullish,
        timestamp: Date.now()
      };
    });
  } catch (e) {
    return [];
  }
};

// -------------------------------------------------------
// 5. USER POSITIONS
// -------------------------------------------------------
export const getUserPositions = async (address: string) => {
  // Robust case-handling: Query both raw and lowercase address
  const ids = [address, address.toLowerCase()];
  
  const query = `
    query GetUserPositions ($ids: [String!]!) {
      positions(where: { account: { id: { _in: $ids } } }) {
        shares
        vault { term_id total_assets total_shares curve_id }
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { ids });
    return data?.positions ?? [];
  } catch (e) {
    console.warn("getUserPositions failed:", e);
    return [];
  }
};

// -------------------------------------------------------
// 6. USER HISTORY
// -------------------------------------------------------
export const getUserHistory = async (
  userAddress: string
): Promise<Transaction[]> => {

  const ids = [userAddress, userAddress.toLowerCase()];

  // Removed 'assets' from selection as it may not exist in this subgraph version
  const query = `
    query GetUserHistory($ids: [String!]!) {
      deposits(
        where: { sender: { id: { _in: $ids } } }
        order_by: { created_at: desc }
        limit: 20
      ) {
        id
        shares
        created_at
        sender { id }
        vault { term_id }
      }

      redemptions(
        where: { receiver: { id: { _in: $ids } } }
        order_by: { created_at: desc }
        limit: 20
      ) {
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
      assets: "0", // Fallback as assets field removed
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
    console.warn("History fetch failed:", e);
    return [];
  }
};

// -------------------------------------------------------
// 7. VAULT DETAILS BY ID
// -------------------------------------------------------
export const getVaultsByIds = async (ids: string[]) => {
    if (ids.length === 0) return [];
    
    // Robust ID query
    const queryIds = Array.from(new Set([
        ...ids, 
        ...ids.map(id => id.toLowerCase())
    ]));

    const query = `
      query GetVaultsByIds ($ids: [String!]!) {
        atoms(where: { term_id: { _in: $ids } }) {
          term_id
          label
          data
          image
          type
        }
        vaults(where: { term_id: { _in: $ids } }) {
          term_id
          total_assets
          total_shares
          current_share_price
          curve_id
        }
      }
    `;

    try {
        const data = await fetchGraphQL(query, { ids: queryIds });
        const atoms = data?.atoms ?? [];
        const vaults = data?.vaults ?? [];

        return vaults.map((v: any) => {
             const a = atoms.find((atom: any) => normalize(atom.term_id) === normalize(v.term_id));
             return {
                 id: v.term_id,
                 label: resolveLabel(a, v.term_id),
                 image: a?.image,
                 type: a?.type || 'ATOM',
                 curveId: v.curve_id,
                 currentSharePrice: v.current_share_price
             };
        });
    } catch (e) {
        console.warn("getVaultsByIds failed", e);
        return [];
    }
};

// -------------------------------------------------------
// 8. GET NETWORK STATS
// -------------------------------------------------------
export const getNetworkStats = async () => {
  const query = `
    query GetNetworkStats {
      vaults_aggregate {
        aggregate {
          sum { total_assets }
        }
      }
      atoms_aggregate {
        aggregate {
          count
        }
      }
      triples_aggregate {
        aggregate {
          count
        }
      }
      positions_aggregate {
        aggregate {
          count
        }
      }
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

// -------------------------------------------------------
// 9. GET TOP POSITIONS (LEADERBOARD)
// -------------------------------------------------------
export const getTopPositions = async () => {
   const query = `
     query GetTopPositions {
       positions(limit: 100, order_by: { shares: desc }, where: { shares: { _gt: "0" } }) {
         account { id label image }
         shares
         vault { 
           term_id 
         }
       }
     }
   `;

   try {
     const data = await fetchGraphQL(query);
     const positions = data?.positions ?? [];
     
     if (positions.length === 0) return [];

     const termIds = Array.from(new Set(positions.map((p: any) => p.vault?.term_id).filter(Boolean))) as string[];

     let atoms: any[] = [];
     if (termIds.length > 0) {
         // Query BOTH raw and lowercase to be safe
         const queryIds = Array.from(new Set([
             ...termIds, 
             ...termIds.map(id => id.toLowerCase())
         ]));

         const chunks = chunkArray(queryIds, 200);
         for (const chunk of chunks) {
             const atomQuery = `query ($ids: [String!]!) { atoms(where: { term_id: { _in: $ids } }) { term_id label data image } }`;
             const atomData = await fetchGraphQL(atomQuery, { ids: chunk });
             if (atomData?.atoms) atoms = [...atoms, ...atomData.atoms];
         }
     }

     return positions.map((p: any) => {
         const atom = atoms.find((a: any) => normalize(a.term_id) === normalize(p.vault?.term_id));
         return {
             ...p,
             vault: {
                 ...p.vault,
                 atom: atom ? { 
                     label: resolveLabel(atom, p.vault.term_id),
                     image: atom.image 
                 } : null
             }
         };
     });

   } catch (e) {
     console.warn("getTopPositions failed:", e);
     return [];
   }
};

// -------------------------------------------------------
// 10. GET MARKET ACTIVITY
// -------------------------------------------------------
export const getMarketActivity = async (termId: string): Promise<Transaction[]> => {
  const ids = [termId, termId.toLowerCase()];
  
  const query = `
    query GetMarketActivity ($ids: [String!]!) {
      deposits(
        where: { vault: { term_id: { _in: $ids } } }
        order_by: { created_at: desc }
        limit: 20
      ) {
        id
        shares
        created_at
        sender { id }
      }
      redemptions(
        where: { vault: { term_id: { _in: $ids } } }
        order_by: { created_at: desc }
        limit: 20
      ) {
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
    console.warn("Market activity fetch failed:", e);
    return [];
  }
};

// -------------------------------------------------------
// 10b. GET ALL MARKET ACTIVITY
// -------------------------------------------------------
export const getAllMarketActivity = async (termId: string): Promise<Transaction[]> => {
  const ids = [termId, termId.toLowerCase()];
  const query = `
    query GetAllMarketActivity ($ids: [String!]!) {
      deposits(
        where: { vault: { term_id: { _in: $ids } } }
        order_by: { created_at: desc }
        limit: 1000
      ) {
        id
        shares
        created_at
      }
      redemptions(
        where: { vault: { term_id: { _in: $ids } } }
        order_by: { created_at: desc }
        limit: 1000
      ) {
        id
        shares
        created_at
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
    }));

    const redeems = (data?.redemptions ?? []).map((r: any) => ({
      id: r.id,
      type: "REDEEM",
      shares: r.shares,
      assets: "0",
      timestamp: new Date(r.created_at).getTime(),
    }));

    return [...deposits, ...redeems].sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    return [];
  }
};

// -------------------------------------------------------
// 11. SEARCH GLOBAL AGENTS
// -------------------------------------------------------
export const searchGlobalAgents = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    const term = searchTerm.toLowerCase().trim();
    const pattern = `%${term}%`;
    const isLikelyAddress = term.startsWith('0x') && term.length > 10;

    const atomQuery = `
      query SearchAtoms ($pattern: String!) {
        atoms(where: { label: { _ilike: $pattern } }, limit: 20) {
          term_id
          label
          data
          image
          type
          creator { id label }
        }
      }
    `;

    const vaultQuery = `
      query SearchVaults ($id: String!) {
        vaults(where: { term_id: { _eq: $id } }) {
          term_id
          total_assets
          total_shares
          current_share_price
          curve_id
        }
      }
    `;

    try {
        const promises = [fetchGraphQL(atomQuery, { pattern })];
        if (isLikelyAddress) {
            promises.push(fetchGraphQL(vaultQuery, { id: term }));
        }

        const results = await Promise.all(promises);
        const atoms = results[0]?.atoms ?? [];
        const addressVault = isLikelyAddress ? (results[1]?.vaults ?? []) : [];

        const atomIds = atoms.map((a: any) => a.term_id);
        
        let vaultsForAtoms: any[] = [];
        if (atomIds.length > 0) {
             const vQ = `query GetVaultsForSearch ($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id } }`;
             const vData = await fetchGraphQL(vQ, { ids: atomIds });
             vaultsForAtoms = vData?.vaults ?? [];
        }

        let atomForVault: any = null;
        if (addressVault.length > 0) {
             const aQ = `query GetAtomForSearch ($id: String!) { atoms(where: { term_id: { _eq: $id } }) { term_id label data image type creator { id label } } }`;
             const aData = await fetchGraphQL(aQ, { id: addressVault[0].term_id });
             atomForVault = aData?.atoms?.[0];
        }

        const formattedAtoms = atoms.map((a: any) => {
             const matchingVaults = vaultsForAtoms.filter((v: any) => normalize(v.term_id) === normalize(a.term_id));
             const bestVault = matchingVaults.sort((x:any, y:any) => {
                 const xVal = BigInt(x.total_assets || 0);
                 const yVal = BigInt(y.total_assets || 0);
                 return xVal > yVal ? -1 : 1;
             })[0];

             return {
                 id: a.term_id,
                 label: resolveLabel(a, a.term_id),
                 image: a.image,
                 type: a.type || "ATOM",
                 creator: a.creator,
                 totalAssets: bestVault?.total_assets ?? "0",
                 totalShares: bestVault?.total_shares ?? "0",
                 currentSharePrice: bestVault?.current_share_price ?? "0",
                 curveId: bestVault?.curve_id ?? "0"
             };
        });

        let formattedVault = [];
        if (addressVault.length > 0) {
             const bestAddressVault = addressVault.sort((x:any, y:any) => {
                 const xVal = BigInt(x.total_assets || 0);
                 const yVal = BigInt(y.total_assets || 0);
                 return xVal > yVal ? -1 : 1;
             })[0];

             formattedVault = [{
                 id: bestAddressVault.term_id,
                 label: resolveLabel(atomForVault, bestAddressVault.term_id),
                 image: atomForVault?.image,
                 type: atomForVault?.type || "ATOM",
                 creator: atomForVault?.creator,
                 totalAssets: bestAddressVault.total_assets,
                 totalShares: bestAddressVault.total_shares,
                 currentSharePrice: bestAddressVault.current_share_price,
                 curveId: bestAddressVault.curve_id
             }];
        }

        const combined = [...formattedVault, ...formattedAtoms];
        const unique = combined.filter((obj, index, self) =>
            index === self.findIndex((t) => (t.id === obj.id))
        );

        return unique;
    } catch (e) {
        console.warn("Global Search Failed", e);
        return [];
    }
};

// -------------------------------------------------------
// 12. GET GLOBAL CLAIMS (FEED)
// -------------------------------------------------------
export const getGlobalClaims = async (): Promise<Claim[]> => {
  // CRITICAL: Ensure 'id' is NOT in the selection set
  const query = `
    query GetGlobalClaims {
      triples(order_by: { block_number: desc }, limit: 50) {
        block_number
        transaction_hash
        created_at
        subject { term_id label data image type }
        predicate { term_id label }
        object { term_id label data image type }
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query);
    const triples = data?.triples ?? [];

    return triples.map((t: any) => {
      const predLabelRaw = t.predicate?.label || 'SIGNAL';
      const predLabelLower = predLabelRaw.toLowerCase().trim();
      
      let sentiment = 'SIGNAL'; // Default to a generic signal bucket
      
      // MAPPING LOGIC: "support" -> TRUST, "oppose" -> DISTRUST
      if (
          predLabelLower === 'support' || 
          predLabelLower.includes('support') || 
          predLabelLower.includes('trust') || 
          predLabelLower.includes('like') || 
          predLabelLower.includes('endorse') || 
          predLabelLower.includes('bull') ||
          predLabelLower.includes('agree')
      ) {
        sentiment = 'TRUST';
      } else if (
          predLabelLower === 'oppose' ||
          predLabelLower.includes('oppose') || 
          predLabelLower.includes('distrust') || 
          predLabelLower.includes('dislike') || 
          predLabelLower.includes('bear') || 
          predLabelLower.includes('scam') || 
          predLabelLower.includes('fake') || 
          predLabelLower.includes('fraud') ||
          predLabelLower.includes('doubt') ||
          predLabelLower.includes('question')
      ) {
        sentiment = 'DISTRUST';
      } else {
        // IF it's not strictly support/oppose, use the ACTUAL predicate label
        // This ensures "IS A", "WORKS AT", etc. are displayed correctly.
        sentiment = predLabelRaw.toUpperCase();
      }

      // Confidence: Mock logic
      const confidence = Math.floor(Math.random() * (99 - 60 + 1) + 60);

      // Synthetic ID generation
      const syntheticId = t.transaction_hash 
          ? `${t.transaction_hash}_${t.object?.term_id}_${t.subject?.term_id}` 
          : `local_${Date.now()}_${Math.random()}`;

      // Timestamp Logic: Use created_at if available, else Date.now()
      const timestamp = t.created_at ? new Date(t.created_at).getTime() : Date.now();

      return {
        id: syntheticId,
        subject: { 
            id: t.subject?.term_id, 
            label: resolveLabel(t.subject, t.subject?.term_id),
            image: t.subject?.image
        },
        predicate: sentiment,
        object: { 
            id: t.object?.term_id, 
            label: resolveLabel(t.object, t.object?.term_id),
            image: t.object?.image,
            type: t.object?.type
        },
        confidence: confidence,
        timestamp: timestamp, 
        txHash: t.transaction_hash,
        block: t.block_number,
        reason: t.object?.label?.length > 20 ? t.object.label : undefined 
      };
    });
  } catch (e) {
    console.warn("Global Claims Fetch Failed", e);
    return [];
  }
};