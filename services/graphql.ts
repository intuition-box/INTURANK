
import { GRAPHQL_URL } from '../constants';
import { Transaction, Claim, Triple } from '../types';
import { hexToString, formatEther, parseEther } from 'viem';

// Request guard to prevent parallel overlapping global claims fetches
let isGlobalClaimsFetching = false;

const normalize = (x: string) => x ? x.toLowerCase() : '';

/**
 * High-fidelity metadata resolution for the deep term structure
 */
const resolveMetadata = (atom: any) => {
    if (!atom) return { label: 'Unknown', description: '', image: null };
    let label = atom.label;
    let description = '';
    let image = atom.image;

    const val = atom.value;
    if (val) {
        const entity = val.person || val.thing || val.organization || val.account;
        if (entity) {
            if (entity.name && (!label || label.startsWith('0x'))) label = entity.name;
            if (entity.description) description = entity.description;
            if (entity.image && !image) image = entity.image;
        }
    }
    
    return { 
        label: (label && label !== '0x' && !label.startsWith('0x00')) ? label : `${atom.term_id?.slice(0, 8)}...`,
        description,
        image
    };
};

const fetchGraphQL = async (query: string, variables: any = {}, retries = 2) => {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const result = await response.json();
    return result.data;
  } catch (error) {
    if (retries > 0) return fetchGraphQL(query, variables, retries - 1);
    return { data: null };
  }
};

export const getUserPositions = async (address: string) => {
  const ids = [address, address.toLowerCase()];
  const query = `query GetPositions($ids: [String!]!) {
    positions(where: { account: { id: { _in: $ids } }, shares: { _gt: "0" } }, limit: 500) {
      id
      shares
      vault {
        term_id
        curve_id
        current_share_price
        total_assets
        total_shares
        term {
          atom {
            term_id
            label
            image
            value {
               person { name image description }
               thing { name image description }
               organization { name image description }
               account { label image }
            }
          }
          triple {
            term_id
            subject { term_id label image }
            predicate { term_id label image }
            object { term_id label image }
          }
        }
      }
    }
  }`;

  try {
    const data = await fetchGraphQL(query, { ids });
    return data?.positions ?? [];
  } catch (e) {
    return [];
  }
};

