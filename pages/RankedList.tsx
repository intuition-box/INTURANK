/**
 * The Arena: yes/no stance grid per theme. Optional TRUST stake, local XP and ladder.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { parseEther, formatEther, getAddress } from 'viem';
import {
  Trophy,
  RefreshCw,
  Loader2,
  Sparkles,
  ChevronRight,
  Coins,
  FileText,
  BookOpen,
  Flame,
  Zap,
  SkipForward,
  Crown,
  Wallet,
  Activity,
  Clock,
  Medal,
} from 'lucide-react';
import {
  getTopClaims,
  predicateIsSocialTagNoise,
  predicateLooksLikeBattlePredicateLoose,
  resolveMetadata,
} from '../services/graphql';
import { sendNativeTransfer } from '../services/web3';
import { playClick, playHover, playSuccess } from '../services/audio';
import { toast } from '../components/Toast';
import { addArenaXp, getArenaXp } from '../services/arenaXp';
import { fetchArenaPlayerLeaderboard, type ArenaPlayerRow } from '../services/arenaLeaderboard';
export type ArenaTheme = 'claims' | 'narratives' | 'tokens' | 'passion';

export type RankItemKind = 'claim' | 'atom' | 'token';

export interface RankItem {
  id: string;
  kind: RankItemKind;
  label: string;
  subtitle?: string;
  image?: string;
  /** Object / right side of a head-to-head claim (subject image stays in `image`). */
  imageSecondary?: string;
  /** Short labels for vs hero when an image is missing. */
  versusLeftLabel?: string;
  versusRightLabel?: string;
  /** Same-kind pairing: e.g. person vs person, claim-vs vs claim-vs */
  pairKind: string;
}

const POOL_SIZE = 28;
const SCORE_START = 0;
/** Single-item yes/no themes: nudge claim score up or down per stance. */
const YESNO_SCORE_YES = 28;
const YESNO_SCORE_NO = -18;

export type ArenaRound = {
  kind: 'yesno';
  /** Several stance cards at once (prediction-market grid). */
  items: RankItem[];
};

/** How many yes/no cards to show when the pool is large enough. */
const YESNO_GRID_SIZE = 6;

function pickSingleItem(pool: RankItem[], lastId: string | null): RankItem | null {
  if (pool.length === 0) return null;
  const eligible = lastId && pool.length > 1 ? pool.filter((it) => it.id !== lastId) : pool;
  const src = eligible.length ? eligible : pool;
  return src[Math.floor(Math.random() * src.length)] ?? null;
}

const STORAGE_PREFIX = 'inturank-arena-pairwise';

/** Discrete stake levels — slider snaps here (no typing TRUST). First non-zero tier is 0.1 TRUST (Spark). */
const ARENA_STAKE_PRESETS = [0, 0.1, 0.25, 0.5, 1, 2.5, 10] as const;
const ARENA_STAKE_TITLES = ['Practice', 'Spark', 'Pulse', 'Surge', 'Blitz', 'Nova', 'Singularity'] as const;

function formatPresetTrustLabel(n: number): string {
  if (n === 0) return '0 TRUST';
  return `${n} TRUST`;
}

const TOKEN_POOL: RankItem[] = [
  { id: 'tok-eth', kind: 'token', label: 'ETH', subtitle: 'Native gas & collateral', pairKind: 'token' },
  { id: 'tok-trust', kind: 'token', label: 'TRUST', subtitle: 'Intuition conviction token', pairKind: 'token' },
  { id: 'tok-btc', kind: 'token', label: 'BTC', subtitle: 'Digital gold narrative', pairKind: 'token' },
  { id: 'tok-sol', kind: 'token', label: 'SOL', subtitle: 'High-throughput L1', pairKind: 'token' },
  { id: 'tok-usdc', kind: 'token', label: 'USDC', subtitle: 'Stable unit of account', pairKind: 'token' },
  { id: 'tok-dai', kind: 'token', label: 'DAI', subtitle: 'Decentralized stable', pairKind: 'token' },
  { id: 'tok-op', kind: 'token', label: 'OP', subtitle: 'Optimism governance', pairKind: 'token' },
  { id: 'tok-arb', kind: 'token', label: 'ARB', subtitle: 'Arbitrum governance', pairKind: 'token' },
  { id: 'tok-link', kind: 'token', label: 'LINK', subtitle: 'Oracle rail', pairKind: 'token' },
  { id: 'tok-meme', kind: 'token', label: 'Memecoins', subtitle: 'Culture / attention', pairKind: 'token' },
  { id: 'tok-ai', kind: 'token', label: 'AI agents', subtitle: 'Autonomous actors', pairKind: 'token' },
  { id: 'tok-restake', kind: 'token', label: 'Restaking', subtitle: 'Shared security', pairKind: 'token' },
];

const NARRATIVE_PRED = /predict|forecast|will\b|should\b|believe|future|outcome|if\s+.+\s+then/i;
const BATTLE_PRED_EXTRA =
  /(?:better than|versus|\bvs\b|over\b|compared to|outperforms|beats\b|wins against)/i;

function isBattleClaimRow(row: any): boolean {
  const p = row?.predicate || '';
  if (!p || predicateIsSocialTagNoise(p)) return false;
  return predicateLooksLikeBattlePredicateLoose(p) || BATTLE_PRED_EXTRA.test(p);
}

function claimToRankItem(row: any, pairKind: string): RankItem | null {
  if (!row?.id) return null;
  const sub = row.subject?.label || '';
  const pred = row.predicate || '';
  const obj = row.object?.label || '';
  const label = [sub, pred, obj].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!label) return null;
  const subM = resolveMetadata(row.subject || {});
  const objM = resolveMetadata(row.object || {});
  const subImg = (subM.image || row.subject?.image) as string | undefined;
  const objImg = (objM.image || row.object?.image) as string | undefined;
  const leftName = (subM.label || sub || '').trim();
  const rightName = (objM.label || obj || '').trim();
  const isVs = pairKind === 'claim-vs';
  return {
    id: String(row.id),
    kind: 'claim',
    label: label.length > 120 ? `${label.slice(0, 118)}…` : label,
    subtitle: pairKind === 'claim-vs' ? 'Versus-style claim' : 'Claim',
    image: isVs ? subImg : subImg || objImg,
    imageSecondary: isVs ? objImg : undefined,
    versusLeftLabel: isVs ? (leftName || 'A').slice(0, 48) : undefined,
    versusRightLabel: isVs ? (rightName || 'B').slice(0, 48) : undefined,
    pairKind,
  };
}

const THEMES: {
  id: ArenaTheme;
  short: string;
  icon: React.ReactNode;
  blurb: string;
}[] = [
  {
    id: 'claims',
    short: 'Claims',
    icon: <FileText size={16} />,
    blurb: 'One claim at a time — yes or no to support or oppose. Momentum tracks how the pool leans.',
  },
  {
    id: 'narratives',
    short: 'Narratives',
    icon: <BookOpen size={16} />,
    blurb: 'Prediction and future-shaped lines — one narrative per round, stance with yes or no.',
  },
  {
    id: 'tokens',
    short: 'Tokens',
    icon: <Coins size={16} />,
    blurb: 'Themes and tickers — one at a time; agree or disagree to move momentum.',
  },
  {
    id: 'passion',
    short: 'Heat',
    icon: <Flame size={16} />,
    blurb: 'High-energy claims — same yes/no loop; rank what hits hardest for you.',
  },
];

