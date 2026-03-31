
import { GRAPHQL_URL, IS_PREDICATE_ID, DISTRUST_ATOM_ID, FEE_PROXY_ADDRESS, MULTI_VAULT_ADDRESS, LINEAR_CURVE_ID, OFFSET_PROGRESSIVE_CURVE_ID } from '../constants';
import { Account, Transaction, Claim, Triple } from '../types';
import { hexToString, formatEther, parseEther, getAddress, isAddress } from 'viem';
import { safeWeiToEther, safeParseUnits } from './analytics';
import { publicClient } from './web3';

// Request guard to prevent parallel overlapping global claims fetches
let isGlobalClaimsFetching = false;

const LIST_PREDICATE_ID = "0x7ec36d201c842dc787b45cb5bb753bea4cf849be3908fb1b0a7d067c3c3cc1f5";

const fetchGraphQL = async (query: string, variables: any = {}, retries = 2): Promise<any> => {
  const doFetch = async () => {
    const response = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (response.status === 429 && retries > 0) {
      await new Promise((r) => setTimeout(r, 1500 * (3 - retries)));
      return fetchGraphQL(query, variables, retries - 1);
    }
    const result = await response.json();
    if (result.errors) {
      const msg = result.errors.map((e: any) => e.message || JSON.stringify(e)).join("; ");
      console.warn("GraphQL Query Error:", msg, result.errors);
      throw new Error(msg || "GraphQL error");
    }
    return result.data;
  };
  return doFetch();
};

const normalize = (x: string) => x ? x.toLowerCase() : '';

export const prepareQueryIds = (id: string) => {
    if (!id) return [];
    const base = id.trim();
    const variants = new Set<string>([base, base.toLowerCase()]);
    if (base.startsWith('0x')) {
        if (base.length === 42 && isAddress(base)) {
            try {
                variants.add(getAddress(base));
            } catch { /* use base as-is */ }
            const padded = '0x' + '0'.repeat(24) + base.slice(2);
            variants.add(padded);
            variants.add(padded.toLowerCase());
        }
        if (base.length === 66 && base.startsWith('0x000000000000000000000000')) {
            const unpadded = '0x' + base.slice(26);
            variants.add(unpadded);
            variants.add(unpadded.toLowerCase());
            if (isAddress(unpadded)) {
                try { variants.add(getAddress(unpadded)); } catch { /* ok */ }
            }
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
            if (decoded.links && Array.isArray(decoded.links)) links = decoded.links;
            // Single "url" field (e.g. from CreateSignal thing flow) → treat as creation link
            if (links.length === 0 && decoded.url && typeof decoded.url === 'string') {
                links = [{ label: 'Link', url: decoded.url }];
            }
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
            // Some indexers expose url/links on the parsed value
            if (links.length === 0 && meta.links && Array.isArray(meta.links)) links = meta.links;
            if (links.length === 0 && meta.url && typeof meta.url === 'string') links = [{ label: 'Link', url: meta.url }];
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

/** Full Account rows for specific term IDs (e.g. Arena duel pair → compare modal). Order matches input `ids`; null if no vault. */
export async function getAccountsByTermIds(ids: string[]): Promise<(Account | null)[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids.map((x) => normalize(x)).filter(Boolean))];
  if (unique.length === 0) return ids.map(() => null);

  const vaultQ = `query ArenaPairVaults($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count } }`;
  try {
    const vaultData = await fetchGraphQL(vaultQ, { ids: unique });
    const allVaults = vaultData?.vaults ?? [];
    if (allVaults.length === 0) return ids.map(() => null);

    const aggregated = aggregateVaultData(allVaults);
    const dataQuery = `query GetAgentsData ($ids: [String!]!) {
        atoms(where: { term_id: { _in: $ids } }) { term_id label data image type creator { id label image } value { person { name } organization { name } thing { name } } }
        triples(where: { term_id: { _in: $ids } }) { term_id counter_term_id creator { id label image } subject { label term_id data image type } predicate { label } object { label term_id data image type } }
    }`;

    const res = await fetchGraphQL(dataQuery, { ids: unique });
    const atoms = res?.atoms || [];
    const triples = res?.triples || [];

    const items: Account[] = aggregated.map((v: any) => {
      const a = atoms.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const t = triples.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
      const meta = a ? resolveMetadata(a) : { label: v.term_id, description: '', type: 'ATOM', image: undefined, links: [] };
      let label = meta.label;
      let type = (meta.type || 'ATOM').toUpperCase();
      let image = a?.image;
      let links = meta.links;

      if (t) {
        const sMeta = resolveMetadata(t.subject);
        const oMeta = resolveMetadata(t.object);
        label = `${sMeta.label} ${t.predicate?.label || 'LINK'} ${oMeta.label}`;
        type = 'CLAIM';
        image = t.subject?.image || t.object?.image;
        links = [];
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
        positionCount: v.position_count,
      };
    });

    const byId = new Map(items.map((i) => [normalize(i.id), i]));
    return ids.map((id) => byId.get(normalize(id)) ?? null);
  } catch {
    return ids.map(() => null);
  }
}

/** Fetches ALL newly created atoms/claims: Identity atoms (PERSON, ORG, ACCOUNT), Things, and Claims (TripleCreated). */
export const getNewlyCreatedAtoms = async (limit = 20) => {
  const q = `query GetNewlyCreated($limit: Int!) {
    events(
      where: { type: { _in: ["AtomCreated", "TripleCreated"] } },
      limit: $limit,
      order_by: { created_at: desc }
    ) {
      type
      created_at
      atom { term_id label data image type creator { id label image } value { person { name } organization { name } thing { name } account { id label } } }
      triple { term_id counter_term_id creator { id label image } subject { label term_id data image type } predicate { label } object { label term_id data image type } }
    }
  }`;
  try {
    const res = await fetchGraphQL(q, { limit });
    const events = res?.events ?? [];
    const seen = new Set<string>();
    const items: { id: string; termId: string; label: string; type: string; image?: string; creator?: any; createdAt: number }[] = [];

    for (const ev of events) {
      let termId = '';
      let meta: { label: string; type: string; image?: string };
      if (ev.type === 'AtomCreated' && ev.atom?.term_id) {
        termId = ev.atom.term_id;
        meta = resolveMetadata(ev.atom);
      } else if (ev.type === 'TripleCreated' && ev.triple?.term_id) {
        termId = ev.triple.term_id;
        const sMeta = resolveMetadata(ev.triple.subject);
        const oMeta = resolveMetadata(ev.triple.object);
        meta = {
          label: `${sMeta.label} ${ev.triple.predicate?.label || 'LINK'} ${oMeta.label}`,
          type: 'CLAIM',
          image: ev.triple.subject?.image || ev.triple.object?.image
        };
      } else continue;

      const id = normalize(termId);
      if (seen.has(id)) continue;
      seen.add(id);

      const createdAt = ev.created_at ? new Date(ev.created_at).getTime() : Date.now();
      items.push({
        id: termId,
        termId,
        label: meta.label,
        type: meta.type,
        image: meta.image,
        creator: ev.atom?.creator || ev.triple?.creator,
        createdAt
      });
    }

    const termIds = items.map(i => i.termId);
    const ids = Array.from(new Set(termIds)).flatMap(id => prepareQueryIds(id)).slice(0, 200);

    let vaults: any[] = [];
    if (ids.length > 0) {
      const vq = `query GetNewlyCreatedVaults($ids: [String!]!) {
        vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      }`;
      const vRes = await fetchGraphQL(vq, { ids });
      vaults = aggregateVaultData(vRes?.vaults ?? []);
    }

    const vaultByTerm = new Map<string, any>();
    vaults.forEach((v: any) => vaultByTerm.set(normalize(v.term_id), v));

    return items.map(item => {
      const v = vaultByTerm.get(normalize(item.termId));
      const mcap = v?.computed_mcap ?? 0;

      return {
        id: item.id,
        counterTermId: undefined,
        label: item.label,
        description: '',
        image: item.image,
        type: item.type,
        links: [],
        creator: item.creator,
        totalAssets: v?.total_assets?.toString() || '0',
        totalShares: v?.total_shares?.toString() || '0',
        currentSharePrice: v?.current_share_price || '0',
        marketCap: String(mcap),
        positionCount: v?.position_count ?? 0,
        createdAt: item.createdAt
      };
    });
  } catch (e) {
    return [];
  }
};

/** Pure split of Home trending columns — use with `getAllAgents` + `getNewlyCreatedAtoms` fetched in parallel. */
export const buildHomeAtomSectionsFrom = (
  allItems: any[],
  newlyCreatedRaw: any[],
  limitPerSection: number
) => {
  const byMarketcap = [...allItems].sort((a, b) => {
    const ma = parseFloat(a.marketCap || '0');
    const mb = parseFloat(b.marketCap || '0');
    return mb - ma;
  }).slice(0, limitPerSection);
  const roiDaily = [...allItems].sort((a, b) => (b.positionCount || 0) - (a.positionCount || 0)).slice(0, limitPerSection);

  let newlyCreated = newlyCreatedRaw;
  if (newlyCreated.length === 0 && allItems.length > 0) {
    newlyCreated = [...allItems]
      .sort((a, b) => (a.positionCount || 0) - (b.positionCount || 0))
      .slice(0, limitPerSection)
      .map((item) => ({ ...item, createdAt: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000 }));
  }

  return { roiDaily, byMarketcap, newlyCreated };
};

/** For Home: three sections — ROI daily (by activity), by marketcap, newly created (from events, fallback to low-position atoms). */
export const getHomeAtomSections = async (limitPerSection = 12) => {
  const [allItems, newlyCreatedRaw] = await Promise.all([
    getAllAgents(limitPerSection * 4, 0).then(r => r.items),
    getNewlyCreatedAtoms(limitPerSection)
  ]);
  return buildHomeAtomSectionsFrom(allItems, newlyCreatedRaw, limitPerSection);
};

/** Subgraph often attributes atom/triple creator as FeeProxy when creation routes through IntuRank — resolve real wallet from first deposit sender. */
const PROTOCOL_ROUTER_ADDRESSES = new Set(
  [FEE_PROXY_ADDRESS, MULTI_VAULT_ADDRESS].map((a) => a.toLowerCase())
);

async function resolveCreatorIfProxyRouter(
  termId: string,
  creator: { id?: string; label?: string; image?: string } | null | undefined
): Promise<{ id?: string; label?: string; image?: string } | null | undefined> {
  const cid = (creator?.id || '').toLowerCase();
  if (!termId || !cid || !PROTOCOL_ROUTER_ADDRESSES.has(cid)) return creator;

  const ids = prepareQueryIds(termId);
  const q = `query ($ids: [String!]!) {
    events(limit: 40, order_by: {created_at: asc}, where: {
      type: {_eq: "Deposited"},
      deposit: { vault: { term_id: { _in: $ids } } }
    }) {
      deposit { sender { id label image } }
    }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    for (const ev of res?.events ?? []) {
      const s = ev?.deposit?.sender;
      const sid = (s?.id || '').toLowerCase();
      if (sid && !PROTOCOL_ROUTER_ADDRESSES.has(sid) && isAddress(sid)) {
        try {
          return { id: getAddress(sid), label: s.label || undefined, image: s.image || undefined };
        } catch {
          return { id: s.id, label: s.label, image: s.image };
        }
      }
    }
  } catch (e) {
    console.warn('resolveCreatorIfProxyRouter', e);
  }
  // Do not surface router contract as a "person"; UI can fall back to Activity / deposits.
  return {
    id: undefined,
    label: 'Wallet (creation routed via FeeProxy)',
    image: undefined,
  };
}

/** Prefer the EOA that signed the AtomCreated / TripleCreated tx — subgraph creator may be a router or proxy (not the user). */
async function resolveCreatorFromCreationTx(
  termId: string,
  creator: { id?: string; label?: string; image?: string } | null | undefined,
  isTriple: boolean
): Promise<{ id?: string; label?: string; image?: string } | null | undefined> {
  if (!termId) return creator;
  const ids = prepareQueryIds(termId);
  const q = isTriple
    ? `query ($ids: [String!]!) {
        events(limit: 1, order_by: {created_at: asc}, where: {
          type: {_eq: "TripleCreated"},
          triple: { term_id: {_in: $ids} }
        }) { transaction_hash }
      }`
    : `query ($ids: [String!]!) {
        events(limit: 1, order_by: {created_at: asc}, where: {
          type: {_eq: "AtomCreated"},
          atom: { term_id: {_in: $ids} }
        }) { transaction_hash }
      }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    let hash = res?.events?.[0]?.transaction_hash as string | undefined;
    if (!hash || typeof hash !== 'string') return creator;
    if (!hash.startsWith('0x')) hash = `0x${hash}`;
    const tx = await publicClient.getTransaction({ hash: hash as `0x${string}` });
    const from = tx?.from;
    if (!from || !isAddress(from)) return creator;
    let nextId: string;
    try {
      nextId = getAddress(from);
    } catch {
      nextId = from;
    }
    const prevId = (creator?.id || '').toLowerCase();
    const same = prevId === nextId.toLowerCase();
    return {
      id: nextId,
      label: same ? creator?.label : undefined,
      image: same ? creator?.image : undefined,
    };
  } catch (e) {
    console.warn('resolveCreatorFromCreationTx', e);
    return creator;
  }
}