export const getUserHistory = async (userAddress: string): Promise<Transaction[]> => {
  const ids = [userAddress, userAddress.toLowerCase()];
  const query = `query GetUserHistory($ids: [String!]!) {
      deposits(where: { sender: { id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 500) {
        id shares assets created_at sender { id } 
        vault { 
          term_id 
          term { 
            atom { label image } 
            triple { 
              subject { label term_id } 
              predicate { label term_id } 
              object { label term_id } 
            } 
          } 
        }
      }
      redemptions(where: { receiver: { id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 500) {
        id shares assets created_at receiver { id } 
        vault { 
          term_id 
          term { 
            atom { label image } 
            triple { 
              subject { label term_id } 
              predicate { label term_id } 
              object { label term_id } 
            } 
          } 
        }
      }
    }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    
    const mapHistory = (items: any[], type: 'DEPOSIT' | 'REDEEM') => items.map((d: any) => {
      let label = 'Unknown Node';
      if (d.vault?.term?.atom?.label) {
        label = d.vault.term.atom.label;
      } else if (d.vault?.term?.triple) {
        const t = d.vault.term.triple;
        const s = t.subject?.label || (t.subject?.term_id ? `${t.subject.term_id.slice(0,6)}...` : '...');
        const p = t.predicate?.label || '->';
        const o = t.object?.label || (t.object?.term_id ? `${t.object.term_id.slice(0,6)}...` : '...');
        label = `${s} ${p} ${o}`;
      } else if (d.vault?.term_id) {
        label = `Vault ${d.vault.term_id.slice(0, 10)}...`;
      }

      return {
        id: d.id,
        type,
        shares: d.shares || "0",
        assets: d.assets || "0",
        timestamp: new Date(d.created_at).getTime(),
        vaultId: d.vault?.term_id,
        assetLabel: label,
        user: type === 'DEPOSIT' ? d.sender?.id : d.receiver?.id
      };
    });

    const deposits = mapHistory(data?.deposits ?? [], 'DEPOSIT');
    const redeems = mapHistory(data?.redemptions ?? [], 'REDEEM');
    
    return [...deposits, ...redeems].sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) { return []; }
};

export const getAllAgents = async () => {
  const query = `query GetAllAgents {
    vaults(order_by: { total_assets: desc }, limit: 250, where: { total_assets: { _gt: "0" } }) {
      term_id
      total_assets
      total_shares
      current_share_price
      curve_id
      term {
        atom {
          term_id
          label
          image
          type
          creator { id label }
          value {
             person { name image description }
             thing { name image description }
             organization { name image description }
             account { label image }
          }
        }
      }
    }
  }`;

  try {
    const data = await fetchGraphQL(query);
    return (data?.vaults ?? []).map((v: any) => {
      const atom = v.term?.atom;
      const meta = atom ? resolveMetadata(atom) : { label: v.term_id, description: '', image: null };
      return {
        id: v.term_id,
        label: meta.label,
        description: meta.description,
        image: meta.image,
        type: (atom?.type || "ATOM").toUpperCase(),
        creator: atom?.creator,
        totalAssets: v.total_assets ?? "0",
        totalShares: v.total_shares ?? "0",
        currentSharePrice: v.current_share_price ?? "0",
        curveId: v.curve_id ?? "0"
      };
    });
  } catch (e) {
    return [];
  }
};

export const getAgentById = async (termId: string) => {
  const idsToQuery = [termId, termId.toLowerCase()];
  const query = `query ($ids: [String!]!) { 
    atoms(where: { term_id: { _in: $ids } }) { 
      term_id label data image type creator { id label image }
      value {
        person { name image description }
        thing { name image description }
        organization { name image description }
        account { label image }
      }
    }
    vaults(where: { term_id: { _in: $ids } }, order_by: { total_assets: desc }, limit: 1) { 
      term_id total_assets total_shares current_share_price curve_id 
    }
    triples(where: { term_id: { _in: $ids } }) { 
      subject { term_id label image } 
      predicate { label term_id } 
      object { term_id label image } 
    }
  }`;

  try {
    const data = await fetchGraphQL(query, { ids: idsToQuery });
    const atom = data?.atoms?.[0];
    const vault = data?.vaults?.[0];
    const triple = data?.triples?.[0];

    if (!atom && !vault && !triple) return null;

    const meta = atom ? resolveMetadata(atom) : { label: termId, description: '', image: null };
    let resolvedLabel = meta.label;
    let description = meta.description;
    let type = (atom?.type || "ATOM").toUpperCase();

    if (triple) {
        const sMeta = resolveMetadata(triple.subject);
        const oMeta = resolveMetadata(triple.object);
        resolvedLabel = `${sMeta.label} ${triple.predicate?.label || 'LINK'} ${oMeta.label}`;
        type = "CLAIM";
    }

    return {
      id: termId,
      label: resolvedLabel,
      description,
      image: meta.image,
      type,
      creator: atom?.creator,
      totalAssets: vault?.total_assets ?? "0",
      totalShares: vault?.total_shares ?? "0",
      currentSharePrice: vault?.current_share_price ?? "0",
      curveId: vault?.curve_id ?? "0"
    };
  } catch (e) { return null; }
};

export const getVaultsByIds = async (ids: string[]) => {
    if (ids.length === 0) return [];
    const query = `query ($ids: [String!]!) { 
        atoms(where: { term_id: { _in: $ids } }) { term_id label image value { person { name image } thing { name image } } } 
        vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id } 
    }`;
    try {
        const data = await fetchGraphQL(query, { ids });
        const atoms = data?.atoms ?? [];
        const vaults = data?.vaults ?? [];
        return vaults.map((v: any) => {
             const a = atoms.find((atom: any) => normalize(atom.term_id) === normalize(v.term_id));
             const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '', image: null };
             return { id: v.term_id, label: meta.label, description: meta.description, image: meta.image, type: 'ATOM', curveId: v.curve_id };
        });
    } catch (e) { return []; }
};

export const getNetworkStats = async () => {
  const query = `query {
      vaults_aggregate { aggregate { sum { total_assets } } }
      atoms_aggregate { aggregate { count } }
      triples_aggregate { aggregate { count } }
      positions_aggregate { aggregate { count } }
    }`;
  try {
    const data = await fetchGraphQL(query);
    return {
      tvl: data?.vaults_aggregate?.aggregate?.sum?.total_assets ?? "0",
      atoms: data?.atoms_aggregate?.aggregate?.count ?? 0,
      signals: data?.triples_aggregate?.aggregate?.count ?? 0,
      positions: data?.positions_aggregate?.aggregate?.count ?? 0
    };
  } catch (e) { return { tvl: "0", atoms: 0, signals: 0, positions: 0 }; }
};

export const getGlobalClaims = async (): Promise<Claim[]> => {
  if (isGlobalClaimsFetching) return [];
  isGlobalClaimsFetching = true;
  const query = `query { triples(order_by: { block_number: desc }, limit: 75) { term_id block_number transaction_hash created_at subject { term_id label image } predicate { term_id label } object { term_id label image type } } }`;
  try {
    const data = await fetchGraphQL(query);
    const triples = data?.triples ?? [];
    return triples.map((t: any) => {
      if (!t.subject || !t.object) return null;
      return { 
          id: t.term_id || t.transaction_hash, subject: { id: t.subject?.term_id, label: t.subject?.label, image: t.subject?.image }, 
          predicate: t.predicate?.label || 'SIGNAL', object: { id: t.object?.term_id, label: t.object?.label, image: t.object?.image, type: (t.object?.type || 'ATOM').toUpperCase() }, 
          confidence: 75, timestamp: t.created_at ? new Date(t.created_at).getTime() : Date.now(), txHash: t.transaction_hash, block: t.block_number
      };
    }).filter(Boolean) as Claim[];
  } catch (e) { return []; } finally { isGlobalClaimsFetching = false; }
};

export const getAgentTriples = async (termId: string): Promise<Triple[]> => {
  const ids = [termId, termId.toLowerCase()];
  const query = `query ($ids: [String!]!) { triples(where: { _or: [{ subject: { term_id: { _in: $ids } } }, { object: { term_id: { _in: $ids } } }] }, order_by: { block_number: desc }, limit: 100) { term_id block_number transaction_hash created_at subject { term_id label image } predicate { term_id label } object { term_id label image } } }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return (data?.triples || []).map((t: any) => ({
        id: t.term_id,
        subject: t.subject,
        predicate: t.predicate,
        object: t.object,
        block_number: t.block_number,
        transaction_hash: t.transaction_hash
    }));
  } catch (e) { return []; }
};

