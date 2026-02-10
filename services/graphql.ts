
import { GRAPHQL_URL, IS_PREDICATE_ID, DISTRUST_ATOM_ID } from '../constants';
import { Transaction, Claim } from '../types';
import { hexToString, formatEther, parseEther } from 'viem';

// Request guard to prevent parallel overlapping global claims fetches
let isGlobalClaimsFetching = false;

const LIST_PREDICATE_ID = "0x7ec36d201c842dc787b45cb5bb753bea4cf849be3908fb1b0a7d067c3c3cc1f5";

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
    if (!atom) return { label: 'Unknown', description: '', type: 'ATOM', image: undefined };
    
    let label = atom.label;
    let description = '';
    let image = atom.image;
    
    if (atom.value) {
        const v = atom.value;
        const meta = v.person || v.thing || v.organization || v.account;
        if (meta) {
            if (!label || label.startsWith('0x')) label = meta.name || meta.label;
            description = meta.description || '';
            if (!image) image = meta.image;
        }
    }

    if (atom.triple && atom.triple.object_id?.toLowerCase().includes(DISTRUST_ATOM_ID.toLowerCase().slice(26))) {
        const subjectLabel = atom.triple.subject?.label || atom.triple.subject_id?.slice(0, 8);
        return {
            label: `OPPOSING_${subjectLabel}`.toUpperCase(),
            description: `A directional signal of distrust against ${subjectLabel} on the Intuition Network.`,
            type: 'CLAIM',
            image: atom.triple.subject?.image
        };
    }

    return { 
        label: (label && label !== '0x' && !label.startsWith('0x00')) ? label : `${atom.term_id?.slice(0, 8)}...`, 
        description,
        type: atom.type || 'ATOM',
        image
    };
};

