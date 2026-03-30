/**
 * Arena XP — local persistence + optional remote sync (VITE_ARENA_LEADERBOARD_URL).
 */
const XP_KEY = 'inturank-arena-xp-v1';

export interface ArenaXpRecord {
  xp: number;
  duels: number;
  updatedAt: number;
}

function readStore(): Record<string, ArenaXpRecord> {
  try {
    const raw = localStorage.getItem(XP_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function writeStore(s: Record<string, ArenaXpRecord>) {
  try {
    localStorage.setItem(XP_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function getArenaXp(address: string | undefined | null): ArenaXpRecord {
  if (!address) return { xp: 0, duels: 0, updatedAt: 0 };
  const k = address.toLowerCase();
  const s = readStore();
  return s[k] ?? { xp: 0, duels: 0, updatedAt: 0 };
}

export function getAllLocalArenaXp(): Record<string, number> {
  const s = readStore();
  const out: Record<string, number> = {};
  for (const [addr, rec] of Object.entries(s)) {
    if (rec.xp > 0) out[addr] = rec.xp;
  }
  return out;
}

/** Full records for leaderboard (only entries with xp > 0). */
export function getArenaLeaderboardSource(): Array<{ address: string; xp: number; duels: number; updatedAt: number }> {
  const s = readStore();
  const out: Array<{ address: string; xp: number; duels: number; updatedAt: number }> = [];
  for (const [addr, rec] of Object.entries(s)) {
    if (rec.xp > 0) {
      out.push({ address: addr, xp: rec.xp, duels: rec.duels, updatedAt: rec.updatedAt });
    }
  }
  return out;
}

export function addArenaXp(address: string, xpDelta: number, duelIncrement = 1): ArenaXpRecord {
  const k = address.toLowerCase();
  const s = readStore();
  const prev = s[k] ?? { xp: 0, duels: 0, updatedAt: 0 };
  const next: ArenaXpRecord = {
    xp: Math.max(0, prev.xp + xpDelta),
    duels: prev.duels + duelIncrement,
    updatedAt: Date.now(),
  };
  s[k] = next;
  writeStore(s);

  const url = (import.meta.env.VITE_ARENA_LEADERBOARD_URL as string | undefined)?.trim();
  if (url) {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: k, xp: next.xp, duels: next.duels, t: next.updatedAt }),
    }).catch(() => {});
  }

  return next;
}