async function loadPool(theme: ArenaTheme): Promise<RankItem[]> {
  if (theme === 'tokens') {
    return [...TOKEN_POOL].sort(() => Math.random() - 0.5).slice(0, Math.min(POOL_SIZE, TOKEN_POOL.length));
  }

  /** Larger slice so more head-to-head claims appear (indexer returns by mcap — shallow fetch hid many vs claims). */
  const { items } = await getTopClaims(420, 0);
  const base = items.filter((row: any) => !predicateIsSocialTagNoise(row.predicate || ''));

  if (theme === 'claims') {
    const battle = base.filter(isBattleClaimRow);
    const src = battle.length >= 2 ? battle : base;
    const pk = battle.length >= 2 ? 'claim-vs' : 'claim';
    const mapped = src.map((r: any) => claimToRankItem(r, pk)).filter(Boolean) as RankItem[];
    return [...mapped].sort(() => Math.random() - 0.5).slice(0, POOL_SIZE);
  }

  if (theme === 'narratives') {
    const narrRows = base.filter((row: any) => NARRATIVE_PRED.test(row.predicate || ''));
    let src = narrRows.length >= 2 ? narrRows : base;
    return src.map((r: any) => claimToRankItem(r, 'narrative')).filter(Boolean).slice(0, POOL_SIZE) as RankItem[];
  }

  if (theme === 'passion') {
    const sorted = [...base].sort(
      (a: any, b: any) =>
        (b.holders ?? 0) + (b.opposeHolders ?? 0) - ((a.holders ?? 0) + (a.opposeHolders ?? 0))
    );
    return sorted.map((r: any) => claimToRankItem(r, 'heat')).filter(Boolean).slice(0, POOL_SIZE) as RankItem[];
  }

  return base.map((r: any) => claimToRankItem(r, 'claim')).filter(Boolean).slice(0, POOL_SIZE) as RankItem[];
}

function pickYesNoGridItems(pool: RankItem[], n: number): RankItem[] {
  if (pool.length === 0) return [];
  const k = Math.min(n, pool.length);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, k);
}

/** New card for a grid slot: prefer an item not already visible on other cards. */
function pickReplacementForYesNoGrid(pool: RankItem[], answeredItem: RankItem, visibleItems: RankItem[]): RankItem | null {
  const keepIds = new Set(visibleItems.filter((it) => it.id !== answeredItem.id).map((it) => it.id));
  const eligible = pool.filter((it) => !keepIds.has(it.id));
  if (eligible.length > 0) {
    return eligible[Math.floor(Math.random() * eligible.length)] ?? null;
  }
  return pickSingleItem(pool, answeredItem.id);
}

/** Momentum vs pool → 3–97% split for the sentiment bar (visual only, not on-chain odds). */
function poolSentimentYesPct(pool: RankItem[], scores: Record<string, number>, itemId: string): { yes: number; no: number } {
  if (pool.length === 0) return { yes: 50, no: 50 };
  const vals = pool.map((it) => scores[it.id] ?? SCORE_START);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, 1e-6);
  const raw = scores[itemId] ?? SCORE_START;
  const t = (raw - min) / span;
  const yes = Math.round(3 + t * 94);
  return { yes, no: 100 - yes };
}

/** Raw Elo-style scores start at 0 and can go negative; display with a baseline so numbers read like familiar ratings. */
const ARENA_RATING_DISPLAY_BASE = 1500;

function fmtArenaScore(raw: number): string {
  return Math.round(raw + ARENA_RATING_DISPLAY_BASE).toLocaleString('en-US');
}

function getStreakTier(s: number): { label: string; className: string } {
  if (s >= 12) return { label: 'Unstoppable', className: 'from-rose-500/90 via-fuchsia-500/80 to-amber-400/90 shadow-[0_0_20px_rgba(244,63,94,0.35)]' };
  if (s >= 7) return { label: 'Blazing', className: 'from-orange-500/90 to-amber-500/80 shadow-[0_0_16px_rgba(251,146,60,0.3)]' };
  if (s >= 3) return { label: 'On fire', className: 'from-amber-400/85 to-orange-600/70 shadow-[0_0_14px_rgba(251,191,36,0.25)]' };
  if (s >= 1) return { label: 'Heating up', className: 'from-cyan-500/70 to-cyan-600/50 shadow-[0_0_12px_rgba(34,211,238,0.2)]' };
  return { label: '', className: '' };
}

/** Arena XP tier — shown on ladder for competitive vibe. */
function arenaCombatTier(xp: number): { label: string; chip: string } {
  if (xp >= 5000)
    return {
      label: 'Mythic',
      chip: 'bg-gradient-to-r from-fuchsia-600/55 to-rose-600/45 text-fuchsia-50 border-fuchsia-300/55 shadow-[0_0_16px_rgba(217,70,239,0.25)]',
    };
  if (xp >= 2500)
    return {
      label: 'Apex',
      chip: 'bg-gradient-to-r from-violet-600/50 to-fuchsia-800/45 text-violet-50 border-violet-300/50 shadow-[0_0_14px_rgba(139,92,246,0.2)]',
    };
  if (xp >= 1000)
    return {
      label: 'Elite',
      chip: 'bg-gradient-to-r from-amber-500/50 to-orange-700/45 text-amber-50 border-amber-300/55 shadow-[0_0_14px_rgba(245,158,11,0.2)]',
    };
  if (xp >= 500)
    return {
      label: 'Veteran',
      chip: 'bg-gradient-to-r from-cyan-600/45 to-teal-800/45 text-cyan-50 border-cyan-300/50 shadow-[0_0_12px_rgba(34,211,238,0.18)]',
    };
  if (xp >= 150)
    return {
      label: 'Contender',
      chip: 'bg-gradient-to-r from-slate-500/50 to-slate-700/50 text-slate-50 border-slate-400/45',
    };
  return {
    label: 'Rookie',
    chip: 'bg-gradient-to-r from-slate-600/55 to-slate-800/55 text-slate-100 border-slate-400/40',
  };
}

function formatRelativeArenaActive(ts: number): string {
  if (!ts) return '—';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 45) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/** First meaningful glyph for avatar fallback — avoids "0" for 0x… wallet labels. */
function leaderboardAvatarGlyph(label: string): string {
  const t = (label || '').trim();
  if (/^0x/i.test(t)) {
    const firstHex = t.slice(2).match(/[a-f0-9]/i);
    return firstHex ? firstHex[0].toUpperCase() : '?';
  }
  const m = /[a-zA-Z0-9]/.exec(t);
  return m ? m[0].toUpperCase() : '?';
}