const aggregateVaultData = (allVaults: any[]) => {
  const atomGroups = new Map<string, any>();
  allVaults.forEach(v => {
    const id = normalize(v.term_id);
    const existing = atomGroups.get(id) || { total_assets: 0n, total_shares: 0n, computed_mcap: 0, current_share_price: '0', has_linear: false, position_count: 0 };
    const assets = BigInt(v.total_assets || '0');
    const shares = BigInt(v.total_shares || '0');
    const priceRaw = v.current_share_price || '0';
    const sharesNum = parseFloat(formatEther(shares));
    const priceNum = parseFloat(formatEther(BigInt(priceRaw))) || (sharesNum > 0 ? parseFloat(formatEther(assets)) / sharesNum : 0.1);
    atomGroups.set(id, { term_id: v.term_id, total_assets: existing.total_assets + assets, total_shares: existing.total_shares + shares, computed_mcap: existing.computed_mcap + (sharesNum * priceNum), current_share_price: v.curve_id?.toString() === '1' ? priceRaw : existing.current_share_price || priceRaw, has_linear: v.curve_id?.toString() === '1', position_count: existing.position_count + Number(v.position_count || 0) });
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
        atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } value { person { name } organization { name } thing { name } } }
        triples(where: { term_id: { _in: $ids } }) { term_id counter_term_id subject { label term_id image type } predicate { label } object { label term_id image type } }
    }`;

    const res = await fetchGraphQL(dataQuery, { ids: termIds });
    const atoms = res?.atoms || [];
    const triples = res?.triples || [];

    const items = aggregated.map(v => {
      const a = atoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const t = triples.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '', type: 'ATOM', image: undefined };
      let label = meta.label, type = (meta.type || "ATOM").toUpperCase(), image = a?.image;

      if (t) {
          const sMeta = resolveMetadata(t.subject), oMeta = resolveMetadata(t.object);
          label = `${sMeta.label} ${t.predicate?.label || 'LINK'} ${oMeta.label}`;
          type = "CLAIM";
          image = t.subject?.image || t.object?.image;
      }

      return {
        id: v.term_id,
        counterTermId: t?.counter_term_id,
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
      atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } value { person { name } thing { name } } }
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      triples(where: { term_id: { _in: $ids } }) { term_id counter_term_id subject { label term_id image type } predicate { label } object { label term_id image type } }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const aggregated = aggregateVaultData(res?.vaults || []);
    const v = aggregated[0], a = res?.atoms?.[0], t = res?.triples?.[0];
    if (!v && !a && !t) return { id: termId, label: 'Unknown', description: '', totalAssets: "0", totalShares: "0", type: 'ATOM' };

    const meta = a ? resolveMetadata(a) : { label: termId, description: '', type: 'ATOM', image: undefined };
    let label = meta.label, type = (meta.type || "ATOM").toUpperCase();
    if (t) {
        label = `${resolveMetadata(t.subject).label} ${t.predicate?.label} ${resolveMetadata(t.object).label}`;
        type = "CLAIM";
    }

    return {
      id: termId, 
      counterTermId: t?.counter_term_id,
      label, description: meta.description, image: a?.image, type, creator: a?.creator,
      totalAssets: v?.total_assets.toString() || "0",
      totalShares: v?.total_shares.toString() || "0",
      currentSharePrice: v?.current_share_price || "0",
      marketCap: v?.computed_mcap.toString() || "0",
      positionCount: v?.position_count || 0
    };
  } catch (e) { return { id: termId, label: 'Offline', totalAssets: "0", totalShares: "0", type: 'ATOM' }; }
};

export const getUserHistory = async (userAddress: string): Promise<Transaction[]> => {
  const q = `query ($userAddress: String!) {
      events(limit: 100, order_by: {created_at: desc}, where: {
          _and: [{type: {_neq: "FeesTransfered"}}, {_not: {_and: [{type: {_eq: "Deposited"}}, {deposit: {assets_after_fees: {_eq: 0}}}]}}, 
          {_or: [{_and: [{type: {_eq: "AtomCreated"}}, {atom: {creator: {id: {_eq: $userAddress}}}}]}, 
          {_and: [{type: {_eq: "TripleCreated"}}, {triple: {creator: {id: {_eq: $userAddress}}}}]}, 
          {_and: [{type: {_eq: "Deposited"}}, {deposit: {sender: {id: {_eq: $userAddress}}}}]}, 
          {_and: [{type: {_eq: "Redeemed"}}, {redemption: {sender: {id: {_eq: $userAddress}}}}]}]}]
      }) {
        id created_at type transaction_hash atom { term_id label type }
        triple { term_id subject { label term_id } predicate { label term_id } object { label term_id } }
        deposit { shares assets_after_fees } redemption { assets shares }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { userAddress: userAddress.toLowerCase() });
    const events = data?.events ?? [];
    return events.map((ev: any) => {
        let label = 'Unknown Node', vaultId = '0x', shares = '0', assets = '0', type: 'DEPOSIT' | 'REDEEM' = 'DEPOSIT';
        if (ev.type === 'AtomCreated' && ev.atom) { label = resolveMetadata(ev.atom).label; vaultId = ev.atom.term_id; }
        else if (ev.type === 'TripleCreated' && ev.triple) { label = `${resolveMetadata(ev.triple.subject).label} ${ev.triple.predicate?.label || 'LINK'} ${resolveMetadata(ev.triple.object).label}`; vaultId = ev.triple.term_id; }
        else if (ev.type === 'Deposited' && ev.deposit) { assets = ev.deposit.assets_after_fees || '0'; shares = ev.deposit.shares || '0'; 
            if (ev.atom) { label = resolveMetadata(ev.atom).label; vaultId = ev.atom.term_id; } 
            else if (ev.triple) { label = `${resolveMetadata(ev.triple.subject).label} ${resolveMetadata(ev.triple.predicate).label} ${resolveMetadata(ev.triple.object).label}`; vaultId = ev.triple.term_id; }
        } else if (ev.type === 'Redeemed' && ev.redemption) { assets = ev.redemption.assets || '0'; shares = ev.redemption.shares || '0'; type = 'REDEEM';
            if (ev.atom) { label = resolveMetadata(ev.atom).label; vaultId = ev.atom.term_id; }
            else if (ev.triple) { label = `${resolveMetadata(ev.triple.subject).label} ${resolveMetadata(ev.triple.predicate).label} ${resolveMetadata(ev.triple.object).label}`; vaultId = ev.triple.term_id; }
        }
        return { id: ev.transaction_hash || ev.id, type, shares, assets, timestamp: ev.created_at ? new Date(ev.created_at).getTime() : Date.now(), vaultId, assetLabel: label };
    });
  } catch (e) { return []; }
};

