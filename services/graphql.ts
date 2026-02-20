
import { GRAPHQL_URL, IS_PREDICATE_ID, DISTRUST_ATOM_ID, FEE_PROXY_ADDRESS } from '../constants';
import { Transaction, Claim, Triple } from '../types';
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

export const resolveMetadata = (atom: any) => {
    if (!atom) return { label: 'Unknown', description: '', type: 'ATOM', image: undefined, links: [] };
    
    let label = atom.label;
    let description = '';
    let image = atom.image;
    let links = [];

    // Attempt to decode primary hex data payload for enriched metadata
    if (atom.data && atom.data !== '0x') {
        try {
            const decoded = JSON.parse(hexToString(atom.data as `0x${string}`));
            if (decoded.name && (!label || label.startsWith('0x'))) label = decoded.name;
            if (decoded.description) description = decoded.description;
            if (decoded.image) image = decoded.image;
            if (decoded.links) links = decoded.links;
        } catch (e) {
            // Data field might not be JSON, skip
        }
    }
    
    if (atom.value) {
        const v = atom.value;
        const meta = v.person || v.thing || v.organization || v.account;
        if (meta) {
            if (!label || label.startsWith('0x')) label = meta.name || meta.label;
            if (!description) description = meta.description || '';
            if (!image) image = meta.image;
        }
    }

    if (atom.triple && atom.triple.object_id?.toLowerCase().includes(DISTRUST_ATOM_ID.toLowerCase().slice(26))) {
        const subjectLabel = atom.triple.subject?.label || atom.triple.subject_id?.slice(0, 8);
        return {
            label: `OPPOSING_${subjectLabel}`.toUpperCase(),
            description: `A directional signal of distrust against ${subjectLabel} on the Intuition Network.`,
            type: 'CLAIM',
            image: atom.triple.subject?.image,
            links: []
        };
    }

    return { 
        label: (label && label !== '0x' && !label.startsWith('0x00')) ? label : `${atom.term_id?.slice(0, 8)}...`, 
        description,
        type: atom.type || 'ATOM',
        image,
        links
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
        atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label image } value { person { name } organization { name } thing { name } } }
        triples(where: { term_id: { _in: $ids } }) { term_id counter_term_id creator { id label image } subject { label term_id data image type } predicate { label } object { label term_id data image type } }
    }`;

    const res = await fetchGraphQL(dataQuery, { ids: termIds });
    const atoms = res?.atoms || [];
    const triples = res?.triples || [];

    const items = aggregated.map(v => {
      const a = atoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const t = triples.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '', type: 'ATOM', image: undefined, links: [] };
      let label = meta.label, type = (meta.type || "ATOM").toUpperCase(), image = a?.image, links = meta.links;

      if (t) {
          const sMeta = resolveMetadata(t.subject), oMeta = resolveMetadata(t.object);
          label = `${sMeta.label} ${t.predicate?.label || 'LINK'} ${oMeta.label}`;
          type = "CLAIM";
          image = t.subject?.image || t.object?.image;
          links = []; // Claims usually don't have direct external links on the triple itself
      }

      return {
        id: v.term_id,
        counterTermId: t?.counter_term_id,
        label,
        description: meta.description,
        image,
        type,
        links,
        creator: a?.creator || t?.creator,
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
      atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label image } value { person { name } thing { name } } }
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      triples(where: { term_id: { _in: $ids } }) { term_id counter_term_id creator { id label image } subject { label term_id data image type } predicate { label } object { label term_id data image type } }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const aggregated = aggregateVaultData(res?.vaults || []);
    const v = aggregated[0], a = res?.atoms?.[0], t = res?.triples?.[0];
    if (!v && !a && !t) return { id: termId, label: 'Unknown', description: '', totalAssets: "0", totalShares: "0", type: 'ATOM', links: [] };

    const meta = a ? resolveMetadata(a) : { label: termId, description: '', type: 'ATOM', image: undefined, links: [] };
    let label = meta.label, type = (meta.type || "ATOM").toUpperCase(), links = meta.links;
    if (t) {
        label = `${resolveMetadata(t.subject).label} ${t.predicate?.label} ${resolveMetadata(t.object).label}`;
        type = "CLAIM";
        links = [];
    }

    return {
      id: termId, 
      counterTermId: t?.counter_term_id,
      label, description: meta.description, image: a?.image, type, links, creator: a?.creator || t?.creator,
      totalAssets: v?.total_assets.toString() || "0",
      totalShares: v?.total_shares.toString() || "0",
      currentSharePrice: v?.current_share_price || "0",
      marketCap: v?.computed_mcap.toString() || "0",
      positionCount: v?.position_count || 0
    };
  } catch (e) { return { id: termId, label: 'Offline', totalAssets: "0", totalShares: "0", type: 'ATOM', links: [] }; }
};

export const getUserHistory = async (userAddress: string): Promise<Transaction[]> => {
  const q = `query ($userAddress: String!) {
      events(limit: 500, order_by: {created_at: desc}, where: {
          _and: [{type: {_neq: "FeesTransfered"}}, {_not: {_and: [{type: {_eq: "Deposited"}}, {deposit: {assets_after_fees: {_eq: 0}}}]}}, 
          {_or: [{_and: [{type: {_eq: "AtomCreated"}}, {atom: {creator: {id: {_eq: $userAddress}}}}]}, 
          {_and: [{type: {_eq: "TripleCreated"}}, {triple: {creator: {id: {_eq: $userAddress}}}}]}, 
          {_and: [{type: {_eq: "Deposited"}}, {deposit: {sender: {id: {_eq: $userAddress}}}}]}, 
          {_and: [{type: {_eq: "Redeemed"}}, {redemption: {sender: {id: {_eq: $userAddress}}}}]}]}]
      }) {
        id created_at type transaction_hash atom { term_id label data type }
        triple { term_id subject { label term_id data } predicate { label term_id } object { label term_id data } creator { id label image } }
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

export const getGlobalActivity = async (limit: number = 40, offset: number = 0) => {
  const q = `query GetGlobalActivity($limit: Int!, $offset: Int!) {
    events(limit: $limit, offset: $offset, order_by: {created_at: desc}, where: {
      _and: [
        {type: {_in: ["Deposited", "Redeemed", "AtomCreated", "TripleCreated"]}},
        {_not: {deposit: {assets_after_fees: {_eq: "0"}}}}
      ]
    }) {
      id created_at type transaction_hash 
      atom { term_id label data image type creator { id label image } }
      triple { term_id counter_term_id subject { label term_id data image type } predicate { label } object { label term_id data image type } creator { id label image } }
      deposit { assets_after_fees shares sender { id label image } vault { curve_id } } 
      redemption { assets shares sender { id label image } vault { curve_id } }
    }
  }`;
  try {
    const data = await fetchGraphQL(q, { limit, offset });
    const events = data?.events ?? [];
    return {
        items: events.map((ev: any) => {
            let label = 'Unknown Node', vaultId = '0x', shares = '0', assets = '0', curveId = '0', sender = null, target = null;
            
            if (ev.type === 'AtomCreated' && ev.atom) { 
                const meta = resolveMetadata(ev.atom);
                label = meta.label; 
                vaultId = ev.atom.term_id; 
                sender = ev.atom.creator;
                target = { ...meta, id: ev.atom.term_id };
            }
            else if (ev.type === 'TripleCreated' && ev.triple) { 
                const sMeta = resolveMetadata(ev.triple.subject);
                const oMeta = resolveMetadata(ev.triple.object);
                label = `${sMeta.label} ${ev.triple.predicate?.label || 'LINK'} ${oMeta.label}`; 
                vaultId = ev.triple.term_id; 
                sender = ev.triple.creator;
                target = { label, id: ev.triple.term_id, type: 'CLAIM', subject: sMeta, predicate: ev.triple.predicate?.label, object: oMeta };
            }
            else if (ev.type === 'Deposited' && ev.deposit) { 
                assets = ev.deposit.assets_after_fees || '0'; 
                shares = ev.deposit.shares || '0'; 
                curveId = ev.deposit.vault?.curve_id;
                sender = ev.deposit.sender;
                if (ev.atom) { 
                    const meta = resolveMetadata(ev.atom);
                    label = meta.label; vaultId = ev.atom.term_id; 
                    target = { ...meta, id: ev.atom.term_id };
                } 
                else if (ev.triple) { 
                    const sMeta = resolveMetadata(ev.triple.subject);
                    const oMeta = resolveMetadata(ev.triple.object);
                    label = `${sMeta.label} ${ev.triple.predicate?.label || 'LINK'} ${oMeta.label}`; vaultId = ev.triple.term_id; 
                    target = { label, id: ev.triple.term_id, type: 'CLAIM', subject: sMeta, predicate: ev.triple.predicate?.label, object: oMeta };
                }
            } else if (ev.type === 'Redeemed' && ev.redemption) { 
                assets = ev.redemption.assets || '0'; 
                shares = ev.redemption.shares || '0'; 
                curveId = ev.redemption.vault?.curve_id;
                sender = ev.redemption.sender;
                if (ev.atom) { 
                    const meta = resolveMetadata(ev.atom);
                    label = meta.label; vaultId = ev.atom.term_id; 
                    target = { ...meta, id: ev.atom.term_id };
                }
                else if (ev.triple) { 
                    const sMeta = resolveMetadata(ev.triple.subject);
                    const oMeta = resolveMetadata(ev.triple.object);
                    label = `${sMeta.label} ${ev.triple.predicate?.label || 'LINK'} ${oMeta.label}`; vaultId = ev.triple.term_id; 
                    target = { label, id: ev.triple.term_id, type: 'CLAIM', subject: sMeta, predicate: ev.triple.predicate?.label, object: oMeta };
                }
            }

            return {
                id: ev.transaction_hash || ev.id,
                type: ev.type,
                timestamp: new Date(ev.created_at).getTime(),
                sender,
                target,
                assets,
                shares,
                curveId,
                vaultId
            };
        }),
        hasMore: events.length === limit
    };
  } catch (e) { return { items: [], hasMore: false }; }
};

export const getUserPositions = async (address: string) => {
  const ids = [address, address.toLowerCase()];
  const q = `query ($ids: [String!]!) {
      positions(where: { account: { id: { _in: $ids } }, shares: { _gt: "0" } }, limit: 1000) { 
        id shares account { id label image } 
        vault { term_id curve_id term { atom { term_id label data image type creator { id label image } } triple { term_id subject { label term_id data type image } predicate { label } object { label term_id data type image } counter_term_id creator { id label image } } } } 
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return data?.positions ?? [];
  } catch (e) { return []; }
};

export const getUserActivityStats = async (address: string) => {
  const addr = address.toLowerCase();
  // NOTE: Some Hasura deployments apply row caps to *_aggregate,
  // so we fetch explicit lists with a high limit and count client-side
  const q = `query GetUserActivityStats($addr: String!) {
      events(
        where: {
          _and: [
            { type: { _in: ["Deposited", "Redeemed", "AtomCreated", "TripleCreated"] } },
            { _or: [
                { deposit: { sender: { id: { _eq: $addr } } } },
                { redemption: { sender: { id: { _eq: $addr } } } },
                { atom: { creator: { id: { _eq: $addr } } } },
                { triple: { creator: { id: { _eq: $addr } } } }
            ] }
          ]
        },
        limit: 10000
      ) {
        id
      }
      positions(where: { account: { id: { _eq: $addr } }, shares: { _gt: "0" } }, limit: 10000) {
        id
      }
  }`;

  try {
    const data = await fetchGraphQL(q, { addr });
    const txCount = (data?.events || []).length;
    const holdingsCount = (data?.positions || []).length;
    return { txCount, holdingsCount };
  } catch (e) {
    return { txCount: 0, holdingsCount: 0 };
  }
};

export const getAccountPnlCurrent = async (address: string) => {
  const q = `query GetAccountPnlCurrent($input: GetAccountPnlCurrentInput!) {
    getAccountPnlCurrent(input: $input) {
      account_id
      timestamp
      equity_value
      total_assets_in
      total_assets_out
      net_invested
      total_pnl
      pnl_pct
      unrealized_pnl
    }
  }`;

  try {
    const res = await fetchGraphQL(q, { input: { account_id: address } });
    return res?.getAccountPnlCurrent ?? null;
  } catch (e) {
    return null;
  }
};

/** PnL leaderboard with pagination. p_offset: start index (0, 10, 20...), p_limit: page size */
export const getPnlLeaderboard = async (p_offset: number = 0, p_limit: number = 50) => {
  const q = `query Get_pnl_leaderboard($args: get_pnl_leaderboard_args) {
    get_pnl_leaderboard(args: $args) {
      rank
      account_id
      account_label
      total_pnl_raw
      pnl_pct
      win_rate
      total_volume_raw
    }
  }`;

  try {
    const res = await fetchGraphQL(q, { args: { p_offset, p_limit } });
    return res?.get_pnl_leaderboard ?? [];
  } catch (e) {
    return [];
  }
};

export const getVaultsByIds = async (ids: string[]) => {
  if (!ids || ids.length === 0) return [];
  const q = `query GetVaultsByIds($ids: [String!]!) {
      atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label image } value { person { name } organization { name } } }
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      triples(where: { term_id: { _in: $ids } }) { term_id counter_term_id creator { id label image } subject { label term_id data image type } predicate { label } object { label term_id data image type } }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const aggregated = aggregateVaultData(res?.vaults || []);
    const atoms = res?.atoms || [];
    const triples = res?.triples || [];
    return aggregated.map(v => {
      const a = atoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const t = triples.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '', type: 'ATOM', image: undefined, links: [] };
      let label = meta.label, type = (meta.type || "ATOM").toUpperCase(), image = a?.image, links = meta.links;
      if (t) { label = `${resolveMetadata(t.subject).label} ${t.predicate?.label || 'LINK'} ${resolveMetadata(t.object).label}`; type = "CLAIM"; image = t.subject?.image || t.object?.image; links = []; }
      return { id: v.term_id, counterTermId: t?.counter_term_id, label, description: meta.description, image, type, links, creator: a?.creator || t?.creator, totalAssets: v.total_assets.toString(), totalShares: v.total_shares.toString(), currentSharePrice: v.current_share_price, marketCap: v.computed_mcap.toString(), positionCount: v.position_count, curveId: v.curve_id };
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

export const getNetworkKPIs = async () => {
  const proxyVariants = prepareQueryIds(FEE_PROXY_ADDRESS);
  
  // High-fidelity aggregate reconciliation query
  const q = `query IntuRankSovereignKPIs($proxyVariants: [String!]!) {
    proxy_deposits: deposits(
        where: { sender_id: { _in: $proxyVariants } }, 
        limit: 1000, 
        order_by: { created_at: desc }
    ) {
      assets_after_fees 
      receiver { id label image }
      created_at
      transaction_hash
    }
    proxy_volume_aggregate: deposits_aggregate(
        where: { sender_id: { _in: $proxyVariants } }
    ) {
      aggregate {
        sum {
          assets_after_fees
        }
      }
    }
    proxy_redemptions_count: redemptions_aggregate(
        where: { sender_id: { _in: $proxyVariants } }
    ) {
      aggregate { count }
    }
    proxy_deposits_count: deposits_aggregate(
        where: { sender_id: { _in: $proxyVariants } }
    ) {
      aggregate { count }
    }
    global_vaults: vaults_aggregate { aggregate { sum { total_assets } } }
    global_atoms: atoms_aggregate { aggregate { count } }
    global_triples: triples_aggregate { aggregate { count } }
  }`;

  try {
    const data = await fetchGraphQL(q, { proxyVariants });
    
    // Use the aggregate sum for proxy volume to ensure absolute accuracy
    const totalProxyVolumeWei = BigInt(data?.proxy_volume_aggregate?.aggregate?.sum?.assets_after_fees || '0');
    const totalDepositsCount = data?.proxy_deposits_count?.aggregate?.count || 0;
    const totalRedemptionsCount = data?.proxy_redemptions_count?.aggregate?.count || 0;
    
    // User map logic for the ledger (limited to top recent for table UX)
    const userMap = new Map();
    const deposits = data?.proxy_deposits || [];
    deposits.forEach((d: any) => {
        const userId = d.receiver?.id;
        if (userId) {
            const existing = userMap.get(userId) || { id: userId, label: d.receiver.label, image: d.receiver.image, volume: 0, txCount: 0 };
            userMap.set(userId, { 
                ...existing, 
                volume: existing.volume + parseFloat(formatEther(BigInt(d.assets_after_fees || '0'))),
                txCount: existing.txCount + 1
            });
        }
    });

    const globalTVLStr = data?.global_vaults?.aggregate?.sum?.total_assets || "0";
    const globalTVLBig = BigInt(globalTVLStr);
    
    // Higher precision market share calculation
    const marketShare = globalTVLBig > 0n 
        ? (Number(totalProxyVolumeWei * 1000000n / globalTVLBig) / 10000) 
        : 0;

    return {
      proxyTVL: totalProxyVolumeWei.toString(),
      globalTVL: globalTVLStr,
      marketShare: marketShare, // Returns a number for frontend formatting
      userCount: userMap.size,
      txCount: totalDepositsCount + totalRedemptionsCount,
      atomCount: data?.global_atoms?.aggregate?.count || 0,
      signalCount: data?.global_triples?.aggregate?.count || 0,
      userLedger: Array.from(userMap.values())
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 50)
    };
  } catch (e) {
    console.error("SOVEREIGN_KPI_FETCH_FAILURE", e);
    return { proxyTVL: "0", globalTVL: "0", marketShare: 0, userCount: 0, txCount: 0, atomCount: 0, signalCount: 0, userLedger: [] };
  }
};

/**
 * --- ADDED MISSING EXPORTS TO RESOLVE IMPORT ERRORS ---
 */

export const getAgentTriples = async (termId: string): Promise<Triple[]> => {
  const ids = prepareQueryIds(termId);
  const q = `query ($ids: [String!]!) {
      triples(where: { _or: [{ subject_id: { _in: $ids } }, { object_id: { _in: $ids } }] }, order_by: { block_number: desc }) {
        term_id subject { label term_id data image type } predicate { label term_id } object { label term_id data image type } block_number transaction_hash creator { id label image }
      }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    return (res?.triples || []).map((t: any) => ({
        ...t,
        subject: { ...t.subject, label: resolveMetadata(t.subject).label },
        predicate: { ...t.predicate, label: t.predicate?.label || 'LINK' },
        object: { ...t.object, label: resolveMetadata(t.object).label }
    }));
  } catch (e) { return []; }
};

export const getTopPositions = async (limit: number = 2500) => {
  const q = `query GetTopPositions($limit: Int!) {
      positions(order_by: { shares: desc }, limit: $limit, where: { shares: { _gt: "0" } }) {
        id 
        shares 
        account_id
        account {
          id
          label
          image
        }
        vault { 
          term_id 
          total_assets 
          total_shares 
          curve_id
        }
      }
  }`;
  try {
    const res = await fetchGraphQL(q, { limit });
    return res?.positions || [];
  } catch (e) { return []; }
};

export const getTopClaims = async (limit: number = 40, offset: number = 0) => {
  const q = `query GetTopClaims($limit: Int!, $offset: Int!) {
      vaults(where: { term: { triple: { term_id: { _is_null: false } } } }, limit: $limit, offset: $offset, order_by: { total_assets: desc }) {
        term_id total_assets total_shares current_share_price curve_id position_count
        term { triple { subject { label term_id data image type } predicate { label term_id } object { label term_id data image type } } }
      }
  }`;
  try {
    const res = await fetchGraphQL(q, { limit, offset });
    const vaults = res?.vaults || [];
    const items = vaults.map((v: any) => {
        const t = v.term.triple;
        return {
            id: v.term_id,
            subject: { ...t.subject, label: resolveMetadata(t.subject).label },
            predicate: t.predicate?.label || 'LINK',
            object: { ...t.object, label: resolveMetadata(t.object).label },
            value: parseFloat(formatEther(BigInt(v.total_assets))),
            holders: v.position_count
        };
    });
    return { items, hasMore: vaults.length === limit };
  } catch (e) { return { items: [], hasMore: false }; }
};

export const searchGlobalAgents = async (term: string): Promise<{ id: string; label: string; image?: string; type?: string }[]> => {
  const t = term.trim();
  if (!t) return [];
  const pattern = `%${t}%`;
  const q = `query SearchAgents($term: String!) {
      atoms(where: { _or: [{ label: { _ilike: $term } }, { term_id: { _ilike: $term } }] }, limit: 25) {
        term_id label data image type creator { id label image }
      }
  }`;
  try {
    const res = await fetchGraphQL(q, { term: pattern });
    const atoms = res?.atoms ?? res?.data?.atoms ?? [];
    if (!Array.isArray(atoms)) return [];
    return atoms.map((a: any) => ({
      id: a.term_id,
      label: resolveMetadata(a).label,
      image: a.image,
      type: a.type
    }));
  } catch (e) {
    console.warn('searchGlobalAgents error', e);
    return [];
  }
};

export const searchAccountsByLabel = async (term: string) => {
  const q = `query SearchAccounts($term: String!) {
      accounts(where: { label: { _ilike: $term } }, limit: 10) {
        id
        label
        image
      }
  }`;

  try {
    const res = await fetchGraphQL(q, { term: `%${term}%` });
    return (res?.accounts || []) as { id: string; label: string | null; image: string | null }[];
  } catch (e) {
    return [];
  }
};

export const getLists = async (limit: number = 40, offset: number = 0) => {
  const q = `query GetLists($limit: Int!, $offset: Int!) {
      triples(where: { predicate_id: { _eq: "${LIST_PREDICATE_ID}" } }, limit: $limit, offset: $offset) {
        term_id subject { label term_id data image }
      }
  }`;
  try {
    const res = await fetchGraphQL(q, { limit, offset });
    const items = (res?.triples || []).map((t: any) => ({
        id: t.term_id,
        label: t.subject.label,
        image: t.subject.image,
        totalItems: 0 
    }));
    return { items, hasMore: items.length === limit };
  } catch (e) { return { items: [], hasMore: false }; }
};

export const getMarketActivity = async (termId: string): Promise<Transaction[]> => {
  const ids = prepareQueryIds(termId);
  const q = `query GetMarketActivity($ids: [String!]!) {
      events(where: { _or: [{ atom: { term_id: { _in: $ids } } }, { triple: { term_id: { _in: $ids } } }], _and: [{ type: { _in: ["Deposited", "Redeemed"] } }] }, order_by: { created_at: desc }, limit: 50) {
        transaction_hash created_at type deposit { shares assets_after_fees } redemption { shares assets }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return (data?.events || []).map((ev: any) => ({
      id: ev.transaction_hash,
      type: ev.type === 'Deposited' ? 'DEPOSIT' : 'REDEEM',
      shares: (ev.deposit?.shares || ev.redemption?.shares || '0').toString(),
      assets: (ev.deposit?.assets_after_fees || ev.redemption?.assets || '0').toString(),
      timestamp: new Date(ev.created_at).getTime(),
      vaultId: termId
    }));
  } catch (e) { return []; }
};

export const getHoldersForVault = async (termId: string) => {
  const ids = prepareQueryIds(termId);
  const q = `query GetHolders($ids: [String!]!) {
      positions(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }, order_by: { shares: desc }, limit: 50) {
        shares account { id label image }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    const holders = data?.positions || [];
    return { holders, totalCount: holders.length };
  } catch (e) { return { holders: [], totalCount: 0 }; }
};

export const getAtomInclusionLists = async (termId: string) => {
  const ids = prepareQueryIds(termId);
  const q = `query GetAtomInclusionLists($ids: [String!]!) {
      triples(where: { object_id: { _in: $ids }, predicate_id: { _eq: "${LIST_PREDICATE_ID}" } }) {
        term_id subject { label term_id data image }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return (data?.triples || []).map((t: any) => ({
        id: t.term_id,
        label: t.subject.label,
        image: t.subject.image
    }));
  } catch (e) { return []; }
};

export const getIdentitiesEngaged = async (termId: string) => {
  const ids = prepareQueryIds(termId);
  const q = `query GetEngaged($ids: [String!]!) {
      triples(where: { _or: [{ subject_id: { _in: $ids } }, { object_id: { _in: $ids } }] }, limit: 20) {
        subject { label term_id data image } predicate { label } object { label term_id data image }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return (data?.triples || []).map((t: any) => {
        const isSubject = ids.includes(t.subject.term_id.toLowerCase());
        const peer = isSubject ? t.object : t.subject;
        return {
            term_id: peer.term_id,
            label: resolveMetadata(peer).label,
            image: peer.image,
            predicate: t.predicate.label
        };
    });
  } catch (e) { return []; }
};

export const getIncomingTriplesForStats = async (termId: string) => {
  const ids = prepareQueryIds(termId);
  const q = `query GetIncoming($ids: [String!]!) {
      triples_aggregate(where: { object_id: { _in: $ids } }) { aggregate { count } }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return { totalCount: data?.triples_aggregate?.aggregate?.count || 0 };
  } catch (e) { return { totalCount: 0 }; }
};

export const getOppositionTriple = async (termId: string) => {
    const ids = prepareQueryIds(termId);
    const q = `query GetOpposition($ids: [String!]!) {
        triples(where: { counter_term_id: { _in: $ids } }, limit: 1) {
            term_id subject { label term_id data image } predicate { label } object { label term_id data image }
        }
    }`;
    try {
        const data = await fetchGraphQL(q, { ids });
        return data?.triples?.[0] ? { id: data.triples[0].term_id, ...data.triples[0] } : null;
    } catch (e) { return null; }
};

export const getGlobalClaims = async (limit: number = 40, offset: number = 0) => {
    const q = `query GetGlobalClaims($limit: Int!, $offset: Int!) {
        triples(limit: $limit, offset: $offset, order_by: { block_number: desc }) {
            term_id subject { label term_id data image type } predicate { label term_id } object { label term_id data image type } block_number transaction_hash created_at creator { id label image }
        }
    }`;
    try {
        const data = await fetchGraphQL(q, { limit, offset });
        const items = (data?.triples || []).map((t: any) => ({
            id: t.term_id,
            subject: { ...t.subject, label: resolveMetadata(t.subject).label },
            predicate: t.predicate?.label || 'LINK',
            object: { ...t.object, label: resolveMetadata(t.object).label },
            timestamp: new Date(t.created_at).getTime(),
            txHash: t.transaction_hash,
            block: t.block_number,
            creator: t.creator
        }));
        return { items, hasMore: items.length === limit };
    } catch (e) { return { items: [], hasMore: false }; }
};

export const getAgentOpinions = async (termId: string) => {
    return []; 
};