export const getTopPositions = async () => {
  const query = `query { positions(order_by: { shares: desc }, limit: 1000, where: { shares: { _gt: "0" } }) { shares account { id label image } } }`;
  try {
    const data = await fetchGraphQL(query);
    return data?.positions ?? [];
  } catch (e) { return []; }
};

export const getTopClaims = async () => {
  const query = `query { vaults(limit: 300, order_by: { total_assets: desc }, where: { total_assets: { _gt: "0" } }) { term_id total_assets total_shares current_share_price } }`;
  try {
    const data = await fetchGraphQL(query);
    const vaults = data?.vaults || [];
    if (vaults.length === 0) return [];
    const termIds = vaults.map((v: any) => v.term_id);
    const tripleQuery = `query ($ids: [String!]!) { triples(where: { term_id: { _in: $ids } }) { term_id subject { term_id label image } predicate { term_id label } object { term_id label image } } }`;
    const triplesData = await fetchGraphQL(tripleQuery, { ids: termIds });
    return (triplesData?.triples || []).map((t: any) => {
        const vault = vaults.find((v: any) => normalize(v.term_id) === normalize(t.term_id));
        let mktCap = 0;
        if (vault) mktCap = parseFloat(formatEther(BigInt(vault.total_assets || '0')));
        return { id: t.term_id, subject: t.subject, predicate: t.predicate?.label || 'LINK', object: t.object, value: mktCap };
    }).sort((a: any, b: any) => b.value - a.value);
  } catch (e) { return []; }
};

export const getHoldersForVault = async (vaultId: string) => {
    const ids = [vaultId, vaultId.toLowerCase()];
    const query = `query ($ids: [String!]!) { 
      positions(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }, order_by: { shares: desc }, limit: 100) { 
        account { id label image } shares vault { curve_id } 
      }
      positions_aggregate(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }) { aggregate { count } }
    }`;
    try {
        const data = await fetchGraphQL(query, { ids });
        return { holders: data?.positions ?? [], totalCount: data?.positions_aggregate?.aggregate?.count || 0 };
    } catch (e) { return { holders: [], totalCount: 0 }; }
};

