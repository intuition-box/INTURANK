/**
 * Cache + single-flight for market AI summaries (Groq/Gemini/OpenAI) to limit API usage
 * and avoid duplicate requests (e.g. React Strict Mode, rapid prop updates).
 */

const LS_PREFIX = 'inturank_ai_brief:';
/** Bump when prompt / normalization logic changes so old cache entries are ignored. */
export const AI_BRIEF_CACHE_VERSION = '5';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Stored = { v: string; savedAt: number; text: string };

const inflight = new Map<string, Promise<string>>();

function storageKey(cacheKey: string): string {
  return `${LS_PREFIX}${AI_BRIEF_CACHE_VERSION}:${cacheKey}`;
}

export function readAiBriefCache(cacheKey: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.v !== AI_BRIEF_CACHE_VERSION) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(storageKey(cacheKey));
      return null;
    }
    return parsed.text;
  } catch {
    return null;
  }
}

export function writeAiBriefCache(cacheKey: string, text: string): void {
  try {
    const payload: Stored = { v: AI_BRIEF_CACHE_VERSION, savedAt: Date.now(), text };
    localStorage.setItem(storageKey(cacheKey), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Returns cached text, or runs `fetcher` once per cacheKey (concurrent callers share the same promise).
 */
export async function loadAiBriefDeduped(cacheKey: string, fetcher: () => Promise<string>): Promise<string> {
  const hit = readAiBriefCache(cacheKey);
  if (hit) return hit;

  let p = inflight.get(cacheKey);
  if (!p) {
    p = (async () => {
      const text = await fetcher();
      if (text.trim()) writeAiBriefCache(cacheKey, text);
      return text;
    })().finally(() => {
      inflight.delete(cacheKey);
    });
    inflight.set(cacheKey, p);
  }
  return p;
}

/** Small stable hash for cache keys (fast, not cryptographic). */
export function hashBriefInputs(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function buildMarketBriefCacheKey(
  agent: { id?: string; label?: string; type?: string; totalAssets?: string; totalShares?: string },
  triplesCount: number,
  historyCount: number,
  triplesContextSnippet: string
): string {
  const id = agent.id ?? '';
  const payload = [
    id,
    agent.label ?? '',
    agent.type ?? '',
    agent.totalAssets ?? '',
    agent.totalShares ?? '',
    String(triplesCount),
    String(historyCount),
    triplesContextSnippet,
  ].join('|');
  return `${id}:${hashBriefInputs(payload)}`;
}
