import { GRAPHQL_URL } from '../constants';
import { Transaction } from '../types';

// -------------------------------------------------------
// BASIC FETCH WRAPPER
// -------------------------------------------------------
const fetchGraphQL = async (query: string, variables: any = {}) => {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      console.warn("GraphQL Query Error:", result.errors);
      // Don't throw here for the app to survive, just return null data
      return { data: null };
    }

    return result.data;
  } catch (error) {
    console.warn("GraphQL Network Error:", error);
    // Return empty data structure to prevent destructuring errors
    return { data: null };
  }
};

const normalize = (x: string) => x ? x.toLowerCase() : '';

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
  // Increased limit to 1000 to provide "Full Access" as requested
  const query = `
    query {
      vaults(limit: 1000, order_by: { total_assets: desc }) {
        term_id
        total_assets
        total_shares
        curve_id
      }
    }
  `;

  try {
    const vaultData = await fetchGraphQL(query);
    const vaults = vaultData?.vaults ?? [];
    if (vaults.length === 0) return [];

    const termIds = vaults.map((v: any) => v.term_id);

    // Fetch matching atoms for the vaults in chunks
    // This ensures we get accurate names for all 1000+ agents without hitting query size limits
    const atomQuery = `
      query ($ids: [String!]!) {
        atoms(where: { term_id: { _in: $ids } }) {
          term_id
          label
          image
          type
          creator { id label }
        }
      }
    `;

    const idChunks = chunkArray(termIds, 200);
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
        label: a?.label || `Agent ${v.term_id.slice(0, 6)}...`,
        image: a?.image,
        type: a?.type || "ATOM",
        creator: a?.creator,
        totalAssets: v.total_assets,
        totalShares: v.total_shares,
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
  const id = termId.toLowerCase();

  const atomQ = `
    query ($id: String!) {
      atoms(where: { term_id: { _eq: $id } }) {
        term_id
        label
        image
        type
        creator { id label }
      }
    }
  `;

  const vaultQ = `
    query ($id: String!) {
      vaults(where: { term_id: { _eq: $id } }) {
        term_id
        total_assets
        total_shares
        curve_id
      }
    }
  `;

  try {
    const [atomRes, vaultRes] = await Promise.all([
      fetchGraphQL(atomQ, { id }),
      fetchGraphQL(vaultQ, { id })
    ]);

    const atom = atomRes?.atoms?.[0];
    const vault = vaultRes?.vaults?.[0];

    // Fallback if both missing (likely not indexed yet), but return structure so app doesn't break
    if (!atom && !vault) {
       return {
          id: termId,
          label: 'Unknown Agent',
          image: null,
          type: 'ATOM',
          totalAssets: "0",
          totalShares: "0",
          curveId: "0"
       };
    }

    return {
      id: termId,
      label: atom?.label || `Agent ${termId.slice(0, 6)}...`,
      image: atom?.image,
      type: atom?.type || "ATOM",
      creator: atom?.creator,
      totalAssets: vault?.total_assets ?? "0",
      totalShares: vault?.total_shares ?? "0",
      curveId: vault?.curve_id ?? "0"
    };
  } catch (e) {
    console.warn("getAgentById failed:", e);
    // Return a minimal safe object to prevent UI crashes
    return {
       id: termId,
       label: 'Agent (Offline)',
       image: null,
       type: 'ATOM',
       totalAssets: "0",
       totalShares: "0",
       curveId: "0"
    };
  }
};

// -------------------------------------------------------
// 3. TRIPLES
// -------------------------------------------------------
export const getAgentTriples = async (termId: string) => {
  const query = `
    query ($id: String!) {
      triples(where: { subject: { term_id: { _eq: $id } } }) {
        predicate { label }
        object { label }
        block_number
      }
    }
  `;
  try {
    const data = await fetchGraphQL(query, { id: termId.toLowerCase() });
    return data?.triples ?? [];
  } catch (e) {
    return [];
  }
};