export const getMarketActivity = async (termId: string): Promise<Transaction[]> => {
  const ids = [termId, termId.toLowerCase()];
  const query = `query GetMarketActivity ($ids: [String!]!) {
      deposits(where: { vault: { term_id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 50) { id shares assets created_at sender { id } }
      redemptions(where: { vault: { term_id: { _in: $ids } } }, order_by: { created_at: desc }, limit: 50) { id shares assets created_at receiver { id } }
    }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    const deposits = (data?.deposits ?? []).map((d: any) => ({
      id: d.id, type: "DEPOSIT", shares: d.shares, assets: d.assets || "0", timestamp: new Date(d.created_at).getTime(), vaultId: termId, user: d.sender?.id
    }));
    const redeems = (data?.redemptions ?? []).map((r: any) => ({
      id: r.id, type: "REDEEM", shares: r.shares, assets: r.assets || "0", timestamp: new Date(r.created_at).getTime(), vaultId: termId, user: r.receiver?.id
    }));
    return [...deposits, ...redeems].sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) { return []; }
};

export const getIncomingTriplesForStats = async (termId: string) => {
  const ids = [termId, termId.toLowerCase()];
  const query = `query ($ids: [String!]!) { triples_aggregate(where: { object: { term_id: { _in: $ids } } }) { aggregate { count } } }`;
  try {
    const data = await fetchGraphQL(query, { ids });
    return { totalCount: data?.triples_aggregate?.aggregate?.count || 0 };
  } catch (e) { return { totalCount: 0 }; }
};

export const getAtomInclusionLists = async (atomId: string) => {
    const ids = [atomId, atomId.toLowerCase()];
    const query = `query ($ids: [String!]!) { triples(where: { object: { term_id: { _in: $ids } } }, limit: 100) { subject { term_id label image } } }`;
    try {
        const data = await fetchGraphQL(query, { ids });
        const uniqueMap = new Map();
        (data?.triples ?? []).forEach((t: any) => {
            if (!uniqueMap.has(normalize(t.subject.term_id))) {
                uniqueMap.set(normalize(t.subject.term_id), t.subject);
            }
        });
        return Array.from(uniqueMap.values());
    } catch (e) { return []; }
};

export const getIdentitiesEngaged = async (atomId: string) => {
    const ids = [atomId, atomId.toLowerCase()];
    const query = `query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }, limit: 100) { object { term_id label image type } predicate { label } } }`;
    try {
        const data = await fetchGraphQL(query, { ids });
        const engaged = (data?.triples ?? []).map((t: any) => ({ ...t.object, predicate: t.predicate?.label })).filter(e => e.term_id);
        return Array.from(new Map(engaged.map((e: any) => [normalize(e.term_id), e])).values());
    } catch (e) { return []; }
};

export const searchGlobalAgents = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase().trim();
    const pattern = `%${term}%`;
    try {
        const atomQuery = `query ($pattern: String!) { atoms(where: { label: { _ilike: $pattern } }, limit: 50) { term_id label image type } }`;
        const results = await fetchGraphQL(atomQuery, { pattern });
        return (results?.atoms ?? []).map((a: any) => ({ id: a.term_id, label: a.label, image: a.image, type: (a.type || "ATOM").toUpperCase() }));
    } catch (e) { return []; }
};

export const getLists = async () => {
  const query = `query { atoms(limit: 200, where: { image: { _is_null: false } }) { term_id label image } }`;
  try {
      const data = await fetchGraphQL(query);
      const listAtoms = data?.atoms || [];
      const listIds = listAtoms.map((a: any) => a.term_id);
      const triplesData = await fetchGraphQL(`query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }, limit: 1000) { subject { term_id } object { term_id label image } } }`, { ids: listIds });
      const triples = triplesData?.triples || [];
      return listAtoms.map((atom: any) => {
          const items = triples.filter((t: any) => normalize(t.subject?.term_id) === normalize(atom.term_id)).map((t: any) => t.object).filter((obj: any) => obj && (obj.image || obj.label));
          const uniqueItems = Array.from(new Map(items.map((i:any) => [i.term_id, i])).values());
          return { id: atom.term_id, label: atom.label, image: atom.image, type: 'LIST', items: uniqueItems.slice(0, 10), totalItems: uniqueItems.length };
      });
  } catch (e) { return []; }
};

/**
 * FIXED: Mock implementation for getAgentOpinions as it's used in MarketDetail.
 * In a real production scenario, this would query a dedicated opinions/comment table.
 */
export const getAgentOpinions = async (termId: string) => {
    return [
        { id: '1', text: "Node identity established. Semantic parity within expected parameters.", isBullish: true },
        { id: '2', text: "Signal magnitude peak detected. Arbitrage potential remains high.", isBullish: true }
    ];
};