/** Route `id` vs `vault.term_id` from Graph (same logical term, different string padding). */
export function vaultTermMatchesRoute(routeTermId: string, vaultTermId: string | undefined | null): boolean {
  if (!routeTermId || !vaultTermId) return false;
  const routeSet = new Set(prepareQueryIds(routeTermId).map(normalize));
  for (const v of prepareQueryIds(String(vaultTermId))) {
    if (routeSet.has(normalize(v))) return true;
  }
  return false;
}

/** Address variants for Graph account_id / account.id (checksum + lowercase + padded ids from prepareQueryIds). */
function accountVariantsForGraph(account: string): string[] {
  const out = new Set<string>();
  const t = (account || '').trim();
  if (!t) return [];
  out.add(t.toLowerCase());
  try {
    if (isAddress(t)) out.add(getAddress(t));
  } catch {
    /* ignore */
  }
  for (const v of prepareQueryIds(t)) out.add(v);
  return Array.from(out);
}

export type GraphAccountRow = { id: string; label: string | null; image: string | null };

/** Batch-fetch Intuition `accounts` rows for wallet id variants (checksum, lowercase, padded). */
export async function getAccountsByIds(addresses: string[]): Promise<Map<string, GraphAccountRow>> {
  const uniq = new Set<string>();
  for (const a of addresses) {
    for (const v of accountVariantsForGraph(a)) uniq.add(v);
  }
  const ids = Array.from(uniq).slice(0, 100);
  if (!ids.length) return new Map();

  const q = `query GetAccountsByIds($ids: [String!]!) {
    accounts(where: { id: { _in: $ids } }) {
      id
      label
      image
    }
  }`;

  try {
    const res = await fetchGraphQL(q, { ids });
    const rows = res?.accounts || [];
    const map = new Map<string, GraphAccountRow>();
    for (const r of rows) {
      const id = String(r.id);
      map.set(id.toLowerCase(), { id, label: r.label ?? null, image: r.image ?? null });
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Wallet is tied to Intuition when `accounts` returns a row for an id variant; label falls back to short address. */
export function resolveIntuitionAccountForWallet(
  walletAddress: string,
  map: Map<string, GraphAccountRow>
): { label: string; image?: string } | null {
  const w = (walletAddress || '').trim();
  const short = w.length >= 10 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w || '?';
  for (const v of accountVariantsForGraph(walletAddress)) {
    const row = map.get(v.toLowerCase());
    if (row) {
      const lab = row.label && String(row.label).trim();
      return { label: lab || short, image: row.image || undefined };
    }
  }
  return null;
}

/** Subgraph position shares for a wallet + term. Uses safeParseUnits (wei or decimal strings). Prefer when MultiVault getShares disagrees with the indexer. */
export async function getSubgraphPositionSharesForTerm(
  account: string,
  termId: string
): Promise<{ linear: string; exponential: string }> {
  const ids = prepareQueryIds(termId);
  const addrs = accountVariantsForGraph(account);
  if (!ids.length || !addrs.length) return { linear: '0', exponential: '0' };

  const sumRows = (rows: any[] | undefined) => {
    let linear = 0;
    let exponential = 0;
    for (const p of rows ?? []) {
      const cid = Number(p?.vault?.curve_id);
      const sh = safeParseUnits(p?.shares != null ? String(p.shares) : '0');
      if (!Number.isFinite(sh) || sh <= 0) continue;
      if (cid === LINEAR_CURVE_ID) linear += sh;
      else if (cid === OFFSET_PROGRESSIVE_CURVE_ID) exponential += sh;
    }
    return { linear, exponential };
  };

  /** Portal-style: vaults(term) → positions(account_id) — matches Intuition GetAccountProfile / term.vaults.userPosition. */
  const sumVaultNested = (vaults: any[] | undefined) => {
    let linear = 0;
    let exponential = 0;
    for (const v of vaults ?? []) {
      const cid = Number(v?.curve_id);
      for (const p of v?.positions ?? []) {
        const sh = safeParseUnits(p?.shares != null ? String(p.shares) : '0');
        if (!Number.isFinite(sh) || sh <= 0) continue;
        if (cid === LINEAR_CURVE_ID) linear += sh;
        else if (cid === OFFSET_PROGRESSIVE_CURVE_ID) exponential += sh;
      }
    }
    return { linear, exponential };
  };

  const formatPair = (linear: number, exponential: number) => {
    const fmt = (n: number) => {
      if (n <= 0) return '0';
      return n.toFixed(n < 0.01 ? 6 : 4);
    };
    return { linear: fmt(linear), exponential: fmt(exponential) };
  };

  const qPositions = `query ($ids: [String!]!, $addrs: [String!]!) {
    positions(where: {
      _and: [
        { vault: { term_id: { _in: $ids } } },
        { _or: [
          { account_id: { _in: $addrs } },
          { account: { id: { _in: $addrs } } }
        ]}
      ]
    }) {
      shares
      vault { curve_id term_id }
    }
  }`;

  const qPwv = `query ($ids: [String!]!, $addrs: [String!]!) {
    positions_with_value(where: {
      _and: [
        { vault: { term_id: { _in: $ids } } },
        { _or: [
          { account_id: { _in: $addrs } },
          { account: { id: { _in: $addrs } } }
        ]}
      ]
    }) {
      shares
      vault { curve_id term_id }
    }
  }`;

  const qVaultsWithPositions = `query ($ids: [String!]!, $addrs: [String!]!) {
    vaults(
      where: { term_id: { _in: $ids } },
      order_by: { curve_id: asc }
    ) {
      curve_id
      term_id
      positions(where: {
        _or: [
          { account_id: { _in: $addrs } },
          { account: { id: { _in: $addrs } } }
        ]
      }) {
        shares
        account_id
      }
    }
  }`;

  const qBroad = `query ($addrs: [String!]!) {
    positions(
      where: {
        _or: [
          { account_id: { _in: $addrs } },
          { account: { id: { _in: $addrs } } }
        ]
      },
      limit: 5000,
      order_by: { shares: desc }
    ) {
      shares
      vault { curve_id term_id }
    }
  }`;

  try {
    const [resPos, resPwv, resVault] = await Promise.all([
      fetchGraphQL(qPositions, { ids, addrs }).catch(() => ({})),
      fetchGraphQL(qPwv, { ids, addrs }).catch(() => ({})),
      fetchGraphQL(qVaultsWithPositions, { ids, addrs }).catch(() => ({})),
    ]);
    const fromPos = sumRows(resPos?.positions);
    const fromPwv = sumRows(resPwv?.positions_with_value);
    const fromVault = sumVaultNested(resVault?.vaults);
    let preL = Math.max(fromPos.linear, fromPwv.linear, fromVault.linear);
    let preE = Math.max(fromPos.exponential, fromPwv.exponential, fromVault.exponential);

    // Term-scoped GraphQL filters can miss rows when term_id string form ≠ route id; Portfolio loads by account then filters — mirror that.
    if (preL < 1e-18 && preE < 1e-18) {
      const resBroad = await fetchGraphQL(qBroad, { addrs }).catch(() => ({}));
      const filtered = (resBroad?.positions ?? []).filter((p: any) => vaultTermMatchesRoute(termId, p?.vault?.term_id));
      const fromBroad = sumRows(filtered);
      preL = Math.max(preL, fromBroad.linear);
      preE = Math.max(preE, fromBroad.exponential);
    }

    return formatPair(preL, preE);
  } catch {
    return { linear: '0', exponential: '0' };
  }
}

/** Prefer the larger of RPC MultiVault balance vs subgraph-indexed position (display / UX when they disagree). */
export function pickEffectiveShareBalance(rpcStr: string, gqlStr: string): string {
  const r = parseFloat(rpcStr) || 0;
  const g = parseFloat(gqlStr) || 0;
  const m = Math.max(r, g);
  if (m <= 0) return '0.00';
  return m.toFixed(m < 0.01 ? 6 : 4);
}

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

    let rawCreator = a?.creator || t?.creator;
    rawCreator = await resolveCreatorIfProxyRouter(termId, rawCreator);
    rawCreator = await resolveCreatorFromCreationTx(termId, rawCreator, !!t);

    return {
      id: termId, 
      counterTermId: t?.counter_term_id,
      label, description: meta.description, image: a?.image, type, links, creator: rawCreator,
      totalAssets: v?.total_assets.toString() || "0",
      totalShares: v?.total_shares.toString() || "0",
      currentSharePrice: v?.current_share_price || "0",
      marketCap: v?.computed_mcap.toString() || "0",
      positionCount: v?.position_count || 0
    };
  } catch (e) { return { id: termId, label: 'Offline', totalAssets: "0", totalShares: "0", type: 'ATOM', links: [] }; }
};

/** Per-curve vault data for a term (Linear = 1, Offset Progressive / Exponential = 2). Used for curve switching in market detail. */
export interface VaultByCurve {
  term_id: string;
  total_assets: string;
  total_shares: string;
  current_share_price: string;
  curve_id: number;
  position_count: number;
}

export const getVaultsForTerm = async (termId: string): Promise<VaultByCurve[]> => {
  const ids = prepareQueryIds(termId);
  const q = `query ($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count } }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const vaults = res?.vaults ?? [];
    return vaults.map((v: any) => ({
      term_id: v.term_id,
      total_assets: v.total_assets ?? '0',
      total_shares: v.total_shares ?? '0',
      current_share_price: v.current_share_price ?? '0',
      curve_id: v.curve_id != null ? (typeof v.curve_id === 'string' ? parseInt(v.curve_id, 10) : v.curve_id) : 1,
      position_count: Number(v.position_count ?? 0),
    }));
  } catch (e) {
    return [];
  }
};

export const getUserHistory = async (userAddress: string): Promise<Transaction[]> => {
  const ids = prepareQueryIds(userAddress);
  if (!ids.length) return [];
  const q = `query ($ids: [String!]!) {
      events(limit: 500, order_by: {created_at: desc}, where: {
          _and: [{type: {_neq: "FeesTransfered"}}, {_not: {_and: [{type: {_eq: "Deposited"}}, {deposit: {assets_after_fees: {_eq: 0}}}]}}, 
          {_or: [{_and: [{type: {_eq: "AtomCreated"}}, {atom: {creator: {id: {_in: $ids}}}}]}, 
          {_and: [{type: {_eq: "TripleCreated"}}, {triple: {creator: {id: {_in: $ids}}}}]}, 
          {_and: [{type: {_eq: "Deposited"}}, {deposit: {_or: [{sender_id: {_in: $ids}}, {receiver_id: {_in: $ids}}]}}]}, 
          {_and: [{type: {_eq: "Redeemed"}}, {redemption: {_or: [{sender_id: {_in: $ids}}, {receiver_id: {_in: $ids}}]}}]}]}]
      }) {
        id created_at type transaction_hash atom { term_id label data type }
        triple { term_id subject { label term_id data } predicate { label term_id } object { label term_id data } creator { id label image } }
        deposit { shares assets_after_fees vault { term_id curve_id } } redemption { assets shares vault { term_id curve_id } }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    const events = data?.events ?? [];
    return events.map((ev: any) => {
        let label = 'Unknown Node', vaultId = '0x', shares = '0', assets = '0', type: 'DEPOSIT' | 'REDEEM' = 'DEPOSIT', curveId: number | undefined;
        if (ev.type === 'AtomCreated' && ev.atom) { label = resolveMetadata(ev.atom).label; vaultId = ev.atom.term_id; }
        else if (ev.type === 'TripleCreated' && ev.triple) { label = `${resolveMetadata(ev.triple.subject).label} ${ev.triple.predicate?.label || 'LINK'} ${resolveMetadata(ev.triple.object).label}`; vaultId = ev.triple.term_id; }
        else if (ev.type === 'Deposited' && ev.deposit) { assets = ev.deposit.assets_after_fees || '0'; shares = ev.deposit.shares || '0'; const v = ev.deposit.vault; const rawCurve = v?.curve_id ?? (ev.deposit as any).curve_id; if (rawCurve != null) curveId = typeof rawCurve === 'string' ? parseInt(rawCurve, 10) : rawCurve; if (v?.term_id) vaultId = v.term_id;
            if (ev.atom) { label = resolveMetadata(ev.atom).label; if (!vaultId || vaultId === '0x') vaultId = ev.atom.term_id; } 
            else if (ev.triple) { label = `${resolveMetadata(ev.triple.subject).label} ${resolveMetadata(ev.triple.predicate).label} ${resolveMetadata(ev.triple.object).label}`; if (!vaultId || vaultId === '0x') vaultId = ev.triple.term_id; }
        } else if (ev.type === 'Redeemed' && ev.redemption) { assets = ev.redemption.assets || '0'; shares = ev.redemption.shares || '0'; type = 'REDEEM'; const v = ev.redemption.vault; const rawCurve = v?.curve_id ?? (ev.redemption as any).curve_id; if (rawCurve != null) curveId = typeof rawCurve === 'string' ? parseInt(rawCurve, 10) : rawCurve; if (v?.term_id) vaultId = v.term_id;
            if (ev.atom) { label = resolveMetadata(ev.atom).label; if (!vaultId || vaultId === '0x') vaultId = ev.atom.term_id; }
            else if (ev.triple) { label = `${resolveMetadata(ev.triple.subject).label} ${resolveMetadata(ev.triple.predicate).label} ${resolveMetadata(ev.triple.object).label}`; if (!vaultId || vaultId === '0x') vaultId = ev.triple.term_id; }
        }
        return { id: ev.transaction_hash || ev.id, type, shares, assets, timestamp: ev.created_at ? new Date(ev.created_at).getTime() : Date.now(), vaultId, curveId, assetLabel: label };
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

/** Fetches all user positions (linear and exponential curves). No curve_id filter — both curve 1 and 2 are included. */
export const getUserPositions = async (address: string) => {
  const addrs = accountVariantsForGraph(address);
  const q = `query ($addrs: [String!]!) {
      positions(where: {
        _and: [
          { shares: { _gt: "0" } },
          { _or: [
            { account_id: { _in: $addrs } },
            { account: { id: { _in: $addrs } } }
          ]}
        ]
      }, limit: 5000, order_by: { shares: desc }) {
        id shares account_id account { id label image }
        vault { term_id curve_id total_assets total_shares current_share_price term { atom { term_id label data image type creator { id label image } } triple { term_id subject { label term_id data type image } predicate { label } object { label term_id data type image } counter_term_id creator { id label image } } } }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { addrs });
    return data?.positions ?? [];
  } catch (e) { return []; }
};

/** Fetches user positions with theoretical_value, sorted by value desc server-side. Returns [] if schema does not support positions_with_value. */
export const getPortfolioPositionsWithValue = async (address: string): Promise<any[]> => {
  const addr = address.toLowerCase();
  const addrVariants = [addr];
  try {
    const checksummed = (await import('viem')).getAddress(address);
    if (checksummed !== addr) addrVariants.push(checksummed);
  } catch { /* ignore */ }
  const q = `query GetPortfolioPositionsWithValue($where: positions_with_value_bool_exp!, $orderBy: [positions_with_value_order_by!], $limit: Int!) {
    positions_with_value(where: $where, order_by: $orderBy, limit: $limit) {
      id shares theoretical_value pnl pnl_pct
      account_id
      vault { term_id curve_id total_assets total_shares current_share_price term { atom { term_id label data image type } triple { term_id subject { label term_id data image type } predicate { label } object { label term_id data image type } counter_term_id } } }
    }
  }`;
  try {
    const res = await fetchGraphQL(q, {
      where: { shares: { _gt: '0' }, account_id: { _in: addrVariants } },
      orderBy: [{ theoretical_value: 'desc' }],
      limit: 5000,
    });
    const rows = res?.positions_with_value ?? [];
    if (rows.length > 0) return rows;
    // Fallback: try account relation if account_id returned nothing
    const qAlt = `query GetPortfolioPositionsWithValueAlt($ids: [String!]!, $orderBy: [positions_with_value_order_by!], $limit: Int!) {
      positions_with_value(where: { shares: { _gt: "0" }, account: { id: { _in: $ids } } }, order_by: $orderBy, limit: $limit) {
        id shares theoretical_value pnl pnl_pct
        account_id
        vault { term_id curve_id total_assets total_shares current_share_price term { atom { term_id label data image type } triple { term_id subject { label term_id data image type } predicate { label } object { label term_id data image type } counter_term_id } } }
      }
    }`;
    const resAlt = await fetchGraphQL(qAlt, { ids: addrVariants, orderBy: [{ theoretical_value: 'desc' }], limit: 5000 });
    return resAlt?.positions_with_value ?? [];
  } catch (e) {
    return [];
  }
};

/** User's total transaction count from the Intuition graph (same semantics as getUserHistory: Deposited, Redeemed, AtomCreated, TripleCreated). */
export const getUserIdTransactionCount = async (userAddress: string): Promise<number> => {
  const addr = userAddress.toLowerCase();
  const q = `query GetUserIdTransactionCount($userAddress: String!) {
    events_aggregate(
      where: {
        _and: [
          { type: { _neq: "FeesTransfered" } },
          { _not: { _and: [{ type: { _eq: "Deposited" } }, { deposit: { assets_after_fees: { _eq: 0 } } }] } },
          { _or: [
            { _and: [{ type: { _eq: "AtomCreated" } }, { atom: { creator: { id: { _eq: $userAddress } } } }] },
            { _and: [{ type: { _eq: "TripleCreated" } }, { triple: { creator: { id: { _eq: $userAddress } } } }] },
            { _and: [{ type: { _eq: "Deposited" } }, { deposit: { sender: { id: { _eq: $userAddress } } } }] },
            { _and: [{ type: { _eq: "Redeemed" } }, { redemption: { sender: { id: { _eq: $userAddress } } } }] }
          ]}
        ]
      }
    ) { aggregate { count } }
  }`;
  try {
    const data = await fetchGraphQL(q, { userAddress: addr });
    const count = data?.events_aggregate?.aggregate?.count;
    return typeof count === 'number' ? count : 0;
  } catch (e) {
    return 0;
  }
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

/** Identities and claims created by the user (My Created section). Uses events (AtomCreated/TripleCreated) which reliably filter by creator. */
export const getMyCreated = async (address: string): Promise<{ identities: any[]; claims: any[] }> => {
  const addr = address.toLowerCase();
  const addrVariants = [addr];
  try {
    const checksummed = (await import('viem')).getAddress(address);
    if (checksummed !== addr) addrVariants.push(checksummed);
  } catch { /* use lowercase only if invalid */ }
  const q = `query GetMyCreatedEvents($addrVariants: [String!]!) {
    events(
      where: {
        _or: [
          { _and: [{ type: { _eq: "AtomCreated" } }, { atom: { creator: { id: { _in: $addrVariants } } } }] },
          { _and: [{ type: { _eq: "TripleCreated" } }, { triple: { creator: { id: { _in: $addrVariants } } } }] }
        ]
      },
      limit: 200,
      order_by: { created_at: desc }
    ) {
      type
      atom { term_id label data image type }
      triple { term_id counter_term_id subject { label term_id data image type } predicate { label } object { label term_id data image type } }
    }
  }`;
  try {
    const res = await fetchGraphQL(q, { addrVariants });
    const events = res?.events ?? [];

    const identities: any[] = [];
    const claims: any[] = [];
    const seenAtomIds = new Set<string>();
    const seenTripleIds = new Set<string>();

    for (const ev of events) {
      if (ev.type === 'AtomCreated' && ev.atom?.term_id) {
        const id = normalize(ev.atom.term_id);
        if (!seenAtomIds.has(id)) {
          seenAtomIds.add(id);
          identities.push(ev.atom);
        }
      } else if (ev.type === 'TripleCreated' && ev.triple?.term_id) {
        const id = normalize(ev.triple.term_id);
        if (!seenTripleIds.has(id)) {
          seenTripleIds.add(id);
          claims.push(ev.triple);
        }
      }
    }

    const allTermIds = [...identities.map((a: any) => a.term_id), ...claims.map((t: any) => t.term_id)].filter(Boolean);
    const ids = Array.from(new Set(allTermIds)).flatMap((id: string) => prepareQueryIds(id)).slice(0, 300);

    let vaults: any[] = [];
    if (ids.length > 0) {
      const vq = `query GetMyCreatedVaults($ids: [String!]!) {
        vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      }`;
      const vRes = await fetchGraphQL(vq, { ids });
      vaults = aggregateVaultData(vRes?.vaults ?? []);
    }

    const vaultByTerm = new Map<string, any>();
    vaults.forEach((v: any) => vaultByTerm.set(normalize(v.term_id), v));

    const identityItems = identities.map((a: any) => {
      const meta = resolveMetadata(a);
      const v = vaultByTerm.get(normalize(a.term_id));
      const mcap = v ? (v.computed_mcap ?? parseFloat(formatEther(BigInt(v.total_assets || '0')))) : 0;
      return {
        id: a.term_id,
        label: meta.label,
        type: (a.type || 'ATOM').toUpperCase(),
        image: a.image || meta.image,
        marketCap: mcap,
        positionCount: v?.position_count ?? 0,
      };
    }).sort((a: any, b: any) => (b.marketCap ?? 0) - (a.marketCap ?? 0));

    const claimItems = claims.map((t: any) => {
      const sMeta = resolveMetadata(t.subject);
      const oMeta = resolveMetadata(t.object);
      const label = `${sMeta.label} ${t.predicate?.label || 'LINK'} ${oMeta.label}`;
      const v = vaultByTerm.get(normalize(t.term_id));
      const mcap = v ? (v.computed_mcap ?? parseFloat(formatEther(BigInt(v.total_assets || '0')))) : 0;
      return {
        id: t.term_id,
        counterTermId: t.counter_term_id,
        label,
        type: 'CLAIM',
        image: t.subject?.image || t.object?.image,
        marketCap: mcap,
        positionCount: v?.position_count ?? 0,
      };
    }).sort((a: any, b: any) => (b.marketCap ?? 0) - (a.marketCap ?? 0));

    return { identities: identityItems, claims: claimItems };
  } catch (e) {
    return { identities: [], claims: [] };
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

/** Normalize epoch boundaries to full ISO-8601 UTC (`…T…Z` → `…T….000Z`) so they match GraphQL playground payloads. */
export const normalizeGraphqlIsoDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString();
};

/** Build args for get_pnl_leaderboard_period. Schema requires p_start_date and p_end_date (ISO strings). */
export const buildPnlLeaderboardPeriodArgs = (
  startDate: string,
  endDate: string,
  options?: { limit?: number; offset?: number; sortBy?: string; sortOrder?: string }
) => {
  const args: Record<string, unknown> = { p_start_date: startDate, p_end_date: endDate };
  if (options?.limit != null) args.p_limit = options.limit;
  if (options?.offset != null) args.p_offset = options.offset;
  if (options?.sortBy != null) args.p_sort_by = options.sortBy;
  if (options?.sortOrder != null) args.p_sort_order = options.sortOrder;
  return args;
};

/** Build args for get_pnl_leaderboard_period_min_threshold (same optional paging/sort keys as period). */
export const buildPnlLeaderboardPeriodMinThresholdArgs = (
  startDate: string,
  endDate: string,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: string;
    excludeProtocolAccounts?: boolean;
    minDeposit?: number;
    minPositions?: number;
    minVolume?: number;
    termId?: string;
  }
) => {
  const args: Record<string, unknown> = { p_start_date: startDate, p_end_date: endDate };
  if (options?.limit != null) args.p_limit = options.limit;
  if (options?.offset != null) args.p_offset = options.offset;
  if (options?.sortBy != null) args.p_sort_by = options.sortBy;
  if (options?.sortOrder != null) args.p_sort_order = options.sortOrder;
  if (options?.excludeProtocolAccounts != null) args.p_exclude_protocol_accounts = options.excludeProtocolAccounts;
  if (options?.minDeposit != null) args.p_min_deposit = options.minDeposit;
  if (options?.minPositions != null) args.p_min_positions = options.minPositions;
  if (options?.minVolume != null) args.p_min_volume = options.minVolume;
  if (options?.termId != null) args.p_term_id = options.termId;
  return args;
};

/** Season 2 / epoch-based PnL leaderboard. Uses get_pnl_leaderboard_period for epoch date range (e.g. Epoch 8 = Feb 24 - Mar 10). */
export const getPnlLeaderboardPeriod = async (args: Record<string, unknown> = {}, limit?: number) => {
  const q = `query GetPnlLeaderboardPeriod($args: get_pnl_leaderboard_period_args!) {
    get_pnl_leaderboard_period(args: $args) {
      rank
      account_id
      account_label
      account_image
      total_pnl_raw
      pnl_pct
    }
  }`;
  try {
    const res = await fetchGraphQL(q, { args: args || {} });
    const arr = res?.get_pnl_leaderboard_period ?? [];
    return limit != null ? arr.slice(0, limit) : arr;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[graphql] getPnlLeaderboardPeriod failed', e);
    return [];
  }
};

/** Epoch-based PnL leaderboard with minimum threshold filtering and realized PnL fields. */
export const getPnlLeaderboardPeriodMinThreshold = async (args: Record<string, unknown> = {}, limit?: number) => {
  const q = `query GetPnlLeaderboardPeriodMinThreshold($args: get_pnl_leaderboard_period_min_threshold_args!) {
    get_pnl_leaderboard_period_min_threshold(args: $args) {
      rank
      account_id
      account_label
      account_image
      realized_pnl_pct
      unrealized_pnl_pct
      realized_pnl_formatted
      unrealized_pnl_formatted
    }
  }`;
  try {
    const res = await fetchGraphQL(q, { args: args || {} });
    const arr = res?.get_pnl_leaderboard_period_min_threshold ?? [];
    return limit != null ? arr.slice(0, limit) : arr;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[graphql] getPnlLeaderboardPeriodMinThreshold failed', e);
    return [];
  }
};

/** User's position on Season 2 / epoch-based PnL leaderboard */
export const getPnlLeaderboardPeriodAccount = async (accountId: string, args: Record<string, unknown> = {}) => {
  const q = `query GetPnlLeaderboardPeriodAccount($args: get_pnl_leaderboard_period_args!) {
    get_pnl_leaderboard_period(args: $args) {
      rank
      account_id
      account_label
      account_image
      total_pnl_raw
      pnl_pct
    }
  }`;
  try {
    const res = await fetchGraphQL(q, { args: args || {} });
    const arr = res?.get_pnl_leaderboard_period ?? [];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.find((row: any) => String(row.account_id).toLowerCase() === accountId.toLowerCase()) ?? null;
  } catch {
    return null;
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
  const q = `query {
    vaults_aggregate { aggregate { sum { total_assets } } }
    atoms_aggregate { aggregate { count } }
    triples_aggregate { aggregate { count } }
    positions_aggregate(where: { shares: { _gt: "0" } }) { aggregate { count } }
  }`;
  try {
    const data = await fetchGraphQL(q);
    const positionCount = data?.positions_aggregate?.aggregate?.count ?? 0;
    return {
      tvl: data?.vaults_aggregate?.aggregate?.sum?.total_assets || "0",
      atoms: data?.atoms_aggregate?.aggregate?.count || 0,
      signals: data?.triples_aggregate?.aggregate?.count || 0,
      positions: typeof positionCount === 'number' ? positionCount : 0
    };
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
        term_id counter_term_id subject { label term_id data image type } predicate { label term_id } object { label term_id data image type } block_number transaction_hash creator { id label image }
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

/** Triples involving this term, enriched with support/oppose vault stats for the claims table. */
export const getAgentTriplesWithVaults = async (termId: string): Promise<Array<{
  id: string;
  counterTermId?: string;
  subject: { term_id: string; label: string; image?: string };
  predicate: { label: string };
  object: { term_id: string; label: string; image?: string };
  creator?: { id: string; label?: string; image?: string };
  transaction_hash?: string;
  supportTotalAssets: string;
  supportPositionCount: number;
  opposeTotalAssets: string;
  opposePositionCount: number;
}>> => {
  const ids = prepareQueryIds(termId);
  const tripleTermsQ = `query GetAtomClaimsView($where: triple_term_bool_exp, $orderBy: [triple_term_order_by!], $limit: Int, $offset: Int) {
    triple_terms(where: $where, order_by: $orderBy, limit: $limit, offset: $offset) {
      term_id
      counter_term_id
      total_assets
      total_market_cap
      total_position_count
      term {
        triple {
          term_id
          subject { term_id label data image type }
          predicate { label term_id }
          object { term_id label data image type }
          creator { id label image }
        }
      }
      counter_term {
        total_assets
        total_market_cap
        positions_aggregate { aggregate { count } }
      }
    }
  }`;
  try {
    const ttRes = await fetchGraphQL(tripleTermsQ, {
      where: { term: { triple: { _or: [{ subject_id: { _in: ids } }, { object_id: { _in: ids } }] } } },
      orderBy: [{ total_market_cap: 'desc' }],
      limit: 100,
      offset: 0,
    });
    const tt = ttRes?.triple_terms;
    if (Array.isArray(tt) && tt.length > 0) {
      return tt.map((row: any) => {
        const t = row.term?.triple;
        const ct = row.counter_term;
        const supportAssets = row.total_assets ?? row.term?.total_assets ?? '0';
        const opposeAssets = ct?.total_assets ?? '0';
        const supportCount = row.total_position_count ?? row.term?.positions_aggregate?.aggregate?.count ?? 0;
        const opposeCount = ct?.positions_aggregate?.aggregate?.count ?? 0;
        return {
          id: row.term_id,
          counterTermId: row.counter_term_id,
          subject: { ...t?.subject, label: t?.subject ? resolveMetadata(t.subject).label : 'Unknown' },
          predicate: { label: t?.predicate?.label || 'LINK' },
          object: { ...t?.object, label: t?.object ? resolveMetadata(t.object).label : 'Unknown' },
          creator: t?.creator,
          transaction_hash: undefined,
          supportTotalAssets: String(supportAssets),
          supportPositionCount: Number(supportCount),
          opposeTotalAssets: String(opposeAssets),
          opposePositionCount: Number(opposeCount),
        };
      });
    }
  } catch (_) { /* triple_terms not available, fall through */ }
  const q = `query ($ids: [String!]!) {
      triples(where: { _or: [{ subject_id: { _in: $ids } }, { object_id: { _in: $ids } }] }, order_by: { block_number: desc }, limit: 100) {
        term_id counter_term_id subject { label term_id data image type } predicate { label term_id } object { label term_id data image type } block_number transaction_hash creator { id label image }
      }
  }`;
  try {
    const res = await fetchGraphQL(q, { ids });
    const triples = res?.triples || [];
    if (triples.length === 0) return [];
    const termIds = triples.map((t: any) => t.term_id).filter(Boolean);
    const counterIds = triples.map((t: any) => t.counter_term_id).filter(Boolean);
    const allIds = [...termIds, ...counterIds];
    const idsForVault = Array.from(new Set(allIds.flatMap((id: string) => prepareQueryIds(id)))).slice(0, 200);
    const vaultQ = `query GetClaimVaults($ids: [String!]!) {
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
    }`;
    const [vaultRes, posRes] = await Promise.all([
      fetchGraphQL(vaultQ, { ids: idsForVault }),
      (() => {
        const holderIds = Array.from(new Set(allIds.flatMap((id: string) => prepareQueryIds(id)))).slice(0, 200);
        if (holderIds.length === 0) return Promise.resolve({ positions: [] });
        return fetchGraphQL(`query GetPositionsForHolders($ids: [String!]!) {
          positions(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }, limit: 10000) {
            account_id
            account { id }
            vault { term_id }
          }
        }`, { ids: holderIds });
      })()
    ]);
    const agg = aggregateVaultData(vaultRes?.vaults || []);
    const supportMap = new Map(agg.map((v: any) => [normalize(v.term_id), v]));
    const counterIdsForQuery = Array.from(new Set(counterIds.flatMap((id: string) => prepareQueryIds(id)))).slice(0, 100);
    let opposeMap: Record<string, { total_assets: string; position_count: number }> = {};
    if (counterIdsForQuery.length > 0) {
      const counterRes = await fetchGraphQL(vaultQ, { ids: counterIdsForQuery });
      aggregateVaultData(counterRes?.vaults || []).forEach((v: any) => {
        opposeMap[normalize(v.term_id)] = { total_assets: v.total_assets?.toString() ?? '0', position_count: v.position_count ?? 0 };
      });
    }
    const byTermAccounts = new Map<string, Set<string>>();
    (posRes?.positions || []).forEach((p: any) => {
      const tid = normalize(p.vault?.term_id);
      if (!tid) return;
      const accId = ((p.account_id || p.account?.id) || '').toLowerCase();
      if (!accId) return;
      if (!byTermAccounts.has(tid)) byTermAccounts.set(tid, new Set());
      byTermAccounts.get(tid)!.add(accId);
    });
    const holderCountByTerm = new Map<string, number>();
    byTermAccounts.forEach((accounts, tid) => holderCountByTerm.set(tid, accounts.size));
    return triples.map((t: any) => {
      const v = supportMap.get(normalize(t.term_id));
      const oppose = t.counter_term_id ? opposeMap[normalize(t.counter_term_id)] : null;
      const supportHolders = holderCountByTerm.get(normalize(t.term_id)) ?? v?.position_count ?? 0;
      const opposeHolders = t.counter_term_id ? (holderCountByTerm.get(normalize(t.counter_term_id)) ?? oppose?.position_count ?? 0) : 0;
      return {
        id: t.term_id,
        counterTermId: t.counter_term_id,
        subject: { ...t.subject, label: resolveMetadata(t.subject).label },
        predicate: { label: t.predicate?.label || 'LINK' },
        object: { ...t.object, label: resolveMetadata(t.object).label },
        creator: t.creator,
        transaction_hash: t.transaction_hash,
        supportTotalAssets: v?.total_assets != null ? String(v.total_assets) : '0',
        supportPositionCount: supportHolders,
        opposeTotalAssets: oppose?.total_assets ?? '0',
        opposePositionCount: opposeHolders,
      };
    });
  } catch (e) {
    console.warn('getAgentTriplesWithVaults error', e);
    return [];
  }
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
  // Primary: triple_terms — canonical claims API, most complete
  const tripleTermsQ = `query GetTopClaimsTripleTerms($limit: Int!, $offset: Int!) {
    triple_terms(where: {}, order_by: { total_market_cap: desc }, limit: $limit, offset: $offset) {
      term_id
      counter_term_id
      total_assets
      total_market_cap
      total_position_count
      term {
        total_market_cap
        total_assets
        positions_aggregate { aggregate { count } }
        triple {
          term_id
          counter_term_id
          subject { term_id label data image type }
          predicate { label term_id }
          object { term_id label data image type }
        }
      }
      counter_term {
        total_assets
        total_market_cap
        positions_aggregate { aggregate { count } }
      }
    }
  }`;
  try {
    const ttRes = await fetchGraphQL(tripleTermsQ, { limit, offset });
    const tt = ttRes?.triple_terms;
    if (Array.isArray(tt) && tt.length > 0) {
      const items = tt.map((row: any) => {
        const t = row.term?.triple;
        const ct = row.counter_term;
        if (!t) return null;
        const supportMcap = row.total_market_cap ?? row.term?.total_market_cap;
        const opposeMcap = ct?.total_market_cap;
        const supportAssets = row.total_assets ?? row.term?.total_assets ?? '0';
        const opposeAssets = ct?.total_assets ?? '0';
        // API may return wei (raw) or ether; safeWeiToEther normalizes both
        const supportVal = supportMcap != null && Number(supportMcap) > 0
          ? (Number(supportMcap) > 1e15 ? safeWeiToEther(supportMcap) : Number(supportMcap))
          : parseFloat(formatEther(BigInt(supportAssets)));
        const opposeVal = opposeMcap != null && Number(opposeMcap) > 0
          ? (Number(opposeMcap) > 1e15 ? safeWeiToEther(opposeMcap) : Number(opposeMcap))
          : parseFloat(formatEther(BigInt(opposeAssets)));
        return {
          id: row.term_id,
          counterTermId: row.counter_term_id,
          subject: { ...t.subject, label: resolveMetadata(t.subject).label },
          predicate: t.predicate?.label || 'LINK',
          object: { ...t.object, label: resolveMetadata(t.object).label },
          value: supportVal,
          holders: row.total_position_count ?? row.term?.positions_aggregate?.aggregate?.count ?? 0,
          opposeValue: opposeVal,
          opposeHolders: ct?.positions_aggregate?.aggregate?.count ?? 0
        };
      }).filter(Boolean);
      return { items, hasMore: tt.length >= limit };
    }
  } catch (_) { /* triple_terms not available, fall through */ }

  // Fallback: vaults-based (legacy)
  const fetchLimit = Math.max(limit * 10, 1000);
  const q = `query GetTopClaims($limit: Int!, $offset: Int!) {
      vaults(where: { term: { triple: { term_id: { _is_null: false } } } }, limit: $limit, offset: $offset, order_by: { total_assets: desc }) {
        term_id total_assets total_shares current_share_price curve_id position_count
        term { triple { counter_term_id subject { label term_id data image type } predicate { label term_id } object { label term_id data image type } } }
      }
  }`;
  try {
    const [res, res2] = await Promise.all([
      fetchGraphQL(q, { limit: fetchLimit, offset: 0 }),
      fetchGraphQL(q, { limit: 500, offset: fetchLimit }),
    ]);
    const vaults = [...(res?.vaults || []), ...(res2?.vaults || [])];
    const supportIdsForQuery = Array.from(new Set(vaults.flatMap((v: any) => prepareQueryIds(v.term_id)))).slice(0, 800);
    let supportVaults = vaults;
    if (supportIdsForQuery.length > 0) {
      const fullQ = `query GetSupportVaultsFull($ids: [String!]!) {
        vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      }`;
      const fullRes = await fetchGraphQL(fullQ, { ids: supportIdsForQuery });
      const allSupportVaults = fullRes?.vaults || [];
      supportVaults = allSupportVaults.length > 0 ? allSupportVaults : vaults;
    }
    const supportAggregated = aggregateVaultData(supportVaults);
    supportAggregated.sort((a: any, b: any) => {
      const aVal = (a.computed_mcap ?? 0) > 0 ? a.computed_mcap : parseFloat(formatEther(BigInt(a.total_assets)));
      const bVal = (b.computed_mcap ?? 0) > 0 ? b.computed_mcap : parseFloat(formatEther(BigInt(b.total_assets)));
      return bVal - aVal;
    });
    const paginated = supportAggregated.slice(offset, offset + limit);
    const counterTermIds = paginated
      .map((v: any) => {
        const v0 = vaults.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
        return v0?.term?.triple?.counter_term_id;
      })
      .filter((id: string | null | undefined) => id && id.trim() !== '');
    const idsForQuery = Array.from(new Set(counterTermIds.flatMap((id: string) => prepareQueryIds(id)))).slice(0, 400);
    let opposeMap: Record<string, { total_assets: string; computed_mcap: number; position_count: number }> = {};
    if (idsForQuery.length > 0) {
      const counterQ = `query GetOpposeVaults($ids: [String!]!) {
        vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
      }`;
      const counterRes = await fetchGraphQL(counterQ, { ids: idsForQuery });
      const counterVaults = counterRes?.vaults || [];
      const opposeAggregated = aggregateVaultData(counterVaults);
      opposeAggregated.forEach((v: any) => {
        const id = normalize(v.term_id);
        opposeMap[id] = { total_assets: v.total_assets.toString(), computed_mcap: v.computed_mcap ?? 0, position_count: v.position_count || 0 };
      });
    }
    const allTermIdsForHolders = [
      ...paginated.map((v: any) => v.term_id),
      ...counterTermIds
    ];
    const holderIdsForQuery = Array.from(new Set(allTermIdsForHolders.flatMap((id: string) => prepareQueryIds(id)))).slice(0, 400);
    let supportHolderMap: Record<string, number> = {};
    let opposeHolderMap: Record<string, number> = {};
    if (holderIdsForQuery.length > 0) {
      const posQ = `query GetPositionsForHolders($ids: [String!]!) {
        positions(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }, limit: 15000) {
          account_id
          account { id }
          vault { term_id }
        }
      }`;
      const posRes = await fetchGraphQL(posQ, { ids: holderIdsForQuery });
      const positions = posRes?.positions || [];
      const supportTermIdSet = new Set(paginated.map((v: any) => normalize(v.term_id)));
      const opposeTermIdSet = new Set(counterTermIds.filter(Boolean).map((id: string) => normalize(id)));
      const byTerm = new Map<string, Set<string>>();
      positions.forEach((p: any) => {
        const tid = normalize(p.vault?.term_id);
        if (!tid) return;
        if (!byTerm.has(tid)) byTerm.set(tid, new Set());
        const accId = ((p.account_id || p.account?.id) || '').toLowerCase();
        if (accId) byTerm.get(tid)!.add(accId);
      });
      byTerm.forEach((accounts, tid) => {
        const count = accounts.size;
        if (supportTermIdSet.has(tid)) supportHolderMap[tid] = count;
        if (opposeTermIdSet.has(tid)) opposeHolderMap[tid] = count;
      });
    }
    const items = paginated.map((v: any) => {
        const v0 = vaults.find((x: any) => normalize(x.term_id) === normalize(v.term_id));
        const t = v0?.term?.triple;
        if (!t) return null;
        const counterId = t?.counter_term_id ? normalize(t.counter_term_id) : null;
        const oppose = counterId ? opposeMap[counterId] : null;
        const supportHolders = supportHolderMap[normalize(v.term_id)] ?? v.position_count ?? 0;
        const opposeHolders = counterId ? (opposeHolderMap[counterId] ?? oppose?.position_count ?? 0) : 0;
        return {
            id: v.term_id,
            counterTermId: t.counter_term_id,
            subject: { ...t.subject, label: resolveMetadata(t.subject).label },
            predicate: t.predicate?.label || 'LINK',
            object: { ...t.object, label: resolveMetadata(t.object).label },
            value: (v.computed_mcap ?? 0) > 0 ? v.computed_mcap : parseFloat(formatEther(BigInt(v.total_assets))),
            holders: supportHolders,
            opposeValue: oppose ? (oppose.computed_mcap ?? 0) > 0 ? oppose.computed_mcap : parseFloat(formatEther(BigInt(oppose.total_assets))) : 0,
            opposeHolders
        };
    }).filter(Boolean);
    return { items, hasMore: supportAggregated.length > offset + limit };
  } catch (e) { return { items: [], hasMore: false }; }
};

export const searchClaims = async (term: string): Promise<any[]> => {
  const t = term.trim();
  if (!t || t.length < 2) return [];
  const pattern = `%${t}%`;
  const q = `query SearchClaims($subj: String!, $obj: String!) {
    triples(where: { _or: [
      { subject: { label: { _ilike: $subj } } },
      { subject: { label: { _ilike: $obj } } },
      { object: { label: { _ilike: $subj } } },
      { object: { label: { _ilike: $obj } } }
    ] }, limit: 30) {
      term_id counter_term_id subject { label term_id data image type } predicate { label term_id } object { label term_id data image type }
    }
  }`;
  try {
    const res = await fetchGraphQL(q, { subj: pattern, obj: pattern });
    const triples = res?.triples || [];
    if (triples.length === 0) return [];
    const termIds = triples.map((x: any) => x.term_id);
    const idsForVault = Array.from(new Set(termIds.flatMap((id: string) => prepareQueryIds(id)))).slice(0, 100);
    const vaultQ = `query GetClaimVaults($ids: [String!]!) {
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
    }`;
    const vaultRes = await fetchGraphQL(vaultQ, { ids: idsForVault });
    const allVaults = vaultRes?.vaults || [];
    const agg = aggregateVaultData(allVaults);
    const aggMap = new Map(agg.map((v: any) => [normalize(v.term_id), v]));
    const counterIds = triples.map((t: any) => t.counter_term_id).filter(Boolean);
    const counterIdsForQuery = Array.from(new Set(counterIds.flatMap((id: string) => prepareQueryIds(id)))).slice(0, 100);
    let opposeMap: Record<string, { total_assets: string; computed_mcap: number; position_count: number }> = {};
    if (counterIdsForQuery.length > 0) {
      const counterRes = await fetchGraphQL(vaultQ, { ids: counterIdsForQuery });
      const counterVaults = counterRes?.vaults || [];
      aggregateVaultData(counterVaults).forEach((v: any) => {
        opposeMap[normalize(v.term_id)] = { total_assets: v.total_assets.toString(), computed_mcap: v.computed_mcap ?? 0, position_count: v.position_count || 0 };
      });
    }
    return triples.map((t: any) => {
      const v = aggMap.get(normalize(t.term_id));
      const oppose = t.counter_term_id ? opposeMap[normalize(t.counter_term_id)] : null;
      return {
        id: t.term_id,
        subject: { ...t.subject, label: resolveMetadata(t.subject).label },
        predicate: t.predicate?.label || 'LINK',
        object: { ...t.object, label: resolveMetadata(t.object).label },
        value: v ? ((v.computed_mcap ?? 0) > 0 ? v.computed_mcap : parseFloat(formatEther(BigInt(v.total_assets)))) : 0,
        holders: v?.position_count ?? 0,
        opposeValue: oppose ? (oppose.computed_mcap > 0 ? oppose.computed_mcap : parseFloat(formatEther(BigInt(oppose.total_assets)))) : 0,
        opposeHolders: oppose?.position_count ?? 0,
      };
    });
  } catch (e) {
    console.warn('searchClaims error', e);
    return [];
  }
};

export const searchGlobalAgents = async (term: string): Promise<{ id: string; label: string; image?: string; type?: string; description?: string; marketCap?: string; positionCount?: number }[]> => {
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
    const termIds = atoms.map((a: any) => a.term_id);
    if (termIds.length === 0) return [];
    const vq = `query SearchAgentsVaults($ids: [String!]!) {
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count }
    }`;
    const vRes = await fetchGraphQL(vq, { ids: termIds });
    const aggregated = aggregateVaultData(vRes?.vaults || []);
    const vaultByTerm = new Map<string, any>();
    aggregated.forEach((v: any) => vaultByTerm.set(normalize(v.term_id), v));
    const items = atoms.map((a: any) => {
      const meta = resolveMetadata(a);
      const v = vaultByTerm.get(normalize(a.term_id));
      const mcap = v ? (v.computed_mcap ?? parseFloat(formatEther(BigInt(v.total_assets || '0')))) : 0;
      const totalAssets = v ? BigInt(v.total_assets || '0') : 0n;
      return {
        id: a.term_id,
        label: meta.label,
        image: a.image || meta.image,
        type: a.type || 'ATOM',
        description: meta.description,
        marketCap: v ? formatEther(BigInt(v.total_assets || '0')) : '0',
        positionCount: v?.position_count ?? 0,
        _sortMcap: mcap,
        _sortAssets: totalAssets,
      };
    });
    items.sort((a, b) => {
      const ma = a._sortMcap ?? 0;
      const mb = b._sortMcap ?? 0;
      if (mb !== ma) return mb - ma;
      return Number((b._sortAssets ?? 0n) - (a._sortAssets ?? 0n));
    });
    return items.map(({ _sortMcap, _sortAssets, ...rest }) => rest);
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

export const getLists = async (limit: number = 40, offset: number = 0, orderBy?: { total_market_cap?: 'asc' | 'desc'; triple_count?: 'asc' | 'desc'; total_position_count?: 'asc' | 'desc' }[]) => {
  const orderByArg = orderBy || [{ total_market_cap: 'desc' as const }];
  const q = `query GetLists($limit: Int, $offset: Int, $where: predicate_objects_bool_exp = {}, $orderBy: [predicate_objects_order_by!] = {}) {
    predicate_objects(
      limit: $limit
      offset: $offset
      where: $where
      order_by: $orderBy
    ) {
      predicate { term_id label image }
      object { term_id label image }
      triples(limit: 8) {
        subject { term_id label image }
      }
      triple_count
      total_market_cap
      total_position_count
    }
  }`;
  try {
    const where = { predicate_id: { _eq: LIST_PREDICATE_ID } };
    const res = await fetchGraphQL(q, { limit, offset, where, orderBy: orderByArg });
    const rows = res?.predicate_objects || [];
    const items = rows.map((po: any) => {
      const obj = po.object || {};
      const img = obj.image || obj.cached_image?.url;
      const subjects = (po.triples || []).map((t: any) => ({
        label: t.subject?.label,
        image: t.subject?.image || t.subject?.cached_image?.url,
      }));
      return {
        id: obj.term_id,
        label: obj.label || po.predicate?.label || 'Untitled list',
        image: img || po.predicate?.image,
        totalItems: po.triple_count ?? subjects.length,
        items: subjects,
        totalMarketCap: po.total_market_cap,
        totalPositionCount: po.total_position_count,
      };
    });
    return { items, hasMore: items.length === limit };
  } catch (e) {
    console.warn("[getLists] predicate_objects failed, falling back to triples", e);
    const fallback = `query GetListsFallback($limit: Int!, $offset: Int!) {
      triples(where: { predicate_id: { _eq: "${LIST_PREDICATE_ID}" } }, limit: $limit, offset: $offset) {
        term_id object { term_id label image } subject { label image }
      }
    }`;
    try {
      const res = await fetchGraphQL(fallback, { limit, offset });
      const seen = new Map<string, any>();
      (res?.triples || []).forEach((t: any) => {
        const obj = t.object;
        if (!obj?.term_id) return;
        const key = obj.term_id.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, { id: obj.term_id, label: obj.label, image: obj.image, totalItems: 0, items: [] });
        }
        const rec = seen.get(key);
        rec.totalItems += 1;
        if (rec.items.length < 8) rec.items.push({ label: t.subject?.label, image: t.subject?.image });
      });
      const items = Array.from(seen.values());
      return { items, hasMore: items.length === limit };
    } catch (e2) {
      return { items: [], hasMore: false };
    }
  }
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

/** Count redemption (exit/sell) events for a vault — for comparison "sellers" metric. */
export const getRedemptionCountForVault = async (termId: string): Promise<number> => {
  const ids = prepareQueryIds(termId);
  const q = `query GetRedemptionCount($ids: [String!]!) {
    events_aggregate(
      where: {
        _and: [
          { type: { _eq: "Redeemed" } },
          { _or: [{ atom: { term_id: { _in: $ids } } }, { triple: { term_id: { _in: $ids } } }] }
        ]
      }
    ) { aggregate { count } }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    return data?.events_aggregate?.aggregate?.count ?? 0;
  } catch (e) { return 0; }
};

/** Activity on markets the user holds — other users buying/selling in those claims. For notification bar. */
export interface PositionActivityNotification {
  id: string;
  type: 'acquired' | 'liquidated';
  senderLabel: string;
  senderId: string;
  marketLabel: string;
  vaultId: string;
  timestamp: number;
  txHash?: string;
  /** Shares in wei (raw) */
  shares?: string;
  /** Assets/value in wei (raw) — ₸ amount for deposit, proceeds for redeem */
  assets?: string;
  /** Curve used: 1 = Linear, 2 = Offset Progressive (exponential) */
  curveId?: number | string;
}

/** Human-readable curve label for UI / notifications. */
export function getCurveLabel(curveId: number | string | undefined): string {
  if (curveId === undefined || curveId === null) return 'LINEAR';
  const id = typeof curveId === 'string' ? parseInt(curveId, 10) : curveId;
  // Protocol semantics: curve_id 1 = Linear, 2 = Offset Progressive
  if (id === 1) return 'LINEAR';
  if (id === 2) return 'OFFSET PROGRESSIVE';
  return 'LINEAR';
}

export const getActivityOnMyMarkets = async (
  userAddress: string,
  vaultIds: string[],
  limit: number = 30
): Promise<PositionActivityNotification[]> => {
  if (!vaultIds.length) return [];
  const ids = Array.from(new Set(vaultIds.map(normalize).filter(Boolean)));
  if (!ids.length) return [];
  const userAddr = userAddress.toLowerCase();
  // Fetch activity on both Linear and Offset Progressive (exponential) curves — filter by term_id only so all curve types are included
  const q = `query GetActivityOnMyMarkets($ids: [String!]!, $limit: Int!) {
    events(
      where: {
        _and: [
          { type: { _in: ["Deposited", "Redeemed"] } },
          { _or: [{ atom: { term_id: { _in: $ids } } }, { triple: { term_id: { _in: $ids } } }] }
        ]
      },
      order_by: { created_at: desc },
      limit: $limit
    ) {
      id created_at type transaction_hash
      atom { term_id label data image type }
      triple { term_id subject { label term_id data image type } predicate { label } object { label term_id data image type } }
      deposit { shares assets_after_fees sender { id label image } vault { term_id curve_id } }
      redemption { shares assets sender { id label image } vault { term_id curve_id } }
    }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids, limit });
    const rawEvents = data?.events ?? [];
    // Dedupe by event id so the same activity never appears or triggers email twice
    const seenEventIds = new Set<string>();
    const events = rawEvents.filter((ev: any) => {
      const eid = ev?.id ?? ev?.transaction_hash;
      if (!eid || seenEventIds.has(eid)) return false;
      seenEventIds.add(eid);
      return true;
    });
    const out: PositionActivityNotification[] = [];
    for (const ev of events) {
      const sender = ev.deposit?.sender || ev.redemption?.sender;
      if (!sender || normalize(sender.id) === userAddr) continue;
      let label = 'Unknown';
      const vaultId = ev.atom?.term_id || ev.triple?.term_id || '';
      if (ev.atom) {
        const meta = resolveMetadata(ev.atom);
        label = meta.label;
      } else if (ev.triple) {
        const sMeta = resolveMetadata(ev.triple.subject);
        const oMeta = resolveMetadata(ev.triple.object);
        label = `${sMeta.label} ${ev.triple.predicate?.label || 'LINK'} ${oMeta.label}`;
      }
      const senderIdNorm = normalize(sender.id);
      const isProxy = senderIdNorm === normalize(FEE_PROXY_ADDRESS) || senderIdNorm === normalize(MULTI_VAULT_ADDRESS);
      const senderLabel = (sender.label && sender.label !== '0x' && !sender.label.startsWith('0x00'))
        ? sender.label
        : isProxy
          ? 'IntuRank routing contract'
          : `${sender.id.slice(0, 6)}...${sender.id.slice(-4)}`;
      const vault = ev.deposit?.vault || ev.redemption?.vault;
      const curveId = vault?.curve_id != null ? (typeof vault.curve_id === 'string' ? parseInt(vault.curve_id, 10) : vault.curve_id) : undefined;
      // Use event id so one event = one notification; tx_hash alone can repeat for multiple events in same tx
      const notificationId = ev.id ? `${ev.id}` : (ev.transaction_hash || `ev-${vaultId}-${ev.created_at}`);
      out.push({
        id: notificationId,
        type: ev.type === 'Redeemed' ? 'liquidated' : 'acquired',
        senderLabel,
        senderId: sender.id,
        marketLabel: label,
        vaultId,
        timestamp: new Date(ev.created_at).getTime(),
        txHash: ev.transaction_hash,
        shares: (ev.deposit?.shares || ev.redemption?.shares || '0')?.toString(),
        assets: (ev.deposit?.assets_after_fees || ev.redemption?.assets || '0')?.toString(),
        curveId,
      });
    }
    return out;
  } catch (e) {
    return [];
  }
};

/**
 * Activity (deposits/redemptions) by a list of account identities — for "follow" feed and email alerts.
 * Matches both sender AND receiver: when users trade through the proxy, deposit.sender=proxy but deposit.receiver=user.
 */
export const getActivityBySenderIds = async (
  senderIds: string[],
  limit: number = 40
): Promise<PositionActivityNotification[]> => {
  if (!senderIds?.length) return [];
  const ids = Array.from(new Set(senderIds.flatMap((s) => prepareQueryIds(s)).filter(Boolean)));
  if (!ids.length) return [];
  const q = `query GetActivityBySenders($ids: [String!]!, $limit: Int!) {
    events(
      where: {
        _and: [
          { type: { _in: ["Deposited", "Redeemed"] } },
          { _or: [
            { deposit: { _or: [{ sender_id: { _in: $ids } }, { receiver_id: { _in: $ids } }] } },
            { redemption: { _or: [{ sender_id: { _in: $ids } }, { receiver_id: { _in: $ids } }] } }
          ] }
        ]
      },
      order_by: { created_at: desc },
      limit: $limit
    ) {
      id created_at type transaction_hash
      atom { term_id label data image type }
      triple { term_id subject { label term_id data image type } predicate { label } object { label term_id data image type } }
      deposit { shares assets_after_fees sender { id label image } receiver { id label image } vault { term_id curve_id } }
      redemption { shares assets sender { id label image } receiver { id label image } vault { term_id curve_id } }
    }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids, limit });
    const rawEvents = data?.events ?? [];
    const seenEventIds = new Set<string>();
    const events = rawEvents.filter((ev: any) => {
      const eid = ev?.id ?? ev?.transaction_hash;
      if (!eid || seenEventIds.has(eid)) return false;
      seenEventIds.add(eid);
      return true;
    });
      const idsSet = new Set(ids.map((i) => i.toLowerCase()));
    const out: PositionActivityNotification[] = [];
    for (const ev of events) {
      const deposit = ev.deposit;
      const redemption = ev.redemption;
      const sender = deposit?.sender || redemption?.sender;
      const receiver = deposit?.receiver || redemption?.receiver;
      const senderIdNorm = sender ? normalize(sender.id) : '';
      const receiverIdNorm = receiver ? normalize(receiver.id) : '';
      const isSenderProxy = senderIdNorm === normalize(FEE_PROXY_ADDRESS) || senderIdNorm === normalize(MULTI_VAULT_ADDRESS);
      const isSenderInFollowList = idsSet.has(senderIdNorm);
      const isReceiverInFollowList = receiverIdNorm && idsSet.has(receiverIdNorm);
      const accountToShow =
        isReceiverInFollowList && isSenderProxy ? receiver
        : isSenderInFollowList && !isSenderProxy ? sender
        : isReceiverInFollowList ? receiver
        : isSenderInFollowList ? sender
        : null;
      if (!accountToShow) continue;
      let label = 'Unknown';
      const vaultId = ev.atom?.term_id || ev.triple?.term_id || '';
      if (ev.atom) {
        const meta = resolveMetadata(ev.atom);
        label = meta.label;
      } else if (ev.triple) {
        const sMeta = resolveMetadata(ev.triple.subject);
        const oMeta = resolveMetadata(ev.triple.object);
        label = `${sMeta.label} ${ev.triple.predicate?.label || 'LINK'} ${oMeta.label}`;
      }
      const accountIdNorm = normalize(accountToShow.id);
      const isProxy = accountIdNorm === normalize(FEE_PROXY_ADDRESS) || accountIdNorm === normalize(MULTI_VAULT_ADDRESS);
      const senderLabel = (accountToShow.label && accountToShow.label !== '0x' && !accountToShow.label.startsWith('0x00'))
        ? accountToShow.label
        : isProxy
          ? 'IntuRank routing contract'
          : `${accountToShow.id.slice(0, 6)}...${accountToShow.id.slice(-4)}`;
      const vault = ev.deposit?.vault || ev.redemption?.vault;
      const curveId = vault?.curve_id != null ? (typeof vault.curve_id === 'string' ? parseInt(vault.curve_id, 10) : vault.curve_id) : undefined;
      const notificationId = ev.id ? `${ev.id}` : (ev.transaction_hash || `ev-${vaultId}-${ev.created_at}`);
      out.push({
        id: notificationId,
        type: ev.type === 'Redeemed' ? 'liquidated' : 'acquired',
        senderLabel,
        senderId: accountToShow.id,
        marketLabel: label,
        vaultId,
        timestamp: new Date(ev.created_at).getTime(),
        txHash: ev.transaction_hash,
        shares: (ev.deposit?.shares || ev.redemption?.shares || '0')?.toString(),
        assets: (ev.deposit?.assets_after_fees || ev.redemption?.assets || '0')?.toString(),
        curveId,
      });
    }
    return out;
  } catch (e) {
    return [];
  }
};

export const getHoldersForVault = async (termId: string) => {
  const ids = prepareQueryIds(termId);
  const q = `query GetHolders($ids: [String!]!) {
      positions(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }, order_by: { shares: desc }, limit: 100) {
        shares
        account { id label image }
        vault { curve_id term_id }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids });
    const holders = data?.positions || [];
    const uniqueAccounts = new Set((holders as any[]).map((h: any) => normalize(h?.account?.id || '')).filter(Boolean));
    return { holders, totalCount: uniqueAccounts.size };
  } catch (e) { return { holders: [], totalCount: 0 }; }
};

/**
 * Positions for multiple vault term_ids — for user leaderboard per list (Climb leaderboard).
 * Fetches vaults separately for accurate total_assets/total_shares.
 *
 * DATA ACCURACY: Each position's stake value = shares * (total_assets / total_shares).
 * We aggregate by account: sum of asset value across all atoms in the list.
 * Ranking: descending by total stake, then by atom count (tiebreaker).
 * Only positions with shares > 0 are included. Vault IDs use prepareQueryIds for format variants.
 */
export const getPositionsForVaults = async (vaultTermIds: string[]): Promise<any[]> => {
  const ids = Array.from(new Set(vaultTermIds.flatMap((id) => prepareQueryIds(id)))).slice(0, 300);
  if (ids.length === 0) return [];
  try {
  const [posRes, vaultRes] = await Promise.all([
    fetchGraphQL(`query GetPositionsForVaults($ids: [String!]!) {
      positions(where: { vault: { term_id: { _in: $ids } }, shares: { _gt: "0" } }, limit: 5000) {
        shares account_id account { id label image }
        vault { term_id }
      }
    }`, { ids }),
    fetchGraphQL(`query GetVaultsForPositions($ids: [String!]!) {
      vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares }
    }`, { ids }),
  ]);
  const positions = posRes?.positions ?? [];
  const rawVaults = vaultRes?.vaults ?? [];
  const aggregated = aggregateVaultData(rawVaults);
  const vaultByTerm = new Map<string, { total_assets: string; total_shares: string }>();
  aggregated.forEach((v: any) => vaultByTerm.set(normalize(v.term_id), { total_assets: String(v.total_assets ?? '0'), total_shares: String(v.total_shares ?? '1') }));
  return positions.map((p: any) => {
    const v = p.vault?.term_id ? vaultByTerm.get(normalize(p.vault.term_id)) : null;
    return {
      ...p,
      vault: {
        ...p.vault,
        total_assets: v?.total_assets ?? p.vault?.total_assets ?? '0',
        total_shares: v?.total_shares ?? p.vault?.total_shares ?? '1',
      },
    };
  });
  } catch (e) { return []; }
};

/** Lists containing this term (when term is object) OR identities in this list (when term is list object). Returns entries with subject id for linking to identity markets. */
export const getAtomInclusionLists = async (termId: string, agentType?: string) => {
  const ids = prepareQueryIds(termId);
  const isList = (agentType || '').toUpperCase() === 'LIST';
  const q = isList
    ? `query GetAtomInclusionLists($ids: [String!]!, $predicateId: String!, $limit: Int) {
      triples(where: { subject_id: { _in: $ids }, predicate_id: { _eq: $predicateId } }, limit: $limit) {
        term_id subject { label term_id data image } object { label term_id data image }
      }
  }`
    : `query GetAtomInclusionLists($ids: [String!]!, $predicateId: String!, $limit: Int) {
      triples(where: { _or: [{ subject_id: { _in: $ids } }, { object_id: { _in: $ids } }], predicate_id: { _eq: $predicateId } }, limit: $limit) {
        term_id subject { label term_id data image } object { label term_id data image }
      }
  }`;
  try {
    const data = await fetchGraphQL(q, { ids, predicateId: LIST_PREDICATE_ID, limit: 500 });
    const seen = new Set<string>();
    return (data?.triples || []).map((t: any) => {
      const list = isList ? t.object : (ids.some((id: string) => normalize(id) === normalize(t.object?.term_id || '')) ? t.subject : t.object);
      if (!list?.term_id || seen.has(normalize(list.term_id))) return null;
      seen.add(normalize(list.term_id));
      return {
        id: list.term_id,
        tripleId: t.term_id,
        label: resolveMetadata(list).label,
        image: list?.image,
      };
    }).filter(Boolean);
  } catch (e) { return []; }
};

/** Try predicate_objects first (has triple_count, total_market_cap, total_position_count). Fallback to triples+vaults. */
export const getAtomInclusionListsWithVaults = async (termId: string, agentType?: string) => {
  const ids = prepareQueryIds(termId);
  const isList = (agentType || '').toUpperCase() === 'LIST';
  const predObjQ = `query SavedLists($where: predicate_objects_bool_exp, $limit: Int, $offset: Int, $orderBy: [predicate_objects_order_by!]) {
    predicate_objects(where: $where, limit: $limit, offset: $offset, order_by: $orderBy) {
      predicate { term_id label image }
      object { term_id label image }
      triples(limit: 200) {
        subject { term_id label image }
      }
      triple_count
      total_market_cap
      total_position_count
    }
  }`;
  try {
    const where = isList
      ? { predicate_id: { _in: ids } }
      : { object_id: { _in: ids }, predicate_id: { _eq: LIST_PREDICATE_ID } };
    const poRes = await fetchGraphQL(predObjQ, {
      where,
      limit: 100,
      offset: 0,
      orderBy: [{ triple_count: 'desc' }],
    });
    const po = poRes?.predicate_objects;
    if (Array.isArray(po) && po.length > 0) {
      if (isList) {
        return po.map((row: any) => {
          const entry = row.object;
          return {
            id: entry?.term_id,
            tripleId: undefined,
            label: resolveMetadata(entry).label,
            image: entry?.image,
            supportTotalAssets: row.total_market_cap != null ? String(row.total_market_cap) : '0',
            supportPositionCount: row.total_position_count ?? row.triple_count ?? 0,
            opposeTotalAssets: '0',
            opposePositionCount: 0,
          };
        });
      }
      const out: any[] = [];
      const seen = new Set<string>();
      for (const row of po) {
        const triples = row.triples || [];
        const rowCap = row.total_market_cap;
        const rowPos = row.total_position_count ?? row.triple_count ?? 0;
        for (const t of triples) {
          const objId = t.object?.term_id ? normalize(t.object.term_id) : '';
          const list = ids.some((id: string) => normalize(id) === objId) ? t.subject : t.object;
          if (list?.term_id && !seen.has(normalize(list.term_id))) {
            seen.add(normalize(list.term_id));
            out.push({
              id: list.term_id,
              tripleId: undefined,
              label: resolveMetadata(list).label,
              image: list.image,
              supportTotalAssets: rowCap != null ? String(rowCap) : '0',
              supportPositionCount: rowPos,
              opposeTotalAssets: '0',
              opposePositionCount: 0,
            });
          }
        }
        if (triples.length === 0 && row.predicate?.term_id && !seen.has(normalize(row.predicate.term_id))) {
          seen.add(normalize(row.predicate.term_id));
          out.push({
            id: row.predicate.term_id,
            tripleId: undefined,
            label: resolveMetadata(row.predicate).label,
            image: row.predicate.image,
            supportTotalAssets: rowCap != null ? String(rowCap) : '0',
            supportPositionCount: rowPos,
            opposeTotalAssets: '0',
            opposePositionCount: 0,
          });
        }
      }
      if (out.length > 0) {
        const listIds = out.map((e) => e.id).filter(Boolean);
        const idsForVault = Array.from(new Set(listIds.flatMap((id) => prepareQueryIds(id)))).slice(0, 500);
        try {
          const vaultRes = await fetchGraphQL(`query GetListVaults($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count } }`, { ids: idsForVault });
          const vaults = vaultRes?.vaults || [];
          const agg = aggregateVaultData(vaults);
          const vaultByTerm = new Map<string, { total_assets: string; position_count: number }>();
          agg.forEach((v: any) => vaultByTerm.set(normalize(v.term_id), { total_assets: v.total_assets?.toString() ?? '0', position_count: v.position_count ?? 0 }));
          return out.map((e) => {
            const v = vaultByTerm.get(normalize(e.id));
            return {
              ...e,
              supportTotalAssets: v?.total_assets ?? e.supportTotalAssets,
              supportPositionCount: v?.position_count ?? e.supportPositionCount,
            };
          });
        } catch (_) { /* vault fetch failed, use row aggregates */ }
        return out;
      }
    }
  } catch (_) { /* predicate_objects not available */ }
  const entries = await getAtomInclusionLists(termId, agentType);
  if (entries.length === 0) return [];
  const entryIds = Array.from(new Set(entries.map((e) => e.id).filter(Boolean)));
  const idsForQuery = entryIds.flatMap((id) => prepareQueryIds(id)).slice(0, 500);
  const vaultQ = `query GetListEntryVaults($ids: [String!]!) { vaults(where: { term_id: { _in: $ids } }) { term_id total_assets total_shares current_share_price curve_id position_count } }`;
  try {
    const vaultRes = await fetchGraphQL(vaultQ, { ids: idsForQuery });
    const vaults = vaultRes?.vaults || [];
    const agg = aggregateVaultData(vaults);
    const vaultByTerm = new Map<string, any>();
    agg.forEach((v: any) => vaultByTerm.set(normalize(v.term_id), v));
    return entries.map((e) => {
      const v = vaultByTerm.get(normalize(e.id));
      const supportAssets = v?.total_assets ?? '0';
      const supportCount = v?.position_count ?? 0;
      return {
        ...e,
        supportTotalAssets: v?.total_assets != null ? String(v.total_assets) : '0',
        supportPositionCount: supportCount,
        opposeTotalAssets: '0',
        opposePositionCount: 0,
      };
    });
  } catch (e) {
    return entries;
  }
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

/** Sum market cap (wei) across all vaults for a term — linear + exponential curves. Uses market_cap when set; otherwise total_assets. */
export function sumVaultMarketCapWei(vaults: any[] | undefined): bigint {
    if (!vaults?.length) return 0n;
    let sum = 0n;
    for (const v of vaults) {
        const mc = v?.market_cap;
        const ta = v?.total_assets ?? '0';
        const raw = mc != null && mc !== '' ? mc : ta;
        try {
            sum += BigInt(typeof raw === 'string' ? raw : String(raw));
        } catch {
            /* skip malformed */
        }
    }
    return sum;
}

/** Total position count across all vaults (both curves) for a term. */
export function sumVaultPositionCount(vaults: any[] | undefined): number {
    if (!vaults?.length) return 0;
    return vaults.reduce((n, v) => n + Number(v?.position_count ?? 0), 0);
}

/** Category filters for The Arena (`/climb`) — predicate label heuristics on `triples`. */
export type ArenaCategory = 'head-to-head' | 'hot-takes' | 'prediction-markets';

/**
 * After fetching triples with `%vs%`, keep rows that look like real battles.
 * Filters out common false positives (e.g. "vscode" containing "vs" as letters only inside a word).
 */
export function predicateLooksLikeBattlePredicate(pred: string): boolean {
    const p = pred.trim();
    if (!p) return false;
    if (/\bvscode\b/i.test(p)) return false;
    if (/\bvs\s*code\b/i.test(p)) return false;
    if (/\bversus\b/i.test(p)) return true;
    if (/\s+vs\.?\s/i.test(p)) return true;
    if (/\s+vs,?\s/i.test(p)) return true;
    if (/\s+vs\s+/i.test(p)) return true;
    if (/\bvs\b/i.test(p)) return true;
    return false;
}

/** Looser battle signal when strict filter yields zero rows: any `vs` / `versus`, excluding vscode false positives. */
export function predicateLooksLikeBattlePredicateLoose(pred: string): boolean {
    const p = pred.trim();
    if (!p) return false;
    const lower = p.toLowerCase();
    if (lower.includes('vscode')) return false;
    if (/\bversus\b/i.test(p)) return true;
    return lower.includes('vs');
}

/**
 * Social / badge predicates (e.g. "has tag") — high volume but not "debate" claims.
 * Portal-style claim leaderboards typically surface semantic claims; exclude these from Arena Hot Takes.
 */
export function predicateIsSocialTagNoise(pred: string): boolean {
    const p = (pred || '').trim().toLowerCase().replace(/_/g, ' ');
    if (!p) return false;
    if (p === 'has tag' || p === 'has a tag') return true;
    if (/^has\s+tag\b/.test(p)) return true;
    return false;
}

/**
 * Head-to-head: broad GraphQL match on `vs` / `versus`, then client-side
 * `predicateLooksLikeBattlePredicate` removes false positives (e.g. "vscode").
 */
export function buildArenaTriplesWhere(tab: ArenaCategory): Record<string, unknown> {
    if (tab === 'head-to-head') {
        return {
            _or: [
                { predicate: { label: { _ilike: '%vs%' } } },
                { predicate: { label: { _ilike: '% vs %' } } },
                { predicate: { label: { _ilike: '%versus%' } } },
                { predicate: { label: { _ilike: '% vs.%' } } },
                { predicate: { label: { _ilike: '% vs,%' } } },
            ],
        };
    }
    if (tab === 'prediction-markets') {
        return {
            _or: [
                { predicate: { label: { _ilike: '%predict%' } } },
                { predicate: { label: { _ilike: '%forecast%' } } },
                { predicate: { label: { _ilike: '%will %' } } },
            ],
        };
    }
    return {};
}

export async function getTriplesWithPositions(limit = 10, offset = 0, orderBy: any[] = [], where: any = {}, address?: string) {
  const query = `
    query GetTriplesWithPositions($limit: Int, $offset: Int, $orderBy: [triples_order_by!], $where: triples_bool_exp, $address: String) {
      triples(limit: $limit, offset: $offset, order_by: $orderBy, where: $where) {
        term_id
        counter_term_id
        created_at
        positions_aggregate {
          aggregate {
            count
          }
        }
        subject {
          term_id
          wallet_id
          label
          image
          cached_image {
            ...CachedImageFields
          }
          data
          type
          value {
            ...AtomValueLight
          }
        }
        predicate {
          term_id
          wallet_id
          label
          image
          cached_image {
            ...CachedImageFields
          }
          data
          type
          value {
            ...AtomValueLight
          }
        }
        object {
          term_id
          wallet_id
          label
          image
          cached_image {
            ...CachedImageFields
          }
          data
          type
          value {
            ...AtomValue
          }
        }
        subject_term {
          ...TermElement
        }
        predicate_term {
          ...TermElement
        }
        object_term {
          ...TermElementFull
        }
        term {
          ...Term
          vaults(order_by: {curve_id: asc}) {
            term_id
            curve_id
            current_share_price
            market_cap
            total_assets
            total_shares
            position_count
            market_cap
            userPosition: positions(where: {account_id: {_eq: $address}}) {
              account {
                id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
              }
              shares
            }
          }
        }
        counter_term {
          ...CounterTerm
          vaults(order_by: {curve_id: asc}) {
            term_id
            curve_id
            current_share_price
            market_cap
            total_assets
            total_shares
            position_count
            market_cap
            userPosition: positions(where: {account_id: {_eq: $address}}) {
              account {
                id
                label
                image
                cached_image {
                  ...CachedImageFields
                }
              }
              shares
            }
          }
        }
        creator {
          id
          atom_id
          label
          image
          cached_image {
            ...CachedImageFields
          }
        }
      }
    }
    
    fragment CachedImageFields on cached_images_cached_image {
      url
      safe
    }
    
    fragment AtomValueLight on atom_values {
      person {
        name
        image
        cached_image {
          ...CachedImageFields
        }
        url
      }
      thing {
        name
        image
        cached_image {
          ...CachedImageFields
        }
        url
      }
      organization {
        name
        image
        url
      }
      account {
        id
        label
        image
        cached_image {
          ...CachedImageFields
        }
      }
    }
    
    fragment AtomValue on atom_values {
      ...AtomValueLight
      json_object {
        description: data(path: "description")
      }
    }
    
    fragment TermElement on terms {
      id
      type
      atom {
        term_id
        data
        image
        cached_image {
          ...CachedImageFields
        }
        label
        emoji
        type
        wallet_id
        value {
          ...AtomValueLight
        }
      }
      triple {
        term_id
        subject {
          label
        }
        predicate {
          label
        }
        object {
          label
        }
      }
    }
    
    fragment TermElementFull on terms {
      id
      type
      atom {
        term_id
        data
        image
        cached_image {
          ...CachedImageFields
        }
        label
        emoji
        type
        wallet_id
        value {
          ...AtomValue
        }
        creator {
          ...AccountMetadata
        }
      }
      triple {
        term_id
        subject {
          label
        }
        predicate {
          label
        }
        object {
          label
        }
      }
    }
    
    fragment AccountMetadata on accounts {
      label
      image
      cached_image {
        ...CachedImageFields
      }
      id
      atom_id
      type
    }
    
    fragment Term on terms {
      total_market_cap
      positions_aggregate {
        aggregate {
          count
        }
      }
    }
    
    fragment CounterTerm on terms {
      total_market_cap
      positions_aggregate {
        aggregate {
          count
        }
      }
    }
  `;

  const variables = { limit, offset, orderBy, where, address };
  const data = await fetchGraphQL(query, variables);
  return data?.triples || [];
}