// -------------------------------------------------------
// 4. OPINIONS
// -------------------------------------------------------
export const getAgentOpinions = async (termId: string) => {
  const query = `
    query ($id: String!) {
      triples(
        where: { subject: { term_id: { _eq: $id } } }
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
    const data = await fetchGraphQL(query, { id: termId.toLowerCase() });

    return (data?.triples ?? []).map((t: any) => ({
      id: Math.random(),
      text: t.object?.label,
      isBullish:
        t.predicate?.label?.toLowerCase().includes("trust") ||
        t.predicate?.label?.toLowerCase().includes("bull"),
      timestamp: Date.now()
    }));
  } catch (e) {
    return [];
  }
};

// -------------------------------------------------------
// 5. USER POSITIONS
// -------------------------------------------------------
export const getUserPositions = async (address: string) => {
  const query = `
    query ($id: String!) {
      positions(where: { account_id: { _eq: $id } }) {
        shares
        vault { term_id total_assets total_shares curve_id }
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { id: address.toLowerCase() });
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

  const account = userAddress.toLowerCase();

  const query = `
    query GetUserHistory($account: String!) {
      deposits(
        where: { sender_id: { _eq: $account } }
        order_by: { created_at: desc }
        limit: 20
      ) {
        id
        shares
        created_at
        sender_id
        vault { term_id }
      }

      redemptions(
        where: { receiver_id: { _eq: $account } }
        order_by: { created_at: desc }
        limit: 20
      ) {
        id
        shares
        assets
        created_at
        receiver_id
        vault { term_id }
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { account });

    const deposits = (data?.deposits ?? []).map((d: any) => ({
      id: d.id,
      type: "DEPOSIT",
      shares: d.shares,
      assets: "0", // Field missing in schema, defaulting to 0
      timestamp: new Date(d.created_at).getTime(),
      vaultId: d.vault?.term_id,
      assetLabel: d.vault?.term_id?.slice(0, 6)
    }));

    const redeems = (data?.redemptions ?? []).map((r: any) => ({
      id: r.id,
      type: "REDEEM",
      shares: r.shares,
      assets: r.assets || "0",
      timestamp: new Date(r.created_at).getTime(),
      vaultId: r.vault?.term_id,
      assetLabel: r.vault?.term_id?.slice(0, 6)
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
    
    // Batch query to get atoms for these vaults
    const query = `
      query ($ids: [String!]!) {
        atoms(where: { term_id: { _in: $ids } }) {
          term_id
          label
          image
          type
        }
        vaults(where: { term_id: { _in: $ids } }) {
          term_id
          curve_id
        }
      }
    `;

    try {
        const data = await fetchGraphQL(query, { ids });
        const atoms = data?.atoms ?? [];
        const vaults = data?.vaults ?? [];

        return vaults.map((v: any) => {
             const a = atoms.find((atom: any) => normalize(atom.term_id) === normalize(v.term_id));
             return {
                 id: v.term_id,
                 label: a?.label || `Agent ${v.term_id.slice(0,6)}...`,
                 image: a?.image,
                 type: a?.type || 'ATOM',
                 curveId: v.curve_id
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
    query {
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
     query {
       positions(limit: 100, order_by: { shares: desc }, where: { shares: { _gt: "0" } }) {
         account { id label image }
         shares
         vault { 
           term_id 
           atom { label }
         }
       }
     }
   `;

   try {
     const data = await fetchGraphQL(query);
     return data?.positions ?? [];
   } catch (e) {
     return [];
   }
};

// -------------------------------------------------------
// 10. GET MARKET ACTIVITY
// -------------------------------------------------------
export const getMarketActivity = async (termId: string): Promise<Transaction[]> => {
  const id = termId.toLowerCase();
  const query = `
    query ($id: String!) {
      deposits(
        where: { vault: { term_id: { _eq: $id } } }
        order_by: { created_at: desc }
        limit: 20
      ) {
        id
        shares
        created_at
        sender_id
      }
      redemptions(
        where: { vault: { term_id: { _eq: $id } } }
        order_by: { created_at: desc }
        limit: 20
      ) {
        id
        shares
        assets
        created_at
        receiver_id
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { id });
    
    const deposits = (data?.deposits ?? []).map((d: any) => ({
      id: d.id,
      type: "DEPOSIT",
      shares: d.shares,
      assets: "0", // Field missing in schema
      timestamp: new Date(d.created_at).getTime(),
      vaultId: termId,
      assetLabel: "Share"
    }));

    const redeems = (data?.redemptions ?? []).map((r: any) => ({
      id: r.id,
      type: "REDEEM",
      shares: r.shares,
      assets: r.assets || "0",
      timestamp: new Date(r.created_at).getTime(),
      vaultId: termId,
      assetLabel: "Share"
    }));

    return [...deposits, ...redeems].sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.warn("Market activity fetch failed:", e);
    return [];
  }
};

// -------------------------------------------------------
// 11. SEARCH GLOBAL AGENTS (FUZZY SEARCH)
// -------------------------------------------------------
export const searchGlobalAgents = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    const term = searchTerm.toLowerCase().trim();
    const pattern = `%${term}%`;
    const isLikelyAddress = term.startsWith('0x') && term.length > 10;

    // We run two queries: one for atoms (by label) and one for vaults (by exact ID if it looks like one)
    // Then we fill in the missing relation.
    
    // 1. Search Atoms by Label
    const atomQuery = `
      query ($pattern: String!) {
        atoms(where: { label: { _ilike: $pattern } }, limit: 20) {
          term_id
          label
          image
          type
          creator { id label }
        }
      }
    `;

    // 2. Search Vault by ID (if strictly provided)
    const vaultQuery = `
      query ($id: String!) {
        vaults(where: { term_id: { _eq: $id } }) {
          term_id
          total_assets
          total_shares
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

        // 3. Hydrate missing data
        // If we found atoms, we need their vaults
        const atomIds = atoms.map((a: any) => a.term_id);
        
        let vaultsForAtoms: any[] = [];
        if (atomIds.length > 0) {
             const vQ = `query ($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares curve_id } }`;
             const vData = await fetchGraphQL(vQ, { ids: atomIds });
             vaultsForAtoms = vData?.vaults ?? [];
        }

        // If we found a vault by ID, we need its atom
        let atomForVault: any = null;
        if (addressVault.length > 0) {
             const aQ = `query ($id: String!) { atoms(where: { term_id: { _eq: $id } }) { term_id label image type creator { id label } } }`;
             const aData = await fetchGraphQL(aQ, { id: addressVault[0].term_id });
             atomForVault = aData?.atoms?.[0];
        }

        // 4. Merge Logic
        const formattedAtoms = atoms.map((a: any) => {
             const v = vaultsForAtoms.find((v: any) => normalize(v.term_id) === normalize(a.term_id));
             return {
                 id: a.term_id,
                 label: a.label,
                 image: a.image,
                 type: a.type || "ATOM",
                 creator: a.creator,
                 totalAssets: v?.total_assets ?? "0",
                 totalShares: v?.total_shares ?? "0",
                 curveId: v?.curve_id ?? "0"
             };
        });

        const formattedVault = addressVault.length > 0 ? [{
             id: addressVault[0].term_id,
             label: atomForVault?.label || `Agent ${addressVault[0].term_id.slice(0,6)}...`,
             image: atomForVault?.image,
             type: atomForVault?.type || "ATOM",
             creator: atomForVault?.creator,
             totalAssets: addressVault[0].total_assets,
             totalShares: addressVault[0].total_shares,
             curveId: addressVault[0].curve_id
        }] : [];

        // Combine and dedup
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