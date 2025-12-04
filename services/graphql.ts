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
      console.error("GraphQL Errors:", result.errors);
      throw new Error("Failed to fetch data from Intuition GraphQL");
    }

    return result.data;
  } catch (error) {
    console.error("Network Error:", error);
    throw error;
  }
};

const normalize = (x: string) => x.toLowerCase();

// -------------------------------------------------------
// 1. GET ALL AGENTS
// -------------------------------------------------------
export const getAllAgents = async () => {
  const query = `
    query {
      vaults(limit: 60, order_by: { total_assets: desc }) {
        term_id
        total_assets
        total_shares
        curve_id
      }
    }
  `;

  const vaultData = await fetchGraphQL(query);
  const vaults = vaultData.vaults ?? [];
  if (vaults.length === 0) return [];

  const termIds = vaults.map((v: any) => v.term_id);

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

  const atomData = await fetchGraphQL(atomQuery, { ids: termIds });

  return vaults.map((v: any) => {
    const a = atomData.atoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));

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

  const [atomRes, vaultRes] = await Promise.all([
    fetchGraphQL(atomQ, { id }),
    fetchGraphQL(vaultQ, { id })
  ]);

  const atom = atomRes.atoms?.[0];
  const vault = vaultRes.vaults?.[0];

  if (!atom && !vault) return null;

  return {
    id: termId,
    label: atom?.label || `Agent ${termId.slice(0, 6)}...`,
    image: atom?.image,
    type: atom?.type || "ATOM",
    creator: atom?.creator,
    totalAssets: vault?.total_assets ?? "0",
    totalShares: vault?.total_shares ?? "0",
    curveId: vault?.curve_id
  };
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

  const data = await fetchGraphQL(query, { id: termId.toLowerCase() });
  return data.triples ?? [];
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

  const data = await fetchGraphQL(query, { id: termId.toLowerCase() });

  return (data.triples ?? []).map((t: any) => ({
    id: Math.random(),
    text: t.object?.label,
    isBullish:
      t.predicate?.label?.toLowerCase().includes("trust") ||
      t.predicate?.label?.toLowerCase().includes("bull"),
    timestamp: Date.now()
  }));
};