export const getUserPositions = async (address: string) => {
  const ids = [address, address.toLowerCase()];
  const q = `query ($ids: [String!]!) {
      positions(where: { account: { id: { _in: $ids } }, shares: { _gt: "0" } }, limit: 500) { 
        id shares account { id label image } 
        vault { term_id curve_id term { atom { term_id label image type } triple { term_id subject { label term_id type image } predicate { label } object { label term_id type image } counter_term_id } } } 
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
      atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label } value { person { name } organization { name } } }
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      triples(where: { term_id: { _in: $ids } }) { term_id counter_term_id subject { label term_id image type } predicate { label } object { label term_id image type } }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const aggregated = aggregateVaultData(res?.vaults || []);
    const atoms = res?.atoms || [];
    const triples = res?.triples || [];
    return aggregated.map(v => {
      const a = atoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const t = triples.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '', type: 'ATOM', image: undefined };
      let label = meta.label, type = (meta.type || "ATOM").toUpperCase(), image = a?.image;
      if (t) { label = `${resolveMetadata(t.subject).label} ${t.predicate?.label || 'LINK'} ${resolveMetadata(t.object).label}`; type = "CLAIM"; image = t.subject?.image || t.object?.image; }
      return { id: v.term_id, counterTermId: t?.counter_term_id, label, description: meta.description, image, type, creator: a?.creator, totalAssets: v.total_assets.toString(), totalShares: v.total_shares.toString(), currentSharePrice: v.current_share_price, marketCap: v.computed_mcap.toString(), positionCount: v.position_count };
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
  const q = `query ($ids: [String!]!) { triples(where: { _or: [ {subject: { term_id: { _in: $ids } }}, {object: { term_id: { _in: $ids } }} ] }, order_by: { block_number: desc }) { term_id counter_term_id subject { label term_id image type } predicate { label } object { label term_id image type } block_number transaction_hash } }`;
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
  const q = `query ($ids: [String!]!) { triples_aggregate(where: { object_id: { _in: $ids } }) { aggregate { count } } triples(where: { object_id: { _in: $ids } }, limit: 50, order_by: { block_number: desc }) { term_id subject { label term_id data image type } predicate { label term_id } block_number } }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return { triples: data?.triples ?? [], totalCount: data?.triples_aggregate?.aggregate?.count || 0 };
  } catch (e) { return { triples: [], totalCount: 0 }; }
};

export const getAtomInclusionLists = async (atomId: string) => {
    const ids = prepareQueryIds(atomId);
    const pIds = prepareQueryIds(LIST_PREDICATE_ID);
    
    // Switch to triples scan for higher reliability in finding list membership
    const q = `query GetListMembership($ids: [String!], $pIds: [String!]) {
        triples(where: { subject_id: { _in: $ids }, predicate_id: { _in: $pIds } }, limit: 50) {
            object {
                term_id label image type
                vaults { total_assets total_shares current_share_price curve_id position_count }
            }
        }
    }`;
    try {
        const data = await fetchGraphQL(q, { ids, pIds });
        const listTriples = data?.triples || [];
        
        return listTriples.map((t: any) => {
            const obj = t.object;
            const meta = resolveMetadata(obj);
            const aggr = aggregateVaultData(obj.vaults || [])[0];
            
            return {
                id: obj.term_id,
                label: meta.label,
                image: obj.image,
                totalItems: Number(aggr?.position_count || 0),
                value: parseFloat(formatEther(BigInt(aggr?.total_assets || '0'))),
                items: []
            };
        });
    } catch (e) { return []; }
};