function loadPersisted(theme: ArenaTheme): Record<string, number> | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}-scores-${theme}`);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && typeof o === 'object') return o as Record<string, number>;
  } catch {
    /* ignore */
  }
  return null;
}

function savePersisted(theme: ArenaTheme, s: Record<string, number>) {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}-scores-${theme}`, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Versus-style claim: subject vs object with optional images (e.g. Claude | Gemini). */
function ArenaVsHeroImages({
  leftSrc,
  rightSrc,
  leftName,
  rightName,
}: {
  leftSrc?: string;
  rightSrc?: string;
  leftName?: string;
  rightName?: string;
}) {
  const [badL, setBadL] = useState(false);
  const [badR, setBadR] = useState(false);
  const li = (leftName || '?').trim().charAt(0).toUpperCase() || '?';
  const ri = (rightName || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="relative grid h-full min-h-[140px] w-full grid-cols-2 bg-[#0a0d12]">
      <div className="relative h-full min-h-[140px] overflow-hidden bg-gradient-to-br from-cyan-950/40 to-[#0a0f14]">
        {leftSrc && !badL ? (
          <img src={leftSrc} alt="" className="h-full w-full object-cover" onError={() => setBadL(true)} />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl font-black text-white/30">{li}</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-2 pb-2 pt-8">
          <p className="truncate text-center text-[10px] font-bold text-white/95 drop-shadow-sm">{leftName || '—'}</p>
        </div>
      </div>
      <div className="relative h-full min-h-[140px] overflow-hidden border-l border-white/10 bg-gradient-to-br from-fuchsia-950/40 to-[#0a0f14]">
        {rightSrc && !badR ? (
          <img src={rightSrc} alt="" className="h-full w-full object-cover" onError={() => setBadR(true)} />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl font-black text-white/30">{ri}</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-2 pb-2 pt-8">
          <p className="truncate text-center text-[10px] font-bold text-white/95 drop-shadow-sm">{rightName || '—'}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg ring-1 ring-white/25">
        VS
      </div>
    </div>
  );
}

function parseEnvTreasuryRaw(): string {
  let raw = (import.meta.env.VITE_ARENA_TREASURY_ADDRESS as string | undefined)?.trim() ?? '';
  raw = raw.replace(/^['"]|['"]$/g, '');
  return raw;
}

/** Resolves checksum; strips quotes. Restarts `npm run dev` after changing `.env` so Vite picks up `VITE_*`. */
function getTreasury(): `0x${string}` | null {
  const raw = parseEnvTreasuryRaw();
  if (!raw) return null;
  const with0x = raw.startsWith('0x') || raw.startsWith('0X') ? raw : `0x${raw}`;
  try {
    return getAddress(with0x as `0x${string}`);
  } catch {
    return null;
  }
}

function defaultStakePresetIndex(): number {
  const env = (import.meta.env.VITE_ARENA_DEFAULT_STAKE_TRUST as string | undefined)?.trim();
  if (!env) return 0;
  const n = parseFloat(env.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return 0;
  let best = 0;
  let bestD = Infinity;
  ARENA_STAKE_PRESETS.forEach((v, i) => {
    const d = Math.abs(v - n);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

const RankedList: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [theme, setTheme] = useState<ArenaTheme>('claims');
  const [pool, setPool] = useState<RankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [round, setRound] = useState<ArenaRound | null>(null);
  const [duels, setDuels] = useState(0);
  const [streak, setStreak] = useState(0);
  const [stakePresetIdx, setStakePresetIdx] = useState(defaultStakePresetIndex);
  const [stakingTx, setStakingTx] = useState(false);
  const [players, setPlayers] = useState<ArenaPlayerRow[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const reduceMotion = useReducedMotion();

  const stakeTRUST = useMemo(() => {
    const v = ARENA_STAKE_PRESETS[stakePresetIdx] ?? 0;
    return v === 0 ? '0' : String(v);
  }, [stakePresetIdx]);

  const treasury = useMemo(() => getTreasury(), []);

  const refreshPlayers = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setPlayersLoading(true);
    try {
      const rows = await fetchArenaPlayerLeaderboard();
      setPlayers(rows);
    } catch {
      setPlayers([]);
    } finally {
      if (!silent) setPlayersLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPlayers();
  }, [refreshPlayers]);

  const myXp = useMemo(() => getArenaXp(address), [address, duels]);

  /** Slot-style counting — animates when XP changes (e.g. after a pick). */
  const xpAnimRef = useRef<number | null>(null);
  const [xpRoll, setXpRoll] = useState(0);
  useEffect(() => {
    xpAnimRef.current = null;
  }, [address]);

  useEffect(() => {
    const target = myXp.xp;
    if (xpAnimRef.current === null) {
      xpAnimRef.current = target;
      setXpRoll(target);
      return;
    }
    const start = xpAnimRef.current;
    if (target === start) return;
    if (reduceMotion) {
      xpAnimRef.current = target;
      setXpRoll(target);
      return;
    }
    let raf = 0;
    const dur = 900;
    const t0 = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - u) ** 3;
      const v = Math.round(start + (target - start) * eased);
      setXpRoll(v);
      if (u < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        xpAnimRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [myXp.xp, reduceMotion]);

  const playersMaxXp = useMemo(() => {
    if (!players.length) return 1;
    return Math.max(1, ...players.map((p) => p.arenaXp));
  }, [players]);

  const myLadderPosition = useMemo(() => {
    if (!address || !players.length) return null;
    const i = players.findIndex((p) => p.address === address.toLowerCase());
    if (i < 0) return null;
    return { place: i + 1, total: players.length };
  }, [address, players]);

  const themeMeta = useMemo(() => THEMES.find((t) => t.id === theme)!, [theme]);

  const initScoresForPool = useCallback(
    (items: RankItem[]) => {
      const persisted = loadPersisted(theme);
      const next: Record<string, number> = {};
      for (const it of items) {
        next[it.id] = persisted?.[it.id] ?? SCORE_START;
      }
      return next;
    },
    [theme]
  );

  const refreshPool = useCallback(async () => {
    setLoading(true);
    setRound(null);
    try {
      const items = await loadPool(theme);
      setPool(items);
      setScores(initScoresForPool(items));
      setDuels(0);
      setStreak(0);
      if (items.length < 1) {
        toast.error('Not enough items for this theme. Try another.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not load Arena pool');
      setPool([]);
    } finally {
      setLoading(false);
    }
  }, [theme, initScoresForPool]);

  useEffect(() => {
    refreshPool();
  }, [theme]);

  useEffect(() => {
    if (loading || round) return;
    if (pool.length < 1) return;
    const items = pickYesNoGridItems(pool, YESNO_GRID_SIZE);
    if (items.length > 0) {
      setRound({ kind: 'yesno', items });
    }
  }, [pool, loading, round, theme]);

  /** Only items you’ve moved off the baseline — after reset, list is empty until you stance again. */
  const ranking = useMemo(() => {
    return [...pool]
      .map((it) => ({ it, r: scores[it.id] ?? SCORE_START }))
      .filter((x) => x.r !== SCORE_START)
      .sort((a, b) => b.r - a.r)
      .map((x, i) => ({ ...x, place: i + 1 }));
  }, [pool, scores]);

  const resolveYesNo = useCallback(
    async (item: RankItem, support: boolean) => {
      if (support) playSuccess();
      else playClick();
      let stakeOk = true;
      let wei = 0n;
      try {
        wei = parseEther((stakeTRUST || '0').trim() || '0');
      } catch {
        toast.error('Invalid stake amount');
        return;
      }

      if (wei > 0n && isConnected && address) {
        if (!treasury) {
          toast.info('On-chain stake unavailable. Your stance still counts — use Practice or try again later.');
        } else {
          setStakingTx(true);
          try {
            await sendNativeTransfer(address, treasury, wei);
            toast.success('TRUST staked with this stance.');
          } catch (e: any) {
            const msg = e?.shortMessage ?? e?.message ?? 'Transaction failed';
            toast.error(msg);
            stakeOk = false;
          } finally {
            setStakingTx(false);
          }
        }
      } else if (wei > 0n && !isConnected) {
        toast.error('Connect your wallet to stake TRUST (or set stake to 0).');
        return;
      }

      if (!stakeOk) return;

      const delta = support ? YESNO_SCORE_YES : YESNO_SCORE_NO;
      setScores((prev) => {
        const R = prev[item.id] ?? SCORE_START;
        const next = { ...prev, [item.id]: R + delta };
        savePersisted(theme, next);
        return next;
      });
      setDuels((d) => d + 1);
      setStreak((s) => {
        const next = s + 1;
        if (next >= 3 && next % 3 === 0) {
          toast.success(`${next} in a row. You're on fire.`);
        }
        return next;
      });

      if (address) {
        let xpDelta = 12;
        if (wei > 0n) {
          const trust = parseFloat(formatEther(wei));
          if (Number.isFinite(trust)) xpDelta = Math.max(1, Math.round(trust * 100));
        }
        const rec = addArenaXp(address, xpDelta, 1);
        toast.success(`+${xpDelta} XP — you now have ${rec.xp.toLocaleString()} XP`);
        void refreshPlayers({ silent: true });
      }

      setRound((prev) => {
        if (!prev) return prev;
        const nextItem = pickReplacementForYesNoGrid(pool, item, prev.items);
        if (!nextItem) return null;
        const newItems = prev.items.map((it) => (it.id === item.id ? nextItem : it));
        return { kind: 'yesno', items: newItems };
      });
    },
    [theme, stakeTRUST, isConnected, address, treasury, refreshPlayers, pool]
  );

  const onYesNo = (item: RankItem, support: boolean) => {
    if (!round) return;
    void resolveYesNo(item, support);
  };

  const onSkip = () => {
    playClick();
    setStreak(0);
    const items = pickYesNoGridItems(pool, YESNO_GRID_SIZE);
    if (items.length > 0) {
      setRound({ kind: 'yesno', items });
    } else {
      setRound(null);
    }
  };

  const resetSession = () => {
    playClick();
    const next: Record<string, number> = {};
    for (const it of pool) next[it.id] = SCORE_START;
    setScores(next);
    savePersisted(theme, next);
    setDuels(0);
    setStreak(0);
    setRound(null);
    toast.success('Rank scores reset for this theme');
  };

  const itemHref = (it: RankItem) => {
    if (it.kind === 'token') return null;
    return `/markets/${it.id}`;
  };

  const nextMilestone = Math.ceil((duels + 1) / 5) * 5;
  const progressToMilestone = duels % 5;

  const xpPickPreview = useMemo(() => {
    try {
      const wei = parseEther((stakeTRUST || '0').trim() || '0');
      if (wei > 0n) {
        const t = parseFloat(formatEther(wei));
        if (Number.isFinite(t)) return Math.max(1, Math.round(t * 100));
      }
    } catch {
      /* ignore */
    }
    return 12;
  }, [stakeTRUST]);

  const stakeFillPct = useMemo(
    () => (stakePresetIdx / Math.max(1, ARENA_STAKE_PRESETS.length - 1)) * 100,
    [stakePresetIdx]
  );

  const streakTier = getStreakTier(streak);
  const minPoolNeeded = 1;

  return (
    <div className="min-h-screen bg-[#020617] w-full min-w-0 overflow-x-hidden pb-16 sm:pb-20 font-sans text-slate-300 selection:bg-cyan-500/25 selection:text-white">
      <section className="relative border-b border-cyan-500/15 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] opacity-[0.06]" />
        <div className="pointer-events-none absolute -left-32 top-0 h-[480px] w-[480px] rounded-full bg-cyan-500/12 blur-[130px]" />
        <div className="pointer-events-none absolute right-0 top-20 h-[320px] w-[320px] rounded-full bg-fuchsia-600/10 blur-[100px]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#030a14] via-transparent to-[#020617]" />

        <div className="w-full max-w-[min(1720px,calc(100vw-1.5rem))] sm:max-w-[min(1720px,calc(100vw-2rem))] mx-auto px-3 sm:px-6 lg:px-10 xl:px-12 pt-4 pb-4 md:pt-5 md:pb-5 relative z-10">
          <motion.div
            className="rounded-2xl border border-slate-700/70 bg-slate-950/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.35)] p-4 sm:p-5 md:p-6 transition-shadow duration-500 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_90px_rgba(34,211,238,0.08),0_24px_80px_rgba(0,0,0,0.35)]"
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="mb-4 md:mb-5 space-y-3">
              <motion.div
                className="space-y-2"
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="space-y-1.5 sm:space-y-2">
                  <span className="flex items-center gap-2.5 text-cyan-400/90">
                    <Sparkles size={18} className="shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]" strokeWidth={2.5} aria-hidden />
                    <span className="text-base sm:text-lg md:text-xl text-slate-100 font-semibold tracking-tight">
                      Welcome to
                    </span>
                  </span>
                  <span className="block text-[2rem] sm:text-4xl md:text-5xl lg:text-[3rem] font-black font-display leading-[1.02] tracking-tight">
                    <span className="text-cyan-300/80 font-serif text-[0.45em] sm:text-[0.5em] align-super mr-0.5 sm:mr-1" aria-hidden>
                      &ldquo;
                    </span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-white to-fuchsia-300 drop-shadow-[0_0_48px_rgba(34,211,238,0.35)]">
                      The Arena
                    </span>
                    <span className="text-cyan-300/80 font-serif text-[0.45em] sm:text-[0.5em] align-super ml-0.5 sm:ml-1" aria-hidden>
                      &rdquo;
                    </span>
                  </span>
                </h1>
                <div className="h-1 w-28 sm:w-36 rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300/90 shadow-[0_0_20px_rgba(34,211,238,0.45)]" />
              </motion.div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-600/80 bg-slate-900/90 px-3 py-1.5 sm:px-3.5 sm:py-2 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-300">
                  <Zap size={13} className="text-amber-400/90 shrink-0" /> Yes / no stance pool
                </span>
              </div>
            </header>

            <div className="border-b border-slate-800/90 pb-4 space-y-3">
              <div className="min-w-0 space-y-2">
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white font-display uppercase tracking-tight leading-[1.12]">
                  Stance on{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300">
                    the grid
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-snug">
                  Each round shows several claims — agree or disagree per card. Momentum and XP track how you lean. Stake TRUST for
                  more XP, or stay at 0 for practice.
                </p>
              </div>

              <motion.div
                className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-slate-900/95 to-[#070d16] px-3 py-2.5 sm:px-4 sm:py-3 relative overflow-hidden"
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-cyan-500/10 blur-xl pointer-events-none" />
                <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p className="text-[9px] font-black uppercase tracking-[0.28em] text-cyan-400/90 shrink-0">Live session</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg sm:text-xl font-black text-white tabular-nums leading-none">{duels}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Rounds</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg sm:text-xl font-black text-fuchsia-300 tabular-nums leading-none">{streak}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Streak</span>
                    </div>
                    {address && (
                      <div className="flex items-baseline gap-2 border-t border-slate-800/80 pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:border-slate-800/80 sm:pl-6">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Arena XP</span>
                        <span className="text-base sm:text-lg font-black text-amber-300 tabular-nums arena-xp-roll">{xpRoll.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="w-full sm:w-auto sm:min-w-[140px] sm:flex-1 sm:max-w-xs">
                    <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
                      <span>Milestone</span>
                      <span className="tabular-nums">
                        {progressToMilestone}/5 → {nextMilestone}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 transition-all duration-500"
                        style={{ width: `${(progressToMilestone / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              className="mt-3 relative rounded-xl border border-cyan-400/35 bg-gradient-to-br from-[#050c16] via-[#070f1a] to-fuchsia-950/30 p-3 sm:p-4 md:p-5 shadow-[0_0_40px_rgba(34,211,238,0.1),inset_0_1px_0_rgba(255,255,255,0.07)] overflow-hidden transition-shadow duration-500 hover:shadow-[0_0_56px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.09)]"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent opacity-90 arena-stake-top-glow" aria-hidden />
              <div className="pointer-events-none absolute -right-16 -top-12 h-32 w-32 rounded-full bg-cyan-500/12 blur-3xl" />
              <div className="pointer-events-none absolute -left-12 bottom-0 h-24 w-24 rounded-full bg-fuchsia-600/10 blur-3xl" />
              <div className="relative z-10 flex flex-col xl:flex-row xl:items-stretch gap-3 md:gap-4">
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex gap-2.5 sm:gap-3">
                      <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/45 bg-gradient-to-br from-cyan-500/25 to-fuchsia-600/20 shadow-[0_0_20px_rgba(34,211,238,0.3),inset_0_1px_0_rgba(255,255,255,0.12)]">
                        <Zap className="w-5 h-5 sm:w-5 sm:h-5 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300/95 mb-0.5">
                          TRUST tier stake
                        </p>
                        <p className="text-xs text-slate-400 max-w-md leading-snug">
                          Drag the orb or tap a tier. Higher stakes earn more XP per pick.
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right w-full sm:w-auto sm:min-w-[10rem] rounded-lg border border-fuchsia-500/25 bg-slate-950/60 px-3 py-2 shadow-[0_0_24px_rgba(168,85,247,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-300 font-black">
                        {ARENA_STAKE_TITLES[stakePresetIdx]}
                      </div>
                      <div className="text-2xl sm:text-[1.65rem] font-black tabular-nums text-white leading-none mt-0.5 tracking-tight">
                        {stakePresetIdx === 0 ? (
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-300 to-slate-500">Free run</span>
                        ) : (
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-cyan-200">
                            {ARENA_STAKE_PRESETS[stakePresetIdx]}{' '}
                            <span className="text-lg text-cyan-200/95">TRUST</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-amber-300 font-mono font-bold mt-1 tracking-wide">
                        +{xpPickPreview} XP <span className="text-amber-400/80 font-sans text-[10px] font-semibold">next pick</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="arena-stake-slider" className="sr-only">
                      TRUST stake level
                    </label>
                    <div className="space-y-2">
                      <div className={`relative h-11 flex items-center px-1 arena-stake-track-shell ${reduceMotion ? '' : 'arena-stake-track-shell--animated'}`}>
                        <div
                          className={`pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[14px] rounded-full overflow-hidden bg-slate-950/95 ring-1 ring-cyan-500/40 shadow-[inset_0_4px_14px_rgba(0,0,0,0.78)] ${reduceMotion ? '' : 'arena-stake-track-inner--pulse'}`}
                          aria-hidden
                        >
                          <div
                            className={`arena-stake-fill-bar h-full rounded-full transition-[width] duration-[380ms] ease-out ${reduceMotion ? '' : 'arena-stake-fill-bar--animated'}`}
                            style={{ width: `${stakeFillPct}%` }}
                          />
                        </div>
                        <input
                          id="arena-stake-slider"
                          type="range"
                          className="arena-stake-range relative z-[2] w-full cursor-pointer"
                          min={0}
                          max={ARENA_STAKE_PRESETS.length - 1}
                          step={1}
                          value={stakePresetIdx}
                          aria-valuemin={0}
                          aria-valuemax={ARENA_STAKE_PRESETS.length - 1}
                          aria-valuenow={stakePresetIdx}
                          aria-valuetext={`${ARENA_STAKE_TITLES[stakePresetIdx]}: ${stakeTRUST} TRUST`}
                          onChange={(e) => {
                            playClick();
                            setStakePresetIdx(Number(e.target.value));
                          }}
                        />
                      </div>
                      <div className="flex justify-between px-2">
                        {ARENA_STAKE_PRESETS.map((_, i) => (
                          <span
                            key={i}
                            className={`rounded-full transition-all duration-200 ${
                              i === stakePresetIdx
                                ? 'w-2 h-2 bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)] ring-2 ring-cyan-400/40'
                                : i < stakePresetIdx
                                  ? 'w-1.5 h-1.5 bg-cyan-500/65'
                                  : 'w-1.5 h-1.5 bg-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-between sm:justify-start">
                      {ARENA_STAKE_PRESETS.map((amt, i) => (
                        <motion.button
                          key={i}
                          type="button"
                          onClick={() => {
                            playClick();
                            setStakePresetIdx(i);
                          }}
                          onMouseEnter={playHover}
                          whileHover={reduceMotion ? undefined : { scale: 1.05, y: -1 }}
                          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                          transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                          className={`rounded-lg px-2 sm:px-2.5 py-1.5 min-w-[4.5rem] sm:min-w-[5rem] text-left transition-colors duration-200 ${
                            stakePresetIdx === i
                              ? 'bg-gradient-to-r from-cyan-500/35 to-fuchsia-600/30 text-white border border-cyan-400/50 shadow-[0_0_16px_rgba(34,211,238,0.2)]'
                              : 'border border-slate-700/80 bg-slate-900/80 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <span className="block text-[9px] font-black uppercase tracking-wider leading-tight">{ARENA_STAKE_TITLES[i]}</span>
                          <span
                            className={`block text-[8px] font-mono tabular-nums mt-0.5 leading-none ${
                              stakePresetIdx === i ? 'text-cyan-100/90' : 'text-slate-600'
                            }`}
                          >
                            {formatPresetTrustLabel(amt)}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {!isConnected && stakePresetIdx > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
                      <span className="text-[10px] text-amber-400/90 flex items-center gap-1">
                        <Wallet size={12} /> Connect wallet to stake TRUST on picks
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-row xl:flex-col flex-wrap xl:flex-nowrap gap-2 xl:justify-center xl:min-w-[10rem] shrink-0 xl:border-l xl:border-slate-800/80 xl:pl-4">
                  <motion.button
                    type="button"
                    onClick={() => {
                      playClick();
                      refreshPool();
                    }}
                    disabled={loading}
                    whileHover={reduceMotion || loading ? undefined : { scale: 1.02, y: -1 }}
                    whileTap={reduceMotion || loading ? undefined : { scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    className="inline-flex flex-1 xl:flex-none items-center justify-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-100 hover:bg-cyan-500/20 hover:border-cyan-400/50 disabled:opacity-50 transition-colors duration-200 shadow-[0_0_16px_rgba(34,211,238,0.1)]"
                  >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    New pool
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={resetSession}
                    disabled={!pool.length}
                    whileHover={reduceMotion || !pool.length ? undefined : { scale: 1.02 }}
                    whileTap={reduceMotion || !pool.length ? undefined : { scale: 0.98 }}
                    className="inline-flex flex-1 xl:flex-none items-center justify-center rounded-lg border border-slate-600/80 bg-slate-900/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-40 transition-colors duration-200"
                  >
                    Reset scores
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <div className="w-full max-w-[min(1720px,calc(100vw-1.5rem))] sm:max-w-[min(1720px,calc(100vw-2rem))] mx-auto px-3 sm:px-6 lg:px-10 xl:px-12 pb-10 pt-0">
        <motion.div
          className="rounded-3xl border border-slate-800/80 bg-[#040a14]/95 shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden transition-shadow duration-500 hover:shadow-[0_24px_72px_rgba(34,211,238,0.06),0_20px_60px_rgba(0,0,0,0.45)]"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,26vw)] xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_400px] gap-0 lg:gap-0 items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
        <div className="min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 space-y-4">
          <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-[#050a12] via-slate-950/90 to-[#0a0614] p-3 sm:p-4 shadow-[0_0_40px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-400/90 mb-2.5">Arena category</p>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <motion.button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    playClick();
                    setTheme(t.id);
                  }}
                  onMouseEnter={playHover}
                  whileHover={reduceMotion ? undefined : { scale: 1.04, y: -1 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-widest transition-colors duration-200 ${
                    theme === t.id
                      ? 'border-cyan-400/70 bg-gradient-to-r from-cyan-500/25 to-fuchsia-600/20 text-white shadow-[0_0_28px_rgba(34,211,238,0.22)] ring-1 ring-cyan-400/30'
                      : 'border-slate-700/90 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {t.icon}
                  {t.short}
                </motion.button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-snug max-w-2xl">{themeMeta.blurb}</p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-cyan-500/15 bg-slate-900/25 py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-slate-500">Loading pool...</div>
            </div>
          ) : pool.length < minPoolNeeded ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-16 text-center text-sm text-slate-500">
              Not enough items. Try another theme.
            </div>
          ) : !round ? (
            <div className="rounded-xl border border-slate-700/60 py-16 text-center bg-slate-900/15">
              <Loader2 className="w-9 h-9 text-cyan-400 animate-spin mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Drawing next round…</p>
            </div>
          ) : (
            <motion.div
              key={`y-${round.items.map((i) => i.id).join('-')}`}
              className="space-y-6"
              initial={reduceMotion ? false : { opacity: 0.94, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="rounded-2xl border border-white/[0.06] bg-[#0B0E11] p-3 sm:p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        Arena · Round {duels + 1}
                      </span>
                      <span className="inline-flex items-center gap-2 flex-wrap justify-end">
                        {streakTier.label ? (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-black uppercase text-white ${streakTier.className}`}>
                            <Flame size={10} />
                            {streakTier.label} ×{streak}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1.5 text-amber-200/90">
                          <Zap size={12} className="text-amber-400" />+{xpPickPreview} XP
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                      {round.items.map((item, idx) => {
                        const bar = poolSentimentYesPct(pool, scores, item.id);
                        const spotlight = idx === 0 && (streak >= 3 || duels % 4 === 0);
                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-white/[0.07] bg-[#161A1E] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex flex-col min-h-0"
                          >
                            <div className="relative aspect-[16/10] w-full bg-[#0a0d12] shrink-0">
                              {item.kind === 'claim' && item.pairKind === 'claim-vs' ? (
                                <ArenaVsHeroImages
                                  leftSrc={item.image}
                                  rightSrc={item.imageSecondary}
                                  leftName={item.versusLeftLabel}
                                  rightName={item.versusRightLabel}
                                />
                              ) : item.image ? (
                                <img src={item.image} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-[#0f1824] via-[#0B0E11] to-[#1a0a14]" />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-[#161A1E] via-transparent to-transparent opacity-90" />
                              {spotlight && (
                                <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-black/75 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-white ring-1 ring-white/10">
                                  <span className="flex gap-0.5" aria-hidden>
                                    <span className="h-1 w-1 rounded-full bg-emerald-400" />
                                    <span className="h-1 w-1 rounded-full bg-fuchsia-400" />
                                  </span>
                                  Spotlight
                                </div>
                              )}
                              <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
                                <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-300 ring-1 ring-white/10 truncate max-w-[70%]">
                                  {item.pairKind}
                                </span>
                              </div>
                            </div>

                            <div className="px-3 pt-3 pb-1 flex-1 min-h-0">
                              <p className="text-[10px] sm:text-[11px] font-semibold text-white leading-snug break-words line-clamp-3">{item.label}</p>
                              {item.subtitle ? (
                                <p className="text-[9px] text-slate-500 mt-1 font-mono uppercase tracking-wider line-clamp-2">{item.subtitle}</p>
                              ) : null}
                              <p className="text-[9px] text-slate-500 mt-1.5">
                                Score{' '}
                                <span className="font-mono tabular-nums text-cyan-200/90">{fmtArenaScore(scores[item.id] ?? SCORE_START)}</span>
                              </p>
                            </div>

                            <div className="px-3 pt-1 pb-1">
                              <p className="text-[8px] uppercase tracking-[0.18em] text-slate-500 mb-1">Momentum</p>
                              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-white/5">
                                <motion.div
                                  className="h-full shrink-0 rounded-l-full bg-gradient-to-r from-emerald-500 via-teal-400 to-teal-500"
                                  initial={false}
                                  animate={{ width: `${bar.yes}%` }}
                                  transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                                />
                                <div className="h-full min-w-0 flex-1 bg-gradient-to-r from-fuchsia-600 via-purple-500 to-pink-600" />
                              </div>
                              <div className="mt-1 flex justify-between text-[10px] font-black tabular-nums">
                                <span className="text-[#00FFA3] drop-shadow-[0_0_8px_rgba(0,255,163,0.3)]">{bar.yes}%</span>
                                <span className="text-[#FF007A] drop-shadow-[0_0_8px_rgba(255,0,122,0.2)]">{bar.no}%</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 p-3 pt-2">
                              <motion.button
                                type="button"
                                onClick={() => onYesNo(item, true)}
                                disabled={stakingTx}
                                onMouseEnter={playHover}
                                whileHover={reduceMotion || stakingTx ? undefined : { scale: 1.02 }}
                                whileTap={reduceMotion || stakingTx ? undefined : { scale: 0.97 }}
                                transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                                className="rounded-lg border border-emerald-500/35 bg-[#0d2130] py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-emerald-400/60 hover:bg-[#0f2838] disabled:opacity-50 disabled:pointer-events-none transition-colors"
                              >
                                <span className="block text-sm font-black tracking-tight text-[#00FFA3] drop-shadow-[0_0_12px_rgba(0,255,163,0.35)]">YES</span>
                                <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-widest text-emerald-400/70">Support</span>
                              </motion.button>
                              <motion.button
                                type="button"
                                onClick={() => onYesNo(item, false)}
                                disabled={stakingTx}
                                onMouseEnter={playHover}
                                whileHover={reduceMotion || stakingTx ? undefined : { scale: 1.02 }}
                                whileTap={reduceMotion || stakingTx ? undefined : { scale: 0.97 }}
                                transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                                className="rounded-lg border border-pink-500/35 bg-[#2a1018] py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-pink-400/55 hover:bg-[#32121c] disabled:opacity-50 disabled:pointer-events-none transition-colors"
                              >
                                <span className="block text-sm font-black tracking-tight text-[#FF007A] drop-shadow-[0_0_12px_rgba(255,0,122,0.3)]">NO</span>
                                <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-widest text-pink-400/75">Oppose</span>
                              </motion.button>
                            </div>

                            <div className="flex items-center justify-between gap-1.5 border-t border-white/[0.06] bg-black/20 px-3 py-2 text-[9px] text-slate-500 mt-auto">
                              <span className="inline-flex items-center gap-1 min-w-0">
                                <span className="flex -space-x-1 shrink-0" aria-hidden>
                                  <span className="h-4 w-4 rounded-full border border-[#161A1E] bg-gradient-to-br from-cyan-500/80 to-teal-600/60" />
                                  <span className="h-4 w-4 rounded-full border border-[#161A1E] bg-gradient-to-br from-fuchsia-500/70 to-purple-700/60" />
                                </span>
                                <span className="text-slate-400 tabular-nums truncate">+{pool.length}</span>
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-slate-400 shrink-0">
                                <Wallet size={11} className="text-slate-500" />
                                <span className="tabular-nums">{stakePresetIdx === 0 ? '0' : stakeTRUST}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[9px] text-slate-600 mt-3 text-center leading-snug px-2">
                      Bar split is per-claim momentum vs the pool (not on-chain odds).
                    </p>

                    <div className="mt-4 flex justify-center">
                      <motion.button
                        type="button"
                        onClick={onSkip}
                        disabled={stakingTx}
                        whileHover={reduceMotion || stakingTx ? undefined : { scale: 1.02 }}
                        whileTap={reduceMotion || stakingTx ? undefined : { scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/90 bg-[#161A1E] px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors"
                      >
                        <SkipForward size={14} />
                        Skip round
                      </motion.button>
                    </div>
                  </div>
            </motion.div>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 h-fit flex flex-col gap-4 min-w-0 w-full p-4 sm:p-5 md:p-6 lg:p-7 bg-[#03080e]/60">
          <div className="rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/90 to-[#060b14] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="mb-3 pb-4 border-b border-slate-800/80">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/15 border border-amber-400/35 shadow-[0_0_20px_rgba(245,158,11,0.15)] shrink-0">
                  <Trophy size={18} className="text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.36em] text-amber-300/90 mb-1.5 drop-shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                    {themeMeta.short} · live order
                  </p>
                  <h2 className="text-xl sm:text-2xl font-black font-display uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-white to-cyan-200 flex items-center gap-2 flex-wrap leading-tight">
                    <span className="inline-flex items-center gap-1.5 text-cyan-200/95">
                      {themeMeta.icon}
                    </span>
                    Your order
                    <Crown size={18} className="text-amber-400 shrink-0 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]" />
                  </h2>
                  <div className="h-[3px] w-16 mt-2.5 rounded-full bg-gradient-to-r from-amber-400 via-cyan-400 to-transparent opacity-90" />
                  <p className="text-xs text-slate-400 mt-3 leading-snug">
                    Claims you&apos;ve moved with yes/no show here. Reset clears this list until you rank again.
                  </p>
                </div>
              </div>
            </div>
            {ranking.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700/70 bg-slate-950/50 py-8 px-3 text-center text-[11px] text-slate-500 leading-relaxed">
                No stance scores yet. Vote on the grid — entries appear as you support or oppose claims.
              </div>
            ) : (
              <ol className="space-y-1.5 max-h-[min(320px,45vh)] lg:max-h-[min(380px,50vh)] overflow-y-auto pr-1 custom-scrollbar">
                {ranking.slice(0, 10).map(({ it, place, r }, rowIdx) => (
                  <li
                    key={it.id}
                    style={reduceMotion ? undefined : { animationDelay: `${rowIdx * 0.04}s` }}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-800/90 bg-[#070b14] px-2.5 py-2 text-sm transition-all duration-200 hover:border-cyan-500/35 hover:bg-[#0a101c] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                        place <= 3 ? 'bg-gradient-to-br from-amber-500/30 to-orange-600/20 text-amber-100' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {place}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-slate-100 font-medium text-[13px]">{it.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Rank score <span className="text-slate-400 font-mono tabular-nums">{fmtArenaScore(r)}</span>
                      </div>
                    </div>
                    {itemHref(it) && (
                      <Link to={itemHref(it)!} onClick={playClick} className="shrink-0 text-[10px] font-black uppercase text-cyan-400/90">
                        Market
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <motion.div
            className="w-full"
            whileHover={reduceMotion ? undefined : { y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <Link
              to="/markets/triples"
              onMouseEnter={playHover}
              className="flex items-center justify-between rounded-xl border border-slate-700/90 bg-slate-900/70 px-3.5 py-3 text-[13px] text-slate-300 hover:border-cyan-500/40 transition-all duration-200 hover:shadow-[0_12px_32px_rgba(34,211,238,0.08)] group"
            >
              <span>Browse Markets</span>
              <ChevronRight
                size={15}
                className="text-cyan-500/80 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          </motion.div>
        </aside>
        </div>
        </motion.div>

        <motion.section
          className="relative mt-8 md:mt-10 w-full min-w-0 overflow-hidden rounded-3xl border-2 border-fuchsia-500/30 bg-[#020814] shadow-[0_0_100px_rgba(168,85,247,0.14),0_0_1px_rgba(34,211,238,0.35),inset_0_1px_0_rgba(255,255,255,0.07)] transition-[box-shadow] duration-500 hover:shadow-[0_0_120px_rgba(168,85,247,0.2),0_0_1px_rgba(34,211,238,0.45),inset_0_1px_0_rgba(255,255,255,0.09)]"
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] opacity-[0.06]" />
          <div className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-amber-400/12 blur-[110px]" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-56 w-56 rounded-full bg-cyan-400/12 blur-[100px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent" />
          <div className="relative z-10 p-5 sm:p-7 md:p-10">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-6 md:mb-8 pb-6 md:pb-8 border-b border-slate-700/80">
              <div className="flex items-start gap-4 min-w-0">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-400/35 to-fuchsia-700/25 border border-amber-300/50 shadow-[0_0_32px_rgba(251,191,36,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] shrink-0">
                  <Medal size={26} className="text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                </div>
                <div className="min-w-0 text-center lg:text-left mx-auto lg:mx-0 max-w-xl lg:max-w-none">
                  <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.45em] text-fuchsia-300 mb-2.5 drop-shadow-[0_0_16px_rgba(217,70,239,0.5)]">
                    Worldwide ladder
                  </p>
                  <h2 className="text-[1.65rem] sm:text-3xl md:text-[2.65rem] font-black font-display uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-white to-cyan-200 leading-[1.05] drop-shadow-[0_2px_28px_rgba(255,255,255,0.14)]">
                    Arena champions
                  </h2>
                  <div className="h-[3px] w-24 mx-auto lg:mx-0 mt-3 rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400 opacity-95 shadow-[0_0_16px_rgba(217,70,239,0.35)]" />
                  <p className="text-sm md:text-[15px] text-slate-400 mt-4 leading-relaxed max-w-xl lg:max-w-2xl">
                    Ranked by total Arena XP. Stake harder, rank faster, and climb — everyone sees where you stand.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 rounded-2xl border border-amber-400/35 bg-gradient-to-br from-slate-950/95 via-[#0a101c]/95 to-slate-950/95 px-5 py-3.5 shrink-0 backdrop-blur-sm shadow-[0_0_28px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] mx-auto lg:mx-0">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/30">
                  <Trophy size={22} className="text-amber-300 shrink-0 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/90 font-black">On the board</div>
                  <div className="text-2xl font-black text-white tabular-nums leading-none mt-1 drop-shadow-[0_0_12px_rgba(255,255,255,0.08)]">
                    {playersLoading ? '…' : players.length}
                  </div>
                </div>
              </div>
            </div>

            {!playersLoading && players.length > 0 && myLadderPosition && (
              <motion.div
                key={address ?? 'anon'}
                className="mb-6 rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500/[0.08] via-slate-900/80 to-fuchsia-600/[0.06] px-4 py-3.5 text-center sm:text-left shadow-[0_0_28px_rgba(34,211,238,0.1)] transition-shadow duration-300 hover:shadow-[0_0_36px_rgba(34,211,238,0.16)]"
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              >
                <p className="text-sm text-slate-200 font-semibold">
                  <span className="text-cyan-300 font-black tabular-nums">#{myLadderPosition.place}</span>
                  <span className="text-slate-500 font-normal mx-1">of</span>
                  <span className="text-white font-black tabular-nums">{myLadderPosition.total}</span>
                  <span className="text-slate-400 font-normal ml-2">— keep ranking to move up.</span>
                </p>
              </motion.div>
            )}

            {playersLoading ? (
              <div className="flex flex-col items-center justify-center py-20 md:py-28 gap-3">
                <Loader2 className="w-12 h-12 text-fuchsia-400 animate-spin" />
                <span className="text-xs text-slate-500">Loading…</span>
              </div>
            ) : players.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-950/40 py-16 md:py-20 text-center px-4">
                <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
                  No entries yet. Connect your wallet, pick with a stake above Practice, and your XP will show here.
                </p>
              </div>
            ) : (
              <>
                {players.length >= 3 && (
                  <div className="flex justify-center items-end gap-4 sm:gap-8 mb-10 max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-2">
                    {[
                      { idx: 1, h: 'h-16', ring: 'from-slate-200/55 to-slate-500/45', label: '2nd' },
                      { idx: 0, h: 'h-28', ring: 'from-amber-200/70 to-amber-600/50', label: '1st', showCrown: true },
                      { idx: 2, h: 'h-12', ring: 'from-amber-600/50 to-orange-900/50', label: '3rd' },
                    ].map((slot) => {
                      const { idx, h, ring, label, showCrown } = slot;
                      const p = players[idx]!;
                      const isYou = address && p.address === address.toLowerCase();
                      const xpPct = Math.min(100, Math.round((p.arenaXp / playersMaxXp) * 100));
                      return (
                        <motion.div
                          key={p.address}
                          className="flex flex-col items-center flex-1 max-w-[200px] sm:max-w-[220px]"
                          whileHover={reduceMotion ? undefined : { y: -6, transition: { type: 'spring', stiffness: 380, damping: 22 } }}
                        >
                          <div
                            className={`flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${idx === 0 ? 'text-amber-200' : 'text-slate-400'}`}
                          >
                            {showCrown ? (
                              <Crown size={15} className="text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                            ) : null}
                            {label}
                          </div>
                          <div
                            className={`w-full rounded-t-xl bg-gradient-to-b ${ring} p-[2px] shadow-xl ${idx === 0 ? 'shadow-[0_0_40px_rgba(251,191,36,0.25)]' : 'shadow-black/50'}`}
                          >
                            <div
                              className={`rounded-t-[10px] bg-gradient-to-b from-[#0c1520] to-[#060a10] ${h} flex flex-col items-center justify-end pb-2.5 px-2 border-b border-white/10`}
                            >
                              <span className="text-sm font-mono text-amber-100 tabular-nums font-black drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]">
                                {p.arenaXp}
                              </span>
                              <span className="text-[9px] text-amber-400/90 uppercase tracking-widest font-bold font-mono">XP</span>
                              <span className="text-[9px] text-slate-400 font-mono font-semibold mt-1">{p.duels} picks</span>
                            </div>
                          </div>
                          <div className="mt-3 text-center w-full min-w-0 px-1">
                            <div className="text-[12px] font-bold text-slate-100 truncate drop-shadow-sm">
                              {isYou ? <span className="text-cyan-300">You · </span> : null}
                              {p.label}
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-slate-800/90 overflow-hidden ring-1 ring-white/5">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]"
                                style={{ width: `${xpPct}%` }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                <div className="mx-auto w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
                  <ol
                    className={`flex flex-col gap-2 sm:gap-2.5 max-h-[min(560px,62vh)] overflow-y-auto pr-1 custom-scrollbar ${
                      players.length > 5 ? 'sm:grid sm:grid-cols-2 sm:flex-none sm:gap-x-3 sm:gap-y-2.5' : ''
                    }`}
                  >
                    {players.map((p, rowIdx) => {
                      const isYou = address && p.address === address.toLowerCase();
                      const xpPct = Math.min(100, Math.round((p.arenaXp / playersMaxXp) * 100));
                      const top = p.rank <= 3;
                      const tier = arenaCombatTier(p.arenaXp);
                      const avgPick = p.duels > 0 ? Math.round(p.arenaXp / p.duels) : p.arenaXp;
                      const shortAddr = `${p.address.slice(0, 6)}…${p.address.slice(-4)}`;
                      const rankColor =
                        p.rank === 1
                          ? 'text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,0.35)]'
                          : p.rank === 2
                            ? 'text-slate-200'
                            : p.rank === 3
                              ? 'text-orange-300/95'
                              : 'text-slate-500';
                      return (
                        <li
                          key={p.address}
                          style={reduceMotion ? undefined : { animationDelay: `${Math.min(rowIdx, 20) * 0.035}s` }}
                          className="flex items-stretch gap-2 sm:gap-3 min-w-0"
                          aria-label={`Rank ${p.rank}`}
                        >
                          <div
                            className="shrink-0 w-8 sm:w-9 flex flex-col items-center justify-start pt-2 sm:pt-2.5 select-none"
                            aria-hidden
                          >
                            <span className={`text-xl sm:text-2xl font-black tabular-nums leading-none ${rankColor}`}>
                              {p.rank}
                            </span>
                          </div>
                          <div
                            className={`group relative flex min-w-0 flex-1 flex-col rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-[13px] transition-all duration-300 ease-out hover:-translate-y-0.5 ${
                              isYou
                                ? 'bg-gradient-to-br from-cyan-500/[0.12] via-slate-950/95 to-slate-950 border border-cyan-400/50 shadow-[0_0_28px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_0_40px_rgba(34,211,238,0.22)]'
                                : top
                                  ? 'bg-gradient-to-br from-amber-500/[0.08] via-[#0b1018]/98 to-slate-950/98 border border-amber-400/35 hover:border-amber-300/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:shadow-[0_12px_36px_rgba(245,158,11,0.08)]'
                                  : 'border border-slate-700/65 bg-slate-950/95 hover:border-slate-500/55 hover:bg-slate-900/95 hover:shadow-[0_10px_32px_rgba(0,0,0,0.45)]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden ring-1 ring-white/15 bg-gradient-to-br from-slate-800 to-slate-950 shadow-inner">
                                {p.image ? (
                                  <img src={p.image} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-sm font-black text-cyan-200/90">
                                    {leaderboardAvatarGlyph(p.label)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 gap-y-1">
                                  {isYou && (
                                    <span className="text-[8px] font-black uppercase tracking-wider text-cyan-950 shrink-0 px-1.5 py-0.5 rounded bg-cyan-400/90 border border-cyan-200/50">
                                      You
                                    </span>
                                  )}
                                  <span className="text-white font-semibold text-sm sm:text-[15px] leading-snug truncate">
                                    {p.label}
                                  </span>
                                  <span
                                    className={`shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${tier.chip}`}
                                  >
                                    {tier.label}
                                  </span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px]">
                                  <span className="inline-flex items-center gap-1 text-slate-300">
                                    <Activity size={12} className="text-cyan-400 shrink-0" />
                                    <span className="font-mono tabular-nums font-bold text-white">{p.duels}</span>
                                    <span className="text-slate-400 font-medium">duels</span>
                                  </span>
                                  <span className="text-slate-600">·</span>
                                  <span className="text-slate-300">
                                    <span className="text-amber-300 font-mono tabular-nums font-bold">{avgPick}</span>{' '}
                                    <span className="text-slate-500 font-medium">XP/pick</span>
                                  </span>
                                  <span className="text-slate-600">·</span>
                                  <span className="inline-flex items-center gap-1 text-slate-300">
                                    <Clock size={11} className="text-fuchsia-400/80 shrink-0" />
                                    <span className="font-medium text-slate-200">{formatRelativeArenaActive(p.updatedAt)}</span>
                                  </span>
                                </div>
                                <p className="text-[9px] text-slate-500 font-mono mt-1.5 truncate tracking-wide">{shortAddr}</p>
                              </div>
                              <div className="shrink-0 text-right pl-1">
                                <span className="font-mono text-lg sm:text-xl tabular-nums font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500">
                                  {p.arenaXp}
                                </span>
                                <div className="text-[8px] text-amber-400/90 uppercase tracking-[0.15em] font-bold mt-0.5">
                                  XP
                                </div>
                              </div>
                            </div>
                            <div className="mt-2.5 h-2 rounded-full bg-slate-900/95 overflow-hidden ring-1 ring-slate-700/70 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)]">
                              <div
                                className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                                  isYou
                                    ? 'bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-fuchsia-600'
                                    : 'bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400'
                                }`}
                                style={{ width: `${xpPct}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center mt-1.5 text-[9px] uppercase tracking-[0.15em] font-bold">
                              <span className="text-slate-500">Chase pack</span>
                              <span className="tabular-nums text-cyan-300/90">
                                {xpPct}% <span className="text-slate-600">of leader</span>
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </>
            )}
          </div>
        </motion.section>
      </div>

      <style>{`
        @keyframes arena-row-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .arena-sidebar-row {
          animation: arena-row-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .arena-sidebar-row {
            animation: none !important;
          }
          .arena-yesno-scanline,
          .arena-stake-top-glow,
          .arena-stake-track-inner--pulse,
          .arena-stake-fill-bar--animated,
          .arena-stake-track-shell--animated {
            animation: none !important;
          }
          .arena-stake-range::-webkit-slider-thumb,
          .arena-stake-range::-moz-range-thumb {
            animation: none !important;
          }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15,23,42,0.5); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34,211,238,0.25); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34,211,238,0.45); }
        @keyframes arena-stake-top-pulse {
          0%, 100% { opacity: 0.75; }
          50% { opacity: 1; }
        }
        @keyframes arena-yesno-scan {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .arena-yesno-scanline {
          animation: arena-yesno-scan 2.4s ease-in-out infinite;
        }
        .arena-xp-roll {
          text-shadow: 0 0 20px rgba(251, 191, 36, 0.22);
        }
        .arena-stake-top-glow {
          animation: arena-stake-top-pulse 2.8s ease-in-out infinite;
        }
        @keyframes arena-stake-track-pulse {
          0%, 100% {
            box-shadow: inset 0 4px 14px rgba(0,0,0,0.78), 0 0 0 1px rgba(34,211,238,0.35), 0 0 18px rgba(34,211,238,0.12);
          }
          50% {
            box-shadow: inset 0 4px 14px rgba(0,0,0,0.78), 0 0 0 1px rgba(34,211,238,0.55), 0 0 28px rgba(34,211,238,0.28), 0 0 40px rgba(168,85,247,0.12);
          }
        }
        .arena-stake-track-inner--pulse {
          animation: arena-stake-track-pulse 2.4s ease-in-out infinite;
        }
        @keyframes arena-stake-fill-sweep {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes arena-stake-fill-glow {
          0%, 100% {
            filter: brightness(1);
            box-shadow: 0 0 18px rgba(34,211,238,0.4), inset 0 1px 0 rgba(255,255,255,0.22);
          }
          50% {
            filter: brightness(1.12);
            box-shadow: 0 0 32px rgba(34,211,238,0.55), 0 0 24px rgba(168,85,247,0.25), inset 0 1px 0 rgba(255,255,255,0.28);
          }
        }
        .arena-stake-fill-bar {
          box-shadow: 0 0 18px rgba(34,211,238,0.35), inset 0 1px 0 rgba(255,255,255,0.2);
          background: linear-gradient(90deg, #22d3ee, #38bdf8 35%, #c084fc 70%, #d946ef);
          background-size: 100% 100%;
        }
        .arena-stake-fill-bar--animated {
          background-size: 200% 100%;
          animation: arena-stake-fill-sweep 4s linear infinite, arena-stake-fill-glow 2.2s ease-in-out infinite;
        }
        @keyframes arena-stake-thumb-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.05); }
        }
        @keyframes arena-stake-shell-glow {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        .arena-stake-track-shell--animated {
          animation: arena-stake-shell-glow 3s ease-in-out infinite;
        }
        .arena-stake-range {
          -webkit-appearance: none;
          appearance: none;
          height: 3.5rem;
          background: transparent;
          outline: none;
        }
        .arena-stake-range::-webkit-slider-runnable-track {
          height: 14px;
          background: transparent;
          border: none;
        }
        .arena-stake-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 30px;
          height: 30px;
          margin-top: -8px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.15) 28%, transparent 42%),
            linear-gradient(150deg, #67e8f9 0%, #22d3ee 35%, #a855f7 88%, #c084fc);
          border: 3px solid rgba(255,255,255,0.55);
          box-shadow:
            0 0 0 1px rgba(34,211,238,0.45),
            0 0 32px rgba(34,211,238,0.55),
            0 0 20px rgba(168,85,247,0.35),
            0 5px 14px rgba(0,0,0,0.5),
            inset 0 2px 3px rgba(255,255,255,0.45);
          cursor: grab;
          animation: arena-stake-thumb-float 2.6s ease-in-out infinite;
        }
        .arena-stake-range:hover::-webkit-slider-thumb {
          animation-duration: 1.5s;
        }
        .arena-stake-range::-webkit-slider-thumb:active {
          cursor: grabbing;
          animation: none;
          transform: scale(1.08) translateY(0);
        }
        .arena-stake-range::-moz-range-track {
          height: 14px;
          background: transparent;
          border: none;
        }
        .arena-stake-range::-moz-range-thumb {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid rgba(255,255,255,0.55);
          background: linear-gradient(150deg, #67e8f9, #22d3ee 40%, #a855f7);
          box-shadow: 0 0 28px rgba(34,211,238,0.5), 0 4px 12px rgba(0,0,0,0.45);
          cursor: grab;
          animation: arena-stake-thumb-float 2.6s ease-in-out infinite;
        }
        .arena-stake-range:hover::-moz-range-thumb {
          animation-duration: 1.5s;
        }
        .arena-stake-range::-moz-range-thumb:active {
          animation: none;
          transform: scale(1.08);
        }
      `}</style>
    </div>
  );
};

export default RankedList;