// -------------------------------------------------------
// 5. USER POSITIONS
// -------------------------------------------------------
export const getUserPositions = async (address: string) => {
  const query = `
    query ($id: String!) {
      positions(where: { account_id: { _eq: $id } }) {
        shares
        vault { term_id total_assets total_shares }
      }
    }
  `;

  const data = await fetchGraphQL(query, { id: address.toLowerCase() });
  return data.positions ?? [];
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
        created_at
        receiver_id
        vault { term_id }
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { account });

    const deposits = (data.deposits ?? []).map((d: any) => ({
      id: d.id,
      type: "DEPOSIT",
      shares: d.shares,
      assets: "0",
      timestamp: new Date(d.created_at).getTime(),
      vaultId: d.vault.term_id,
      assetLabel: d.vault.term_id.slice(0, 6)
    }));

    const redeems = (data.redemptions ?? []).map((r: any) => ({
      id: r.id,
      type: "REDEEM",
      shares: r.shares,
      assets: "0",
      timestamp: new Date(r.created_at).getTime(),
      vaultId: r.vault.term_id,
      assetLabel: r.vault.term_id.slice(0, 6)
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

  const qVaults = `
    query ($ids: [String!]!) {
      vaults(where: { term_id: { _in: $ids } }) {
        term_id
        total_assets
        total_shares
      }
    }
  `;

  const qAtoms = `
    query ($ids: [String!]!) {
      atoms(where: { term_id: { _in: $ids } }) {
        term_id
        label
        image
      }
    }
  `;

  const vaultData = await fetchGraphQL(qVaults, { ids });
  const atomData = await fetchGraphQL(qAtoms, { ids });

  return vaultData.vaults.map((v: any) => {
    const atom = atomData.atoms.find((a: any) => normalize(a.term_id) === normalize(v.term_id));

    return {
      id: v.term_id,
      totalAssets: v.total_assets,
      totalShares: v.total_shares,
      label: atom?.label || `Agent ${v.term_id.slice(0, 6)}`,
      image: atom?.image
    };
  });
};

// -------------------------------------------------------
// 8. MARKET ACTIVITY
// -------------------------------------------------------
export const getMarketActivity = async (termId: string) => {
  const query = `
    query ($id: String!) {
      deposits(
        where: { term_id: { _eq: $id } }
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
        where: { term_id: { _eq: $id } }
        order_by: { created_at: desc }
        limit: 20
      ) {
        id
        shares
        created_at
        receiver_id
        vault { term_id }
      }
    }
  `;

  const data = await fetchGraphQL(query, { id: termId.toLowerCase() });

  const depositActivity = (data.deposits ?? []).map((d: any) => ({
    id: d.id,
    type: "DEPOSIT",
    shares: d.shares,
    assets: "0",
    vaultId: d.vault.term_id,
    timestamp: new Date(d.created_at).getTime(),
    assetLabel: d.sender_id?.slice(0, 6) ?? "User"
  }));

  const redeemActivity = (data.redemptions ?? []).map((r: any) => ({
    id: r.id,
    type: "REDEEM",
    shares: r.shares,
    assets: "0",
    vaultId: r.vault.term_id,
    timestamp: new Date(r.created_at).getTime(),
    assetLabel: r.receiver_id?.slice(0, 6) ?? "User"
  }));

  return [...depositActivity, ...redeemActivity];
};

// -------------------------------------------------------
// 9. LEADERBOARD
// -------------------------------------------------------
interface AtomMeta {
  term_id: string;
  label: string;
  image?: string | null;
}

export const getTopPositions = async (): Promise<any[]> => {
  const query = `
    query {
      positions(limit: 200, order_by: { shares: desc }) {
        id
        shares
        account { id label image }
        vault { term_id }
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query);
    const positions = data.positions ?? [];

    if (positions.length === 0) return [];

    const termIds = [...new Set(positions.map((p: any) => p.vault.term_id))];

    const atomQuery = `
      query ($ids: [String!]!) {
        atoms(where: { term_id: { _in: $ids } }) {
          term_id
          label
          image
        }
      }
    `;

    const atomData = await fetchGraphQL(atomQuery, { ids: termIds });

    const atomMap = new Map<string, AtomMeta>(
      atomData.atoms.map((a: any) => [a.term_id.toLowerCase(), a])
    );

    return positions.map((pos: any) => {
      const atom = atomMap.get(pos.vault.term_id.toLowerCase());

      return {
        id: pos.id,
        shares: pos.shares,
        account: pos.account,
        vault: {
          term_id: pos.vault.term_id,
          atom: atom
            ? { label: atom.label, image: atom.image }
            : { label: "Unknown Asset", image: null }
        }
      };
    });

  } catch (e) {
    console.warn("Failed to fetch leaderboard:", e);
    return [];
  }
};

// -------------------------------------------------------
// 10. CHECK IF ATOM EXISTS
// -------------------------------------------------------
export const getAtom = async (termId: string): Promise<boolean> => {
  const query = `
    query ($id: String!) {
      atoms(where: { term_id: { _eq: $id } }) {
        term_id
      }
    }
  `;

  try {
    const data = await fetchGraphQL(query, { id: termId.toLowerCase() });
    return (data.atoms?.length ?? 0) > 0;
  } catch {
    return false;
  }
};

// -------------------------------------------------------
// 11. GET NETWORK AGGREGATES
// -------------------------------------------------------
export const getNetworkStats = async () => {
  const query = `
    query {
      vaults_aggregate {
        aggregate {
          sum {
            total_assets
          }
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
      tvl: data.vaults_aggregate?.aggregate?.sum?.total_assets || "0",
      atoms: data.atoms_aggregate?.aggregate?.count || 0,
      signals: data.triples_aggregate?.aggregate?.count || 0,
      positions: data.positions_aggregate?.aggregate?.count || 0,
    };
  } catch (e) {
    console.error("Failed to fetch network stats:", e);
    // Return safe fallback
    return { tvl: "0", atoms: 0, signals: 0, positions: 0 };
  }
};