import { formatEther, parseEther } from 'viem';
import { getAllAgents } from './graphql';
import { logSkillEvent } from './skillTelemetry';

/** Exclude near-zero vaults so “least market cap” snippets are not dominated by dust / unnamed atoms. */
const MIN_TOTAL_ASSETS_WEI = parseEther('0.0001');

function isUnnamedHexLabel(label: string): boolean {
    const t = (label || '').trim();
    return t.length > 0 && /^0x[0-9a-f]{64}$/i.test(t);
}

function displayLabelForSkill(id: string, label: string): string {
    const t = (label || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!t || isUnnamedHexLabel(t)) return `Unnamed atom (${id.slice(0, 10)}…)`;
    return t;
}

function formatSkillMarketCap(raw: string): string {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return raw;
    if (n <= 0) return '0';
    if (n < 1e-9) return n.toExponential(2);
    if (n < 0.01) return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/**
 * Detects when the user is asking for *live* ranking / market-cap style facts and returns
 * a short, factual block from IntuRank's GraphQL (same source as Markets) to inject into the LLM prompt.
 */
export async function maybeFetchSkillLiveContext(userMessage: string): Promise<string | null> {
    const raw = userMessage.trim();
    if (raw.length < 12) return null;

    const lower = raw.toLowerCase();
    const creationIntent =
        /\b(create|make|mint|deploy|broadcast|sign)\b/i.test(raw) &&
        /\b(atom|triple|claim)\b/i.test(raw);
    if (creationIntent) return null;

    const economics =
        /\b(market\s*cap|mcap|capitalization|vault|economics|staked|tvl|total\s+assets)\b/i.test(lower);

    const wantsBottomByEconomics =
        economics &&
        /\b(lowest|least|smallest|minimum|min|bottom|weakest|poorest|tiniest)\b/i.test(lower);

    const wantsTopByEconomics =
        economics &&
        /\b(highest|top|largest|biggest|rank|ranking|most\s+(?:trust|assets|value))\b/i.test(lower);

    /** “Which … highest …” — do not use mcap alone or “which X market cap” matches “least market cap” too. */
    const asksWhichLeader =
        /\b(which|what)\b.*\b(atom|vault|claim|triple|market)\b/i.test(lower) &&
        /\b(highest|top|largest|most|biggest|#1|number\s*one)\b/i.test(lower) &&
        !/\b(lowest|least|smallest|minimum|bottom)\b/i.test(lower);

    const asksWhichLaggard =
        /\b(which|what|who)\b.*\b(atom|vault|claim|triple|market)\b/i.test(lower) &&
        /\b(lowest|least|smallest|minimum|bottom|weakest)\b/i.test(lower) &&
        economics;

    const asksLeaderShort =
        /\bwho\b.*\b(wins|leading|ranked|#1|number\s*one)\b/i.test(lower) ||
        /\b(best|biggest)\b.*\b(on\s+)?(the\s+)?(graph|intuition|inturank)\b/i.test(lower);

    /** Prefer ascending when user asks for low/min; never use a “top vaults” desc list to answer “least”. */
    const order: 'asc' | 'desc' =
        wantsBottomByEconomics || asksWhichLaggard ? 'asc' : 'desc';

    const shouldFetch =
        wantsTopByEconomics ||
        wantsBottomByEconomics ||
        asksWhichLeader ||
        asksWhichLaggard ||
        asksLeaderShort;

    if (!shouldFetch) return null;

    try {
        const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
        /** Ascending “least” queries: smallest vaults with total_assets ≥ floor (GraphQL _gte), not the global dust tail. */
        const ascOpts = order === 'asc' ? { minTotalAssetsWei: MIN_TOTAL_ASSETS_WEI } : undefined;
        let { items } = await getAllAgents(15, 0, order, ascOpts);
        let ascUsedDustFallback = false;
        if (order === 'asc' && items.length === 0) {
            const fb = await getAllAgents(15, 0, 'asc');
            items = fb.items;
            if (items.length > 0) ascUsedDustFallback = true;
        }
        const ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;

        logSkillEvent({
            level: 'debug',
            event: 'skill.live_context.fetched',
            detail: { rows: items.length, ms, order, ascGteWei: ascOpts?.minTotalAssetsWei?.toString(), ascUsedDustFallback },
        });

        if (!items.length) {
            return '[Live IntuRank graph: no vault rows returned for vault query.]';
        }

        const lines = items.slice(0, 12).map((it, i) => {
            const label = displayLabelForSkill(it.id, it.label || '');
            const mcap = formatSkillMarketCap(String(it.marketCap ?? ''));
            return `${i + 1}. "${label}" | term_id=${it.id} | marketCap≈${mcap} TRUST (IntuRank computed) | positions=${it.positionCount ?? 0}`;
        });

        const dustFloorTrust = formatEther(MIN_TOTAL_ASSETS_WEI);
        const header =
            order === 'asc' && !ascUsedDustFallback
                ? `[Live IntuRank Graph — smallest vaults on record with total_assets ≥ ${dustFloorTrust} TRUST (indexer _gte + ascending sort). These are the **least among non-dust** in this query, not 1e-12 dust tails. Prefer quoted names; “Unnamed atom (0x…)” means no label. Bounded query. Do not invent term_ids or numbers.]`
                : order === 'asc' && ascUsedDustFallback
                  ? `[Live IntuRank Graph — fallback: raw ascending slice (could not load _gte-filtered list or no vaults met the floor). Warn: rows may be dust; do not cite 1e-12 as a meaningful market cap. Do not invent term_ids or numbers.]`
                  : '[Live IntuRank Graph — vaults ordered by total_assets DESCENDING (largest first; same idea as Markets). Use ONLY these rows for “highest/top” rankings; do not invent term_ids or numbers.]';

        return [header, ...lines].join('\n');
    } catch (e) {
        logSkillEvent({
            level: 'warn',
            event: 'skill.live_context.failed',
            error: e,
        });
        return `[Live graph fetch failed: ${e instanceof Error ? e.message : String(e)}]`;
    }
}