export const getIdentitiesEngaged = async (atomId: string) => {
    const ids = prepareQueryIds(atomId);
    const q = `query ($ids: [String!]!) { triples(where: { subject: { term_id: { _in: $ids } } }, limit: 100) { object { term_id label image type } predicate { label } } }`;
    try {
        const data = await fetchGraphQL(q, { ids });
        const engaged = (data?.triples ?? []).map((t: any) => ({ ...t.object, label: resolveMetadata(t.object).label, predicate: t.predicate?.label })).filter((e:any) => e.term_id);
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
         const chunks = (arr: any[], size: number) => { const result = []; for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size)); return result; };
         for (const chunk of chunks(ids, 200)) {
             const atomData = await fetchGraphQL(`query ($ids: [String!]!) { atoms(where: { term_id: { _in: $ids } }) { term_id label image type value { person { name } organization { name } } } }`, { ids: chunk });
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
    const pattern = `%${term}%`, id = term;
    const atomQ = `query ($pattern: String!) { atoms(where: { label: { _ilike: $pattern } }, limit: 50) { term_id label data image type creator { id label } value { person { name } organization { name } } } }`;
    const vaultQ = `query ($id: String!) { vaults(where: { term_id: { _eq: $id } }) { term_id total_assets total_shares current_share_price curve_id position_count } }`;
    try {
        const results = await Promise.all([fetchGraphQL(atomQ, { pattern }), fetchGraphQL(vaultQ, { id })]);
        const atoms = results[0]?.atoms ?? [], atomIds = atoms.map((a: any) => a.term_id);
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
  const q = `query GetGlobalClaims($limit: Int!, $offset: Int!) { triples(order_by: { block_number: desc }, limit: $limit, offset: $offset) { term_id counter_term_id block_number transaction_hash created_at subject { term_id label image type } predicate { label } object { term_id label image type } } }`;
  try {
    const data = await fetchGraphQL(q, { limit, offset });
    const items = (data?.triples ?? []).map((t: any) => {
      if (!t.subject || !t.object) return null;
      return { id: t.term_id || t.transaction_hash, subject: { id: t.subject?.term_id, label: resolveMetadata(t.subject).label, image: t.subject?.image }, predicate: (t.predicate?.label || 'SIGNAL').toUpperCase(), object: { id: t.object?.term_id, label: resolveMetadata(t.object).label, image: t.object?.image, type: (t.object?.type || 'ATOM').toUpperCase() }, confidence: 75, timestamp: t.created_at ? new Date(t.created_at).getTime() : Date.now(), txHash: t.transaction_hash, block: t.block_number };
    }).filter(Boolean) as Claim[];
    return { items, hasMore: items.length === limit };
  } catch (e) { return { items: [], hasMore: false }; } finally { isGlobalClaimsFetching = false; }
};

export const getMarketActivity = async (termId: string): Promise<Transaction[]> => {
  const ids = prepareQueryIds(termId);
  const q = `query GetMarketActivity($ids: [String!]!) { 
    events(where: { _or: [ {atom: { term_id: { _in: $ids } }}, {triple: { term_id: { _in: $ids } }} ] }, order_by: { created_at: desc }, limit: 100) { 
      id 
      type 
      created_at 
      transaction_hash
      account { id label } 
      deposit { assets_after_fees shares } 
      redemption { assets shares } 
    } 
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    const events = data?.events ?? [];
    return events.map((ev: any) => {
        const shares = ev.deposit?.shares || ev.redemption?.shares || "0";
        const assets = ev.deposit?.assets_after_fees || ev.redemption?.assets || "0";
        return { 
            id: ev.transaction_hash || ev.id, 
            type: ev.type?.toUpperCase().includes('RED') ? "REDEEM" : "DEPOSIT", 
            shares, 
            assets, 
            timestamp: ev.created_at ? new Date(ev.created_at).getTime() : Date.now(), 
            vaultId: termId, 
            user: ev.account?.label || ev.account?.id 
        };
    });
  } catch (e) { return []; }
};

export const getTopClaims = async (limit = 40, offset = 0) => {
  const q = `query GetTopTripleVaults($limit: Int!, $offset: Int!) { vaults(where: { term: { triple: { term_id: { _is_null: false } } } }, order_by: { total_assets: desc }, limit: $limit, offset: $offset) { total_assets position_count term_id term { triple { term_id counter_term_id subject { label term_id image data type } predicate { label term_id } object { label term_id image data type } counter_term { vaults { total_assets position_count } } } } } }`;
  try {
    const data = await fetchGraphQL(q, { limit, offset });
    const items = (data?.vaults ?? []).map((v: any) => {
        const t = v.term?.triple; if (!t) return null;
        const supportAssets = parseFloat(formatEther(BigInt(v.total_assets || '0'))), supportHolders = Number(v.position_count || 0);
        const counterVaults = t.counter_term?.vaults || [];
        const opposeAssets = counterVaults.reduce((acc: number, cv: any) => acc + parseFloat(formatEther(BigInt(cv.total_assets || '0'))), 0);
        const opposeHolders = counterVaults.reduce((acc: number, cv: any) => acc + Number(cv.position_count || 0), 0);
        return { id: t.term_id, counterTermId: t.counter_term_id, subject: { label: resolveMetadata(t.subject).label, id: t.subject.term_id, image: t.subject.image }, predicate: (t.predicate?.label || 'LINK').toUpperCase(), object: { label: resolveMetadata(t.object).label, id: t.object.term_id, image: t.object.image }, value: supportAssets, holders: supportHolders, opposeValue: opposeAssets, opposeHolders: opposeHolders };
    }).filter(Boolean);
    return { items, hasMore: items.length === limit };
  } catch (e) { return { items: [], hasMore: false }; }
};

export const getLists = async (limit = 40, offset = 0) => {
    const q = `query GetLists($limit: Int, $offset: Int, $where: predicate_objects_bool_exp = {}, $orderBy: [predicate_objects_order_by!] = {}) { predicate_objects(limit: $limit, offset: $offset, where: $where, order_by: $orderBy) { predicate { term_id label image } object { term_id label image } triples(limit: 8, order_by: {triple_term: {total_market_cap: desc}}) { subject { term_id label image } } triple_count total_market_cap total_position_count } }`;
    const variables = { limit, offset, orderBy: [{ total_market_cap: "desc" }], where: { _and: [{ predicate_id: { _eq: LIST_PREDICATE_ID } }] } };
    try {
        const data = await fetchGraphQL(q, variables);
        const items = (data?.predicate_objects ?? []).map((p: any) => {
            const obj = p.object, meta = resolveMetadata(obj);
            return { id: obj.term_id, label: meta.label, image: obj.image, totalItems: p.triple_count || 0, items: (p.triples || []).map((t: any) => ({ label: t.subject.label, image: t.subject.image })), value: parseFloat(formatEther(BigInt(p.total_market_cap || '0'))) };
        });
        return { items, hasMore: items.length === limit };
    } catch (e) { return { items: [], hasMore: false }; }
};

export const getAgentOpinions = async (termId: string) => { return []; };

export const getOppositionTriple = async (subjectId: string) => {
    const sIds = prepareQueryIds(subjectId), pIds = prepareQueryIds(IS_PREDICATE_ID), oIds = prepareQueryIds(DISTRUST_ATOM_ID);
    const q = `query ($sIds: [String!], $pIds: [String!], $oIds: [String!]) { triples(where: { subject_id: { _in: $sIds }, predicate_id: { _in: $pIds }, object_id: { _in: $oIds } }, limit: 1) { term_id counter_term_id subject { label term_id image type } predicate { label } object { label term_id image type } term { vaults { term_id total_assets total_shares current_share_price curve_id position_count } } } }`;
    try {
        const res = await fetchGraphQL(q, { sIds, pIds, oIds }), t = res?.triples?.[0]; if (!t) return null;
        const aggregated = aggregateVaultData(t.term?.vaults || []), v = aggregated[0], sMeta = resolveMetadata(t.subject);
        return { id: t.term_id, counterTermId: t.counter_term_id, label: `OPPOSING_${sMeta.label}`.toUpperCase(), totalAssets: v?.total_assets.toString() || "0", totalShares: v?.total_shares.toString() || "0", currentSharePrice: v?.current_share_price || "0", marketCap: v?.computed_mcap.toString() || "0", positionCount: v?.position_count || 0 };
    } catch (e) { return null; }
};

export const getUserOverview = async (address: string) => {
    const ids = prepareQueryIds(address);
    const q = `query GetUserOverview($ids: [String!]) {
        atoms(where: { term_id: { _in: $ids } }) {
            term_id label image type 
            value { person { name image description } organization { name image description } thing { name } }
        }
    }`;
    try {
        const res = await fetchGraphQL(q, { ids });
        const accountAtom = res?.atoms?.[0];
        
        const identityScanQ = `query GetLinkedIdentity($ids: [String!]) {
            triples(where: { subject_id: { _in: $ids }, object: { type: { _eq: "Person" } } }, limit: 1) {
                object {
                    term_id label image type
                    value { person { name image description } }
                }
            }
        }`;
        const identityRes = await fetchGraphQL(identityScanQ, { ids });
        const linkedIdentity = identityRes?.triples?.[0]?.object;
        
        const baseMeta = accountAtom ? resolveMetadata(accountAtom) : { label: address.slice(0, 8), type: 'ACCOUNT', description: '', image: undefined };
        const identityMeta = linkedIdentity ? resolveMetadata(linkedIdentity) : null;

        const triplesQ = `query GetUserTriples($ids: [String!]) {
            triples(where: { subject_id: { _in: $ids } }, limit: 50) {
                predicate { label }
                object { term_id label image type }
            }
        }`;
        const tRes = await fetchGraphQL(triplesQ, { ids }), tList = tRes?.triples || [];
        
        return {
            account: {
                id: address, 
                label: identityMeta?.label || baseMeta.label, 
                image: identityMeta?.image || accountAtom?.image || accountAtom?.value?.person?.image || accountAtom?.value?.organization?.image,
                atom: {
                    orgs: tList.filter((t: any) => (t.predicate?.label || '').toLowerCase().includes('member')).map((t: any) => ({ object: { label: resolveMetadata(t.object).label } })),
                    skills: tList.filter((t: any) => (t.predicate?.label || '').toLowerCase().includes('skill')).map((t: any) => ({ object: { label: resolveMetadata(t.object).label } })),
                    projects: tList.filter((t: any) => (t.predicate?.label || '').toLowerCase().includes('project')).map((t: any) => ({ object: { label: resolveMetadata(t.object).label } }))
                }
            }
        };
    } catch (e) { return { account: { id: address, label: address.slice(0, 8) } }; }
};
