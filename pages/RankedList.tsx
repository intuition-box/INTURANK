/** Arena: local stance grid + arena points. Vaults: /markets/:id */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { parseEther, formatEther, getAddress } from 'viem';
import {
  Trophy,
  RefreshCw,
  Loader2,
  Sparkles,
  ChevronRight,
  Flame,
  Zap,
  SkipForward,
  Crown,
  Wallet,
  Activity,
  Clock,
  Medal,
  X,
  List,
  ArrowLeft,
  Check,
  Star,
} from 'lucide-react';
import {
  getTopClaims,
  getLists,
  getListMemberSubjectsForObject,
  predicateIsSocialTagNoise,
  predicateLooksLikeBattlePredicateLoose,
  resolveMetadata,
  registerArenaPortalListTermsForIndexing,
} from '../services/graphql';
import { createSemanticTriplesBatch, createTripleFromLabels, sendNativeTransfer } from '../services/web3';
import { playClick, playHover, playSuccess } from '../services/audio';
import { toast } from '../components/Toast';
import { fetchArenaXpRecordForWallet, postArenaTotalsMirrorOptional } from '../services/arenaXp';
import { fetchArenaPlayerLeaderboard, type ArenaPlayerRow } from '../services/arenaLeaderboard';
import { ARENA_BATCH_MODE, ARENA_XP_PER_RANK_PICK } from '../constants';
import { CURVE_OFFSET, DISTRUST_ATOM_ID, LIST_PREDICATE_ID } from '../constants';
import {
  clearPendingForList,
  getFirstListIdWithPending,
  loadPendingForList,
  savePendingForList,
  type ArenaPendingRow,
} from '../services/arenaPendingBatch';
import {
  ARENA_CATEGORY_PILLS,
  ARENA_LISTS,
  buildArenaItemQuestion,
  filterArenaListsByCategory,
  getArenaListById,
  getArenaListConstituents,
  getArenaPreviewItems,
  registerPortalListEntries,
  portalListIdFromTermId,
  type ArenaListEntry,
} from '../services/arenaListsRegistry';
import { loadArenaFavoriteListIds, saveArenaFavoriteListIds } from '../services/arenaFavorites';
import ArenaBatchReviewModal from '../components/ArenaBatchReviewModal';
import ArenaListCard from '../components/ArenaListCard';
import ArenaLeaderboardGlance from '../components/ArenaLeaderboardGlance';
import ArenaListQuickPick from '../components/ArenaListQuickPick';
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

/** Arena ranking: three stance cards fill the viewport; answering one removes & shifts lanes, new fills from the right. */
const ARENA_CARDS_PER_ROUND = 3;
/**
 * IntuRank-native rankers leaderboard: always shown alongside the ranking flow
 * via the `ArenaRankerLeaderboard` component (right column on desktop, below
 * the ranking column on mobile).
 */
const ARENA_SHOW_LEADERBOARD = true;
const TERM_ID_RE = /^0x[0-9a-fA-F]{64}$/;

function pickSingleItem(pool: RankItem[], lastId: string | null): RankItem | null {
  if (pool.length === 0) return null;
  const eligible = lastId && pool.length > 1 ? pool.filter((it) => it.id !== lastId) : pool;
  const src = eligible.length ? eligible : pool;
  return src[Math.floor(Math.random() * src.length)] ?? null;
}

const STORAGE_PREFIX = 'inturank-arena-pairwise';

/** Intuition FeeProxy / vault minimum deposit per atom or claim triple — enforced on-chain (see `CURVE_OFFSET`). */
const PROTOCOL_MIN_CLAIM_DEPOSIT_LABEL = formatEther(CURVE_OFFSET);

/**
 * Discrete stake tiers. With batch submissions, **each queued row’s on-chain deposit** is
 * `preset TRUST × row units`; every row must be ≥ protocol minimum (~0.5 TRUST). Presets below
 * that are misleading and are omitted in batch mode.
 * Legacy mode (micro-tips per pick to treasury) can keep smaller presets.
 */
const ARENA_STAKE_PRESETS_BATCH = [0.5, 1, 2, 2.5, 5, 10] as const;
const ARENA_STAKE_PRESETS_LEGACY = [0.1, 0.25, 0.5, 1, 2.5, 10] as const;
const ARENA_STAKE_PRESETS = (ARENA_BATCH_MODE ? ARENA_STAKE_PRESETS_BATCH : ARENA_STAKE_PRESETS_LEGACY) as
  | typeof ARENA_STAKE_PRESETS_BATCH
  | typeof ARENA_STAKE_PRESETS_LEGACY;
const ARENA_STAKE_TITLES = ARENA_BATCH_MODE
  ? (['Pulse', 'Surge', 'Blitz', 'Nova', 'Forge', 'Singularity'] as const)
  : (['Spark', 'Pulse', 'Surge', 'Blitz', 'Nova', 'Singularity'] as const);

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

function rankItemToPendingSnapshot(item: RankItem): ArenaPendingRow['item'] {
  return {
    id: item.id,
    kind: item.kind,
    label: item.label,
    subtitle: item.subtitle,
    image: item.image,
    imageSecondary: item.imageSecondary,
    versusLeftLabel: item.versusLeftLabel,
    versusRightLabel: item.versusRightLabel,
    pairKind: item.pairKind,
  };
}

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

async function loadArenaListPool(entry: ArenaListEntry): Promise<RankItem[]> {
  if (entry.source === 'static') {
    return [...entry.items].sort(() => Math.random() - 0.5);
  }
  if (entry.source === 'portal') {
    const rows = await getListMemberSubjectsForObject(entry.listObjectTermId, 220);
    if (rows.length < 1) return [];
    return rows.map((r) => ({
      id: r.id,
      kind: 'atom' as const,
      label: r.label,
      subtitle: 'List member',
      image: r.image,
      pairKind: 'list-member',
    }));
  }
  return loadPool(entry.theme);
}

function pickYesNoGridItems(pool: RankItem[], n: number): RankItem[] {
  if (pool.length === 0) return [];
  const k = Math.min(n, pool.length);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, k);
}

function pickNextUniqueFromPool(pool: RankItem[], visible: RankItem[]): RankItem | null {
  const keepIds = new Set(visible.map((it) => it.id));
  const eligible = pool.filter((it) => !keepIds.has(it.id));
  if (eligible.length > 0) {
    return eligible[Math.floor(Math.random() * eligible.length)] ?? null;
  }
  const lastId = visible[visible.length - 1]?.id ?? null;
  return pickSingleItem(pool, lastId);
}

/**
 * After a Yes/No, remove that lane entry; lanes shift visually (compact array order).
 * Back-fill slots from pool up to `ARENA_CARDS_PER_ROUND` with unique entries where possible.
 */
function refillLanesAfterAnswer(pool: RankItem[], prevLanes: RankItem[], answeredItem: RankItem): RankItem[] | null {
  const idx = prevLanes.findIndex((it) => it.id === answeredItem.id);
  if (idx < 0) return null;
  const rest = [...prevLanes.slice(0, idx), ...prevLanes.slice(idx + 1)];
  while (rest.length < ARENA_CARDS_PER_ROUND && pool.length > 0) {
    const next = pickNextUniqueFromPool(pool, rest);
    if (!next) break;
    rest.push(next);
  }
  return rest.length > 0 ? rest : null;
}

function dedupeArenaEntries(entries: ArenaListEntry[]): ArenaListEntry[] {
  const m = new Map<string, ArenaListEntry>();
  for (const e of entries) m.set(e.id, e);
  return [...m.values()];
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

function loadPersistedForList(listId: string): Record<string, number> | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}-scores-${listId}`);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && typeof o === 'object') return o as Record<string, number>;
  } catch {
    /* ignore */
  }
  return null;
}

function savePersistedForList(listId: string, s: Record<string, number>) {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}-scores-${listId}`, JSON.stringify(s));
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

function ArenaLaneCard({
  item,
  activeList,
  stakingTx,
  reduceMotion,
  emphasized,
  onYesNo,
}: {
  item: RankItem;
  activeList: ArenaListEntry | null | undefined;
  stakingTx: boolean;
  reduceMotion: boolean | null;
  emphasized: boolean;
  onYesNo: (support: boolean) => void;
}) {
  let questionLine = '';
  if (activeList) {
    questionLine =
      typeof activeList.itemQuestion === 'function' ? activeList.itemQuestion(item) : buildArenaItemQuestion(activeList, item);
  }

  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, x: 22, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`group relative flex flex-col rounded-2xl border overflow-hidden bg-gradient-to-br from-[#060a14]/95 via-[#080c18]/95 to-[#0c0814]/92 ${
        emphasized
          ? 'border-[#00f3ff]/40 shadow-[0_0_44px_rgba(0,243,255,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] md:scale-[1.02] md:z-[2]'
          : 'border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_40px_rgba(0,0,0,0.45)]'
      }`}
      style={{
        background:
          emphasized && !reduceMotion
            ? 'linear-gradient(155deg, rgba(0,243,255,0.12) 0%, rgba(6,10,20,0.96) 40%, rgba(16,8,22,0.92) 100%)'
            : undefined,
      }}
    >
      <div className="relative aspect-[4/3] min-h-[120px] sm:min-h-[132px] w-full bg-[#030508] overflow-hidden">
        {item.kind === 'claim' && item.pairKind === 'claim-vs' ? (
          <ArenaVsHeroImages
            leftSrc={item.image}
            rightSrc={item.imageSecondary}
            leftName={item.versusLeftLabel}
            rightName={item.versusRightLabel}
          />
        ) : item.image ? (
          <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-3xl font-black font-display"
            style={{
              background: 'radial-gradient(circle at 30% 20%, rgba(0,243,255,0.2) 0%, transparent 50%), #050a12',
              color: 'rgba(0,243,255,0.25)',
            }}
          >
            {(item.label || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020308] via-[#020308]/35 to-transparent opacity-92 pointer-events-none" />
        {item.pairKind ? (
          <div className="absolute bottom-2 left-2">
            <span className="rounded-lg bg-black/55 backdrop-blur-sm px-2 py-0.5 text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-[#00f3ff]/90 ring-1 ring-[#00f3ff]/25">
              {item.pairKind}
            </span>
          </div>
        ) : null}
      </div>
      <div className="px-2 sm:px-3 pt-2 pb-1 relative shrink-0 min-h-0">
        <p className="text-sm sm:text-[15px] font-bold text-white leading-tight line-clamp-2">{item.label}</p>
        {item.subtitle ? (
          <p className="text-[9px] sm:text-[10px] text-slate-500 mt-1 font-mono uppercase tracking-wide line-clamp-1">
            {item.subtitle}
          </p>
        ) : null}
        {questionLine ? (
          <p className="text-[9px] sm:text-[10px] text-[#89faff]/95 mt-2 leading-snug line-clamp-3 border border-[#00f3ff]/20 rounded-lg px-2 py-1 bg-[#00f3ff]/6">
            {questionLine}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 px-2 sm:px-3 pb-2.5 sm:pb-3 mt-auto">
        <motion.button
          type="button"
          onClick={() => onYesNo(true)}
          disabled={stakingTx}
          onMouseEnter={playHover}
          whileHover={reduceMotion || stakingTx ? undefined : { scale: 1.02 }}
          whileTap={reduceMotion || stakingTx ? undefined : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 450, damping: 22 }}
          className="relative rounded-lg sm:rounded-xl py-2.5 text-center disabled:opacity-45 disabled:pointer-events-none overflow-hidden"
          style={{
            border: '1px solid rgba(0,243,255,0.45)',
            background: 'linear-gradient(180deg, rgba(0,243,255,0.22) 0%, rgba(4,20,32,0.97) 100%)',
            boxShadow: '0 0 20px rgba(0,243,255,0.1), inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        >
          <span className="inline-flex items-center justify-center gap-1 relative z-10">
            <Check className="w-4 h-4 sm:w-[18px] sm:h-[18px]" style={{ color: '#7afcff' }} strokeWidth={2.5} />
            <span className="text-sm font-black tracking-tight" style={{ color: '#e0fffe', textShadow: '0 0 16px rgba(0,243,255,0.45)' }}>
              Yes
            </span>
          </span>
        </motion.button>
        <motion.button
          type="button"
          onClick={() => onYesNo(false)}
          disabled={stakingTx}
          onMouseEnter={playHover}
          whileHover={reduceMotion || stakingTx ? undefined : { scale: 1.02 }}
          whileTap={reduceMotion || stakingTx ? undefined : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 450, damping: 22 }}
          className="relative rounded-lg sm:rounded-xl py-2.5 text-center disabled:opacity-45 disabled:pointer-events-none overflow-hidden"
          style={{
            border: '1px solid rgba(255,30,109,0.45)',
            background: 'linear-gradient(180deg, rgba(255,30,109,0.2) 0%, rgba(24,4,16,0.97) 100%)',
            boxShadow: '0 0 18px rgba(255,30,109,0.08), inset 0 1px 0 rgba(255,255,255,0.11)',
          }}
        >
          <span className="inline-flex items-center justify-center gap-1 relative z-10">
            <X className="w-4 h-4 sm:w-[18px] sm:h-[18px]" style={{ color: '#ff9ec4' }} strokeWidth={2.5} />
            <span className="text-sm font-black tracking-tight" style={{ color: '#ffe0ec', textShadow: '0 0 14px rgba(255,30,109,0.3)' }}>
              No
            </span>
          </span>
        </motion.button>
      </div>
    </motion.article>
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
  const [listId, setListId] = useState<string | null>(() => {
    try {
      const v = sessionStorage.getItem('inturank-arena-last-list');
      return v && getArenaListById(v) ? v : null;
    } catch {
      return null;
    }
  });
  const [pool, setPool] = useState<RankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [round, setRound] = useState<ArenaRound | null>(null);
  const [duels, setDuels] = useState(0);
  const [streak, setStreak] = useState(0);
  const [stakePresetIdx, setStakePresetIdx] = useState(defaultStakePresetIndex);
  const [stakingTx, setStakingTx] = useState(false);
  const [arenaCategoryId, setArenaCategoryId] = useState<string>('all');
  const [openBatchAfterLoad, setOpenBatchAfterLoad] = useState(false);
  const [showAllLists, setShowAllLists] = useState(false);
  const [favoriteListIds, setFavoriteListIds] = useState<string[]>(() => loadArenaFavoriteListIds());
  const [searchParams, setSearchParams] = useSearchParams();
  const openBatchParamHandled = useRef(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState<ArenaPendingRow[]>([]);
  const [players, setPlayers] = useState<ArenaPlayerRow[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const reduceMotion = useReducedMotion();

  const stakeTRUST = useMemo(() => String(ARENA_STAKE_PRESETS[stakePresetIdx] ?? ARENA_STAKE_PRESETS[0]), [stakePresetIdx]);

  /** Batch claims: FeeProxy rejects any triple row whose depositWei is below CURVE_OFFSET. */
  const batchDepositBelowProtocol = useMemo(() => {
    if (!ARENA_BATCH_MODE || pendingRows.length === 0) return false;
    let baseWei: bigint;
    try {
      baseWei = parseEther((stakeTRUST || '0').trim() || '0');
    } catch {
      return true;
    }
    return pendingRows.some((row) => baseWei * BigInt(row.units) < CURVE_OFFSET);
  }, [pendingRows, stakeTRUST]);

  /** Keep preset index in range if tiers differ between batch vs legacy builds. */
  useEffect(() => {
    setStakePresetIdx((i) => Math.min(Math.max(0, i), ARENA_STAKE_PRESETS.length - 1));
  }, []);

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

  const [graphArenaXp, setGraphArenaXp] = useState(0);

  /** Slot-style counting — animates when XP changes after indexer-derived updates. */
  const xpAnimRef = useRef<number | null>(null);
  const xpRafRef = useRef<number | null>(null);
  const [xpRoll, setXpRoll] = useState(0);

  const refreshArenaXpSelf = useCallback(async () => {
    if (!address) {
      xpAnimRef.current = null;
      setGraphArenaXp(0);
      setXpRoll(0);
      return;
    }
    try {
      const rec = await fetchArenaXpRecordForWallet(address);
      setGraphArenaXp(rec.xp);
    } catch {
      setGraphArenaXp(0);
    }
  }, [address]);

  useEffect(() => {
    xpAnimRef.current = null;
  }, [address]);

  useEffect(() => {
    void refreshArenaXpSelf();
  }, [refreshArenaXpSelf]);

  useEffect(() => {
    const onUp = () => void refreshArenaXpSelf();
    window.addEventListener('inturank-arena-onchain-updated', onUp);
    return () => window.removeEventListener('inturank-arena-onchain-updated', onUp);
  }, [refreshArenaXpSelf]);

  useEffect(() => {
    const target = graphArenaXp;
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
    const dur = 900;
    const t0 = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - u) ** 3;
      const v = Math.round(start + (target - start) * eased);
      setXpRoll(v);
      if (u < 1) {
        xpRafRef.current = requestAnimationFrame(tick);
      } else {
        xpRafRef.current = null;
        xpAnimRef.current = target;
      }
    };
    xpRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (xpRafRef.current != null) cancelAnimationFrame(xpRafRef.current);
      xpRafRef.current = null;
    };
  }, [graphArenaXp, reduceMotion]);

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

  const activeList = useMemo(() => getArenaListById(listId), [listId]);

  useEffect(() => {
    const entry = listId ? getArenaListById(listId) : undefined;
    if (entry?.source === 'portal' && entry.listObjectTermId) {
      registerArenaPortalListTermsForIndexing([entry.listObjectTermId]);
    }
  }, [listId]);

  const [portalListEntries, setPortalListEntries] = useState<
    Extract<ArenaListEntry, { source: 'portal' }>[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items } = await getLists(48, 0, [{ total_position_count: 'desc' }]);
        if (cancelled) return;
        const entries: Extract<ArenaListEntry, { source: 'portal' }>[] = items.map((row: any) => {
          const subs = (row.items || []) as { termId?: string; label?: string; image?: string }[];
          return {
            id: portalListIdFromTermId(row.id),
            source: 'portal' as const,
            listObjectTermId: row.id,
            title: row.label || 'Untitled list',
            description: `Intuition list · ${
              typeof row.totalItems === 'number' ? `${row.totalItems} members indexed` : 'live on the graph'
            }`,
            tag: 'Live',
            arenaCategory: 'network',
            listGlyph: '◆',
            totalItems: row.totalItems ?? 0,
            itemQuestion: (item: RankItem) =>
              `Should “${(item.label || 'this entry').trim()}” stay on “${(row.label || 'this list').trim()}” for you?`,
            previewItemsData: subs.map((s) => ({
              termId: s.termId,
              label: s.label || '—',
              image: s.image,
            })),
          };
        });
        registerPortalListEntries(entries);
        registerArenaPortalListTermsForIndexing(entries.map((e) => e.listObjectTermId));
        setPortalListEntries(entries);
      } catch {
        if (!cancelled) setPortalListEntries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const listsForCategory = useMemo(() => {
    const curated = filterArenaListsByCategory(ARENA_LISTS, arenaCategoryId);
    if (arenaCategoryId === 'all') return [...curated, ...portalListEntries];
    if (arenaCategoryId === 'network') {
      return filterArenaListsByCategory(portalListEntries, 'network');
    }
    return curated;
  }, [arenaCategoryId, portalListEntries]);

  const groupedArenaLists = useMemo(() => {
    const order = ['network', 'ecosystem', 'identities', 'graph', 'macro'] as const;
    const groups = order
      .map((id) => ({
        id,
        label: ARENA_CATEGORY_PILLS.find((p) => p.id === id)?.label ?? id,
        lists: listsForCategory.filter((l) => l.arenaCategory === id),
      }))
      .filter((g) => g.lists.length > 0);
    return groups;
  }, [listsForCategory]);

  const favoriteSet = useMemo(() => new Set(favoriteListIds), [favoriteListIds]);

  const toggleListFavorite = useCallback((fid: string) => {
    const k = fid.trim();
    if (!k || !getArenaListById(k)) return;
    playClick();
    setFavoriteListIds((prev) => {
      let next: string[];
      const i = prev.findIndex((x) => x === k);
      if (i >= 0) next = prev.filter((_, j) => j !== i);
      else next = [...prev, k];
      saveArenaFavoriteListIds(next);
      return next;
    });
  }, []);

  const allArenaListsFlat = useMemo(() => dedupeArenaEntries([...ARENA_LISTS, ...portalListEntries]), [portalListEntries]);

  /** Quick-switch + dropdown: favorites first, then alphabetical. */
  const quickSwitchSortedLists = useMemo(() => {
    return [...allArenaListsFlat].sort((a, b) => {
      const fa = favoriteSet.has(a.id);
      const fb = favoriteSet.has(b.id);
      if (fa !== fb) return fa ? -1 : 1;
      return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    });
  }, [allArenaListsFlat, favoriteSet]);

  const favoriteListsInLane = useMemo(
    () =>
      [...listsForCategory]
        .filter((l) => favoriteSet.has(l.id))
        .sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })),
    [listsForCategory, favoriteSet]
  );

  const quickPickFavoriteRows = useMemo(
    () => quickSwitchSortedLists.filter((l) => favoriteSet.has(l.id)),
    [quickSwitchSortedLists, favoriteSet]
  );
  const quickPickOtherRows = useMemo(
    () => quickSwitchSortedLists.filter((l) => !favoriteSet.has(l.id)),
    [quickSwitchSortedLists, favoriteSet]
  );

  useEffect(() => {
    setShowAllLists(false);
  }, [arenaCategoryId]);

  const stanceSummary = useMemo(() => {
    let yes = 0;
    let no = 0;
    for (const it of pool) {
      const r = scores[it.id] ?? SCORE_START;
      if (r > SCORE_START) yes += 1;
      else if (r < SCORE_START) no += 1;
    }
    return { yes, no, total: pool.length };
  }, [pool, scores]);

  useEffect(() => {
    if (!listId) {
      setPendingRows([]);
      return;
    }
    setPendingRows(loadPendingForList(listId));
  }, [listId]);

  useEffect(() => {
    if (searchParams.get('openBatch') !== '1') {
      openBatchParamHandled.current = false;
      return;
    }
    if (openBatchParamHandled.current) return;
    openBatchParamHandled.current = true;
    const lid = searchParams.get('listId') || getFirstListIdWithPending();
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete('openBatch');
        n.delete('listId');
        return n;
      },
      { replace: true }
    );
    if (lid && getArenaListById(lid)) {
      setListId(lid);
      try {
        sessionStorage.setItem('inturank-arena-last-list', lid);
      } catch {
        /* ignore */
      }
      setOpenBatchAfterLoad(true);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!openBatchAfterLoad) return;
    if (!listId || loading) return;
    setOpenBatchAfterLoad(false);
    if (loadPendingForList(listId).length > 0) {
      setBatchModalOpen(true);
    }
  }, [openBatchAfterLoad, listId, loading]);

  useEffect(() => {
    if (!listId) return;
    savePendingForList(listId, pendingRows);
  }, [listId, pendingRows]);

  useEffect(() => {
    const onFabToggle = () => {
      if (!ARENA_BATCH_MODE) return;
      if (!listId) {
        const lid = getFirstListIdWithPending();
        if (lid && getArenaListById(lid)) {
          setListId(lid);
          setOpenBatchAfterLoad(true);
        }
        return;
      }
      const queued = loadPendingForList(listId);
      if (queued.length < 1) return;
      setBatchModalOpen((v) => !v);
    };
    window.addEventListener('arena-batch-fab-toggle', onFabToggle as EventListener);
    return () => window.removeEventListener('arena-batch-fab-toggle', onFabToggle as EventListener);
  }, [listId]);

  const initScoresForPool = useCallback(
    (items: RankItem[]) => {
      if (!listId) return {};
      const persisted = loadPersistedForList(listId);
      const next: Record<string, number> = {};
      for (const it of items) {
        next[it.id] = persisted?.[it.id] ?? SCORE_START;
      }
      return next;
    },
    [listId]
  );

  const refreshPool = useCallback(async () => {
    if (!listId) return;
    const entry = getArenaListById(listId);
    if (!entry) return;
    setLoading(true);
    setRound(null);
    if (ARENA_BATCH_MODE) {
      clearPendingForList(listId);
      setPendingRows([]);
    }
    try {
      const items = await loadArenaListPool(entry);
      setPool(items);
      setScores(initScoresForPool(items));
      setDuels(0);
      setStreak(0);
      if (items.length < 1) {
        toast.error('Not enough items in this list. Try another list.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not load Arena pool');
      setPool([]);
    } finally {
      setLoading(false);
    }
  }, [listId, initScoresForPool]);

  useEffect(() => {
    if (!listId) {
      setPool([]);
      setRound(null);
      setLoading(false);
      return;
    }
    void refreshPool();
    // refreshPool is listId-scoped via closure; we only re-run when listId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  useEffect(() => {
    if (!listId) return;
    if (loading || round) return;
    if (pool.length < 1) return;
    const items = pickYesNoGridItems(pool, ARENA_CARDS_PER_ROUND);
    if (items.length > 0) {
      setRound({ kind: 'yesno', items });
    }
  }, [pool, loading, round, listId]);

  /** Only items you’ve moved off the baseline — after reset, list is empty until you stance again. */
  const ranking = useMemo(() => {
    return [...pool]
      .map((it) => ({ it, r: scores[it.id] ?? SCORE_START }))
      .filter((x) => x.r !== SCORE_START)
      .sort((a, b) => b.r - a.r)
      .map((x, i) => ({ ...x, place: i + 1 }));
  }, [pool, scores]);

  const applyLocalYesNo = useCallback(
    (item: RankItem, support: boolean) => {
      const delta = support ? YESNO_SCORE_YES : YESNO_SCORE_NO;
      setScores((prev) => {
        const R = prev[item.id] ?? SCORE_START;
        const next = { ...prev, [item.id]: R + delta };
        if (listId) savePersistedForList(listId, next);
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

      setRound((prev) => {
        if (!prev) return prev;
        const newItems = refillLanesAfterAnswer(pool, prev.items, item);
        if (!newItems) return null;
        return { kind: 'yesno', items: newItems };
      });
    },
    [listId, pool]
  );

  const submitArenaBatch = useCallback(async () => {
    if (pendingRows.length === 0) return;
    if (!isConnected || !address) {
      toast.error('Connect your wallet to submit your batch.');
      return;
    }
    let baseWei: bigint;
    try {
      baseWei = parseEther((stakeTRUST || '0').trim() || '0');
    } catch {
      toast.error('Invalid stake amount');
      return;
    }
    for (const row of pendingRows) {
      const rowWei = baseWei * BigInt(row.units);
      if (rowWei < CURVE_OFFSET) {
        toast.error(
          `Intuition requires ≥ ${PROTOCOL_MIN_CLAIM_DEPOSIT_LABEL} TRUST per on-chain claim. ` +
            `Each row deposit is stake × units; one row totals ${formatEther(rowWei)} TRUST (${stakeTRUST}×${row.units}). ` +
            `Raise the stake preset or bump units until every line reaches at least ${PROTOCOL_MIN_CLAIM_DEPOSIT_LABEL}.`
        );
        return;
      }
    }
    setStakingTx(true);
    let sent = false;
    const totalWei = pendingRows.reduce((acc, row) => acc + baseWei * BigInt(row.units), 0n);
    try {
      const portalListObjectId =
        activeList?.source === 'portal' && TERM_ID_RE.test(activeList.listObjectTermId)
          ? activeList.listObjectTermId
          : null;
      const allSubjectsResolvable = pendingRows.every(
        (row) => TERM_ID_RE.test(row.item.id) || !!row.item.label?.trim()
      );
      if (!allSubjectsResolvable) {
        throw new Error('Some rows are missing valid term ids/labels for claim creation.');
      }

      if (portalListObjectId && pendingRows.every((row) => TERM_ID_RE.test(row.item.id))) {
        const triples = pendingRows.map((row) => {
          const subjectId = row.item.id;
          const predicateId = row.support ? LIST_PREDICATE_ID : portalListObjectId;
          const objectId = row.support ? portalListObjectId : DISTRUST_ATOM_ID;
          return {
            subjectId,
            predicateId,
            objectId,
            assetsWei: baseWei * BigInt(row.units),
          };
        });
        await createSemanticTriplesBatch(triples, address);
      } else {
        for (const row of pendingRows) {
          const rowTrust = formatEther(baseWei * BigInt(row.units));
          const subjectRef = TERM_ID_RE.test(row.item.id) ? row.item.id : (row.item.label || row.item.id);
          const listLabel = activeList?.title || 'Arena list';
          const predicateRef = row.support ? `belongs in ${listLabel}` : `does not belong in ${listLabel}`;
          const objectRef = listLabel;
          await createTripleFromLabels(subjectRef, predicateRef, objectRef, rowTrust, address);
        }
      }
      sent = true;
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Transaction failed';
      toast.error(msg);
    } finally {
      setStakingTx(false);
    }
    if (!sent) return;

    if (address) {
      toast.success(
        `Claims written on Intuition · ${pendingRows.length} item${pendingRows.length === 1 ? '' : 's'} · ${formatEther(totalWei)} TRUST`
      );
      void refreshPlayers({ silent: true });
      void refreshArenaXpSelf();
      try {
        window.dispatchEvent(new Event('inturank-arena-onchain-updated'));
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        void fetchArenaXpRecordForWallet(address).then((rec) => {
          setGraphArenaXp(rec.xp);
          postArenaTotalsMirrorOptional(address, rec);
        });
      }, 2800);
    } else {
      toast.success('Claims written on Intuition.');
    }

    if (listId) clearPendingForList(listId);
    setPendingRows([]);
    setBatchModalOpen(false);
  }, [pendingRows, isConnected, address, stakeTRUST, listId, refreshPlayers, refreshArenaXpSelf, activeList]);

  const updatePendingUnits = useCallback((key: string, units: number) => {
    setPendingRows((prev) => prev.map((r) => (r.key === key ? { ...r, units } : r)));
  }, []);

  const togglePendingSupport = useCallback(
    (key: string) => {
      setPendingRows((prev) => {
        const row = prev.find((r) => r.key === key);
        if (!row) return prev;
        const was = row.support;
        const flipDelta =
          (was ? -YESNO_SCORE_YES : -YESNO_SCORE_NO) + (!was ? YESNO_SCORE_YES : YESNO_SCORE_NO);
        setScores((p) => {
          const R = p[row.item.id] ?? SCORE_START;
          const next = { ...p, [row.item.id]: R + flipDelta };
          if (listId) savePersistedForList(listId, next);
          return next;
        });
        return prev.map((r) => (r.key === key ? { ...r, support: !r.support } : r));
      });
    },
    [listId]
  );

  const removePendingRow = useCallback(
    (key: string) => {
      setPendingRows((prev) => {
        const row = prev.find((r) => r.key === key);
        if (!row) return prev;
        const back = row.support ? -YESNO_SCORE_YES : -YESNO_SCORE_NO;
        setScores((p) => {
          const R = p[row.item.id] ?? SCORE_START;
          const next = { ...p, [row.item.id]: R + back };
          if (listId) savePersistedForList(listId, next);
          return next;
        });
        setDuels((d) => Math.max(0, d - 1));
        setStreak(0);
        return prev.filter((r) => r.key !== key);
      });
    },
    [listId]
  );

  const resolveYesNo = useCallback(
    async (item: RankItem, support: boolean) => {
      if (support) playSuccess();
      else playClick();

      if (!isConnected || !address) {
        toast.error('Connect your wallet to pick.');
        return;
      }

      if (ARENA_BATCH_MODE) {
        applyLocalYesNo(item, support);
        setPendingRows((prev) => [
          ...prev,
          {
            key: `q-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            item: rankItemToPendingSnapshot(item),
            support,
            units: 1,
          },
        ]);
        return;
      }

      let stakeOk = true;
      let wei = 0n;
      try {
        wei = parseEther((stakeTRUST || '0').trim() || '0');
      } catch {
        toast.error('Invalid stake amount');
        return;
      }

      if (!treasury) {
        toast.error('Set VITE_ARENA_TREASURY_ADDRESS so TRUST can be sent on each pick.');
        return;
      }

      setStakingTx(true);
      try {
        await sendNativeTransfer(address, treasury, wei);
        toast.success('TRUST sent with this stance.');
      } catch (e: any) {
        const msg = e?.shortMessage ?? e?.message ?? 'Transaction failed';
        toast.error(msg);
        stakeOk = false;
      } finally {
        setStakingTx(false);
      }

      if (!stakeOk) return;

      applyLocalYesNo(item, support);

      if (address) {
        toast.success(`Stance sent on-chain. Arena XP refreshes from the indexer after sync.`);
        void refreshArenaXpSelf();
        void refreshPlayers({ silent: true });
        try {
          window.dispatchEvent(new Event('inturank-arena-onchain-updated'));
        } catch {
          /* ignore */
        }
        window.setTimeout(() => {
          void fetchArenaXpRecordForWallet(address).then((rec) => {
            setGraphArenaXp(rec.xp);
            postArenaTotalsMirrorOptional(address, rec);
          });
        }, 2800);
      }
    },
    [stakeTRUST, isConnected, address, treasury, refreshPlayers, refreshArenaXpSelf, applyLocalYesNo]
  );

  const onYesNo = (item: RankItem, support: boolean) => {
    if (!round) return;
    void resolveYesNo(item, support);
  };

  const onSkip = () => {
    playClick();
    setStreak(0);
    const items = pickYesNoGridItems(pool, ARENA_CARDS_PER_ROUND);
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
    if (listId) savePersistedForList(listId, next);
    setDuels(0);
    setStreak(0);
    setRound(null);
    if (ARENA_BATCH_MODE && listId) {
      clearPendingForList(listId);
      setPendingRows([]);
    }
    toast.success('Session scores reset for this list');
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
        if (Number.isFinite(t)) return Math.max(ARENA_XP_PER_RANK_PICK, Math.round(t * 100));
      }
    } catch {
      /* ignore */
    }
    return ARENA_XP_PER_RANK_PICK;
  }, [stakeTRUST]);

  const streakTier = getStreakTier(streak);
  const minPoolNeeded = 1;
  const quickStartList = listsForCategory[0] ?? ARENA_LISTS[0];

  const startListRun = useCallback((id: string) => {
    setListId(id);
    try {
      sessionStorage.setItem('inturank-arena-last-list', id);
    } catch {
      /* ignore */
    }
  }, []);

  const onQuickStart = useCallback(() => {
    if (!quickStartList) return;
    playClick();
    startListRun(quickStartList.id);
  }, [quickStartList, startListRun]);

  return (
    <div className="relative isolate z-10 min-h-screen bg-[#03050d] w-full min-w-0 overflow-x-hidden pb-16 sm:pb-20 font-sans text-slate-300 selection:bg-[#00f3ff]/20 selection:text-white">
      <section className="relative z-10 border-b border-[#00f3ff]/10 overflow-hidden">
        <div
          className="h-1.5 w-full"
          style={{
            background: 'linear-gradient(90deg, #00f3ff 0%, #ff1e6d 45%, rgba(0,243,255,0.35) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            background:
              'radial-gradient(ellipse 100% 80% at 10% 0%, rgba(0,243,255,0.12) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 90% 20%, rgba(255,30,109,0.1) 0%, transparent 50%)',
          }}
        />
        <div className="w-full max-w-[min(1720px,calc(100vw-1.5rem))] sm:max-w-[min(1720px,calc(100vw-2rem))] mx-auto px-3 sm:px-6 lg:px-10 xl:px-12 pt-5 pb-4 md:pt-6 md:pb-5 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.45em] text-[#00f3ff]/90 mb-1.5">
                IntuRank · Climb
              </p>
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-black font-display tracking-tight bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(120deg, #ecfeff 0%, #00f3ff 35%, #fda4c6 60%, #ff1e6d 100%)',
                }}
              >
                THE ARENA
              </h1>
              <p className="text-sm text-slate-500 mt-2 max-w-lg leading-relaxed">
                {listId
                  ? 'Read each card · Yes / No · queue cuts when you are ready.'
                  : 'Pick a lane, pick a list, then rank with fast Yes/No decisions.'}
              </p>
            </div>
            {listId ? (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2">
                <span className="text-slate-500">Rounds <span className="text-white font-mono font-bold tabular-nums ml-1">{duels}</span></span>
                <span className="text-slate-700">•</span>
                <span className="text-slate-500">Streak <span className="text-fuchsia-300 font-mono font-bold tabular-nums ml-1">{streak}</span></span>
                {address ? <><span className="text-slate-700">•</span><span className="text-slate-500">XP <span className="text-amber-300 font-mono font-bold tabular-nums ml-1 arena-xp-roll">{xpRoll.toLocaleString()}</span></span></> : null}
                <div className="h-1 w-16 rounded-full bg-slate-800 overflow-hidden sm:ml-1">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500"
                    style={{ width: `${(progressToMilestone / 5) * 100}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="relative z-10 w-full max-w-[min(1720px,calc(100vw-1.5rem))] sm:max-w-[min(1720px,calc(100vw-2rem))] mx-auto px-3 sm:px-6 lg:px-10 xl:px-12 pb-10 pt-0">
        <motion.div
          className="rounded-[1.75rem] border border-white/[0.08] bg-[#05070d]/80 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,243,255,0.04)] overflow-x-hidden lg:overflow-visible"
          style={{
            background:
              'linear-gradient(160deg, rgba(10,20,32,0.92) 0%, rgba(5,8,15,0.88) 40%, rgba(20,6,18,0.5) 100%)',
            boxShadow:
              '0 28px 90px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 80px rgba(0,243,255,0.04)',
          }}
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
        <div
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,28vw)] xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px] gap-0 items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80"
        >
        <div className="min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 space-y-4">
          {!listId ? (
            <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-4 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div
                className="rounded-2xl border border-[#00f3ff]/20 px-4 py-3.5 sm:px-5 mb-5 backdrop-blur-md"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,243,255,0.1) 0%, rgba(8,10,20,0.9) 45%, rgba(255,30,109,0.06) 100%)',
                  boxShadow: '0 0 40px rgba(0,243,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#00f3ff] mb-2">Run · Pick a lane</p>
                <p className="text-base sm:text-lg text-slate-100 font-semibold leading-snug">
                  Does this entry belong on the list you are curating?
                </p>
              </div>
              <p className="text-xs text-slate-500 mb-4 max-w-2xl leading-relaxed">
                Go straight into ranking with Quick Start, or pick a lane below. Network lists are live from Intuition.
              </p>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px]">
                <span className="rounded-full border border-[#00f3ff]/30 bg-[#00f3ff]/10 px-3 py-1 text-[#9ef9ff] font-semibold">1. Choose lane</span>
                <ChevronRight size={12} className="text-slate-600" />
                <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200 font-semibold">2. Open list</span>
                <ChevronRight size={12} className="text-slate-600" />
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200 font-semibold">3. Vote yes/no</span>
              </div>
              <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/90 font-black">Quick start</p>
                  <p className="text-xs text-slate-300 mt-1">
                    Recommended now: <span className="text-white font-semibold">{quickStartList?.title ?? '—'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onQuickStart}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-[11px] font-black text-cyan-100 hover:bg-cyan-500/25 transition-colors"
                >
                  Start Ranking
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:thin]">
                {ARENA_CATEGORY_PILLS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setArenaCategoryId(c.id);
                    }}
                    onMouseEnter={playHover}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all border ${
                      arenaCategoryId === c.id
                        ? 'text-white border-[#00f3ff]/55 shadow-[0_0_20px_rgba(0,243,255,0.2)]'
                        : 'bg-slate-950/60 text-slate-500 border-slate-700/80 hover:border-[#00f3ff]/25 hover:text-slate-300'
                    }`}
                    style={
                      arenaCategoryId === c.id
                        ? {
                            background: 'linear-gradient(135deg, rgba(0,243,255,0.2), rgba(255,30,109,0.12))',
                          }
                        : undefined
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-2 mb-1 font-mono tabular-nums">
                {listsForCategory.length} list{listsForCategory.length === 1 ? '' : 's'} in this lane
              </p>
              {favoriteListsInLane.length > 0 ? (
                <div
                  className="mb-5 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.06] to-[#050a12]/80 p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-amber-300 fill-amber-400/35" strokeWidth={2} />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200/95">Starred in this lane</p>
                    <span className="text-[10px] text-slate-500 font-mono tabular-nums ml-auto">{favoriteListsInLane.length}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {favoriteListsInLane.map((L) => (
                      <ArenaListCard
                        key={`fav-${L.id}`}
                        title={L.title}
                        description={L.description}
                        tag={L.tag}
                        categoryLabel={
                          ARENA_CATEGORY_PILLS.find((p) => p.id === L.arenaCategory)?.label ?? L.tag
                        }
                        listGlyph={L.listGlyph}
                        constituentCount={getArenaListConstituents(L)}
                        previewItems={getArenaPreviewItems(L, [])}
                        reduceMotion={reduceMotion}
                        isFavorite
                        onFavoriteToggle={() => toggleListFavorite(L.id)}
                        onSelect={() => {
                          startListRun(L.id);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-4">
                {groupedArenaLists.map((group) => {
                  const visible = showAllLists ? group.lists : group.lists.slice(0, 4);
                  return (
                    <div key={group.id}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{group.label}</p>
                        <span className="text-[10px] text-slate-600">{group.lists.length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {visible.map((L) => (
                          <ArenaListCard
                            key={L.id}
                            title={L.title}
                            description={L.description}
                            tag={L.tag}
                            categoryLabel={
                              ARENA_CATEGORY_PILLS.find((p) => p.id === L.arenaCategory)?.label ?? L.tag
                            }
                            listGlyph={L.listGlyph}
                            constituentCount={getArenaListConstituents(L)}
                            previewItems={getArenaPreviewItems(L, [])}
                            reduceMotion={reduceMotion}
                            isFavorite={favoriteSet.has(L.id)}
                            onFavoriteToggle={() => toggleListFavorite(L.id)}
                            onSelect={() => {
                              startListRun(L.id);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {arenaCategoryId === 'all' && listsForCategory.length > 8 && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setShowAllLists((v) => !v);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-cyan-500/35 hover:text-cyan-100 transition-colors"
                  >
                    {showAllLists ? 'Show fewer lists' : 'Show more lists'}
                    <ChevronRight size={13} className={showAllLists ? 'rotate-90' : ''} />
                  </button>
                </div>
              )}
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-white/[0.06]">
                <p className="text-[11px] text-slate-500 max-w-md">
                  Want deeper context before ranking? Open Markets for vaults, depth, and history.
                </p>
                <Link
                  to="/markets"
                  onClick={() => playClick()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00f3ff]/35 bg-[#00f3ff]/10 px-4 py-2.5 text-[11px] font-bold text-[#a5fcff] hover:bg-[#00f3ff]/20 transition-colors shrink-0"
                >
                  Open Markets
                  <ChevronRight size={14} className="opacity-90" />
                </Link>
              </div>
            </div>
          ) : (
            <>
          <div
            className="rounded-3xl border border-white/[0.08] p-4 sm:p-5 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(145deg, rgba(0,243,255,0.07) 0%, rgba(8,10,18,0.92) 38%, rgba(255,30,109,0.05) 100%)',
              boxShadow: '0 0 60px rgba(0,243,255,0.05), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          >
            <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-5 lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 lg:min-h-[52px]">
                <span className="rounded-full border border-[#00f3ff]/25 bg-[#00f3ff]/8 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.28em] text-[#9ef9ff]">
                  Current run
                </span>
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500">
                  <span>Prompt</span>
                  <ChevronRight size={11} className="text-slate-600 shrink-0" />
                  <span>Vote</span>
                  <ChevronRight size={11} className="text-slate-600 shrink-0" />
                  <span>Cuts</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 lg:max-w-[min(760px,100%)] lg:ml-auto w-full lg:w-auto lg:justify-end flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setListId(null);
                    setRound(null);
                    try {
                      sessionStorage.removeItem('inturank-arena-last-list');
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="group inline-flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] pl-2 pr-3 py-2.5 text-left hover:border-[#00f3ff]/35 hover:bg-[#00f3ff]/10 transition-all shrink-0 sm:self-start"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#00f3ff]/20 to-[#ff1e6d]/20 border border-white/10 text-[#a5fcff] group-hover:scale-105 transition-transform">
                    <ArrowLeft size={16} strokeWidth={2.5} />
                  </span>
                  <span>
                    <span className="block text-[9px] font-mono uppercase tracking-widest text-slate-500">Back</span>
                    <span className="text-xs font-bold text-slate-100 group-hover:text-white">Browse lists</span>
                  </span>
                </button>
                <ArenaListQuickPick
                  activeListId={listId ?? ''}
                  favorites={quickPickFavoriteRows}
                  others={quickPickOtherRows}
                  onSelectList={startListRun}
                  className="flex-1 min-w-[200px]"
                />
              </div>
            </div>

            {activeList ? (
              <>
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 gap-y-3">
                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight truncate min-w-0">
                    {activeList.title}
                  </h2>
                  {stanceSummary.total > 0 ? (
                    <p className="text-[11px] text-slate-500 shrink-0 tabular-nums sm:text-right">
                      {stanceSummary.total} indexed ·{' '}
                      <span className="text-[#4ade80] font-semibold">yes {stanceSummary.yes}</span>
                      {' · '}
                      <span className="text-[#ff8bb0] font-semibold">no {stanceSummary.no}</span>
                    </p>
                  ) : null}
                </div>
                {activeList.description ? (
                  <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1 leading-snug">{activeList.description}</p>
                ) : null}
              </>
            ) : null}

            {listId && round?.kind === 'yesno' && round.items?.length ? (
              <div
                className="mt-4 rounded-xl border border-[#00f3ff]/14 bg-black/30 px-3 py-2.5"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
              >
                {round.items.length === 1 && round.items[0] && activeList ? (
                  <p className="text-sm font-medium text-slate-100 leading-snug">{buildArenaItemQuestion(activeList, round.items[0])}</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
                    <span className="shrink-0 rounded-lg border border-[#00f3ff]/30 bg-[#00f3ff]/12 px-2 py-1 text-[10px] font-mono font-black uppercase tracking-wider text-[#89faff] tabular-nums">
                      {round.items.length}-lane vote
                    </span>
                    <p className="text-[11px] text-slate-400 leading-snug min-w-0">
                      Each card has its prompt — tap Yes / No per lane.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {ARENA_BATCH_MODE && pendingRows.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setBatchModalOpen(true);
                }}
                className="mt-3 w-full text-center text-[11px] font-bold text-[#a5fcff] border border-[#00f3ff]/35 rounded-xl py-2.5 bg-[#00f3ff]/5 hover:bg-[#00f3ff]/10 transition-colors"
              >
                Review batch ({pendingRows.length} queued) — TRUST on submit
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="rounded-xl border border-cyan-500/15 bg-slate-900/25 py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-slate-500">Loading pool...</div>
            </div>
          ) : pool.length < minPoolNeeded ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-16 text-center text-sm text-slate-500">
              Not enough items. Try another list.
            </div>
          ) : !round ? (
            <div className="rounded-xl border border-slate-700/60 py-16 text-center bg-slate-900/15">
              <Loader2 className="w-9 h-9 text-cyan-400 animate-spin mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Next item…</p>
            </div>
          ) : (
            <motion.div className="space-y-5 w-full mx-auto lg:mx-0" initial={false}>
              <div
                className="rounded-2xl w-full p-[3px]"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,243,255,0.3) 0%, rgba(255,30,109,0.16) 50%, rgba(0,243,255,0.12) 100%)',
                  boxShadow: '0 20px 56px rgba(0,0,0,0.5), 0 0 40px rgba(0,243,255,0.05)',
                }}
              >
                <div className="rounded-[0.95rem] border border-white/[0.07] bg-[#05080f]/95 p-3 sm:p-5 backdrop-blur-2xl ring-1 ring-white/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shadow-[0_0_12px_rgba(0,243,255,0.9)]"
                        style={{ background: '#00f3ff' }}
                      />
                      <span className="text-slate-400">Round {duels + 1}</span>
                      {streakTier.label ? (
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-sans font-black normal-case text-white ${streakTier.className}`}>
                          <Flame size={10} />
                          {streakTier.label} ×{streak}
                        </span>
                      ) : null}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[#ffd89a]">
                      <Zap size={12} className="text-[#fbbf24]" />
                      +{xpPickPreview} XP
                      {round.items.length > 1 ? (
                        <span className="ml-1.5 rounded-md bg-white/[0.06] px-2 py-0.5 font-sans tabular-nums normal-case tracking-normal text-[9px] text-slate-400">
                          {round.items.length} up
                        </span>
                      ) : null}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 w-full items-stretch">
                    <div className="contents">
                      <AnimatePresence initial={false} mode="popLayout">
                        {round.items.map((item, slotIdx) => (
                          <ArenaLaneCard
                            key={item.id}
                            item={item}
                            activeList={activeList ?? undefined}
                            stakingTx={stakingTx}
                            reduceMotion={reduceMotion}
                            emphasized={round.items.length >= 3 ? slotIdx === 1 : round.items.length === 1}
                            onYesNo={(support) => onYesNo(item, support)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-2">
                    <p className="text-[9px] text-slate-500 text-center">Local session only — not on-chain odds.</p>
                    <motion.button
                      type="button"
                      onClick={onSkip}
                      disabled={stakingTx}
                      whileHover={reduceMotion || stakingTx ? undefined : { scale: 1.02 }}
                      whileTap={reduceMotion || stakingTx ? undefined : { scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-200 hover:border-[#00f3ff]/25 transition-colors"
                    >
                      <SkipForward size={14} />
                      Skip
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start flex flex-col gap-3 min-w-0 w-full p-3 sm:p-4 md:p-5 lg:p-5 bg-[#03080e]/60">
          <ArenaLeaderboardGlance
            players={players}
            loading={playersLoading}
            myAddress={address}
            myXp={graphArenaXp}
          />
          {listId ? (
            <motion.div
              className="relative rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-[#070a14]/95 via-[#050914]/98 to-[#120618]/95 p-3 sm:p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.45),0_0_32px_rgba(255,30,109,0.06),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00f3ff]/35 to-transparent pointer-events-none" aria-hidden />
              <p className="text-[9px] font-black uppercase tracking-[0.34em] text-cyan-300/95 mb-2">Arena controls</p>
              <p className="text-[10px] text-slate-500 leading-relaxed mb-2.5 line-clamp-3">
                {ARENA_BATCH_MODE ? (
                  <>
                    TRUST preset for cuts. Claims need ≥{' '}
                    <span className="text-amber-200/90 tabular-nums">{PROTOCOL_MIN_CLAIM_DEPOSIT_LABEL}</span> TRUST.
                  </>
                ) : (
                  <>Tip intensity preset while you rank.</>
                )}
              </p>

              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setStakePresetIdx(Math.max(0, stakePresetIdx - 1))}
                  disabled={stakePresetIdx <= 0}
                  className="h-11 w-10 shrink-0 rounded-xl border border-slate-600/85 bg-slate-900/65 text-lg font-black text-slate-200 hover:border-[#00f3ff]/30 disabled:opacity-35 disabled:pointer-events-none"
                  aria-label="Lower trust tier"
                >
                  −
                </button>
                <div className="flex-1 min-w-0 rounded-xl border border-fuchsia-500/30 bg-black/55 px-2.5 py-1 text-center backdrop-blur-sm">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-fuchsia-300/95 font-black truncate">{ARENA_STAKE_TITLES[stakePresetIdx]}</div>
                  <div className="text-lg font-black tabular-nums text-white leading-tight mt-0.5 truncate">
                    {ARENA_STAKE_PRESETS[stakePresetIdx]}{' '}
                    <span className="text-cyan-200/95 text-[11px] font-bold">TRUST</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStakePresetIdx(Math.min(ARENA_STAKE_PRESETS.length - 1, stakePresetIdx + 1))}
                  disabled={stakePresetIdx >= ARENA_STAKE_PRESETS.length - 1}
                  className="h-11 w-10 shrink-0 rounded-xl border border-cyan-500/40 bg-cyan-500/12 text-lg font-black text-cyan-100 hover:bg-cyan-500/18 disabled:opacity-35 disabled:pointer-events-none"
                  aria-label="Increase trust tier"
                >
                  +
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <motion.button
                  type="button"
                  onClick={() => {
                    playClick();
                    void refreshPool();
                  }}
                  disabled={loading}
                  whileHover={reduceMotion || loading ? undefined : { scale: 1.02 }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 py-2 text-[9px] font-black uppercase tracking-widest text-cyan-100 disabled:opacity-50"
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                  New pool
                </motion.button>
                <motion.button
                  type="button"
                  onClick={resetSession}
                  disabled={!pool.length}
                  whileHover={reduceMotion || !pool.length ? undefined : { scale: 1.02 }}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-600/85 bg-slate-900/60 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white disabled:opacity-40"
                >
                  Reset
                </motion.button>
              </div>

              {batchDepositBelowProtocol ? (
                <p className="mt-2.5 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-2 py-1.5 text-[9px] text-amber-200/95 leading-snug">
                  Some queued cuts are below the vault minimum — raise preset or bump units before submit.
                </p>
              ) : null}
              {!isConnected ? (
                <div className="mt-2.5 pt-2.5 border-t border-white/[0.06]">
                  <span className="text-[9px] text-amber-400/95 flex items-center gap-1 leading-snug">
                    <Wallet size={11} className="shrink-0" />
                    Connect to submit cuts on-chain
                  </span>
                </div>
              ) : null}
              <Link
                to="/portfolio#arena-rankings"
                onClick={() => playClick()}
                className="mt-2.5 flex items-center justify-center gap-1 rounded-xl border border-[#00f3ff]/20 bg-[#00f3ff]/6 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9ef9ff] hover:border-[#00f3ff]/40 hover:bg-[#00f3ff]/10 transition-colors"
              >
                My ranked lists
                <ChevronRight className="w-3 h-3 shrink-0 opacity-80" aria-hidden />
              </Link>
            </motion.div>
          ) : null}
        </aside>
        </div>
        </motion.div>

        {/* Bottom "Arena champions" leaderboard kept for reference but gated off — replaced by the side-by-side ArenaRankerLeaderboard. */}
        {false && (
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
                    Arena points (play + optional TRUST per pick). Not a truth score.
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
                className="mb-6 rounded-3xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500/[0.08] via-slate-900/80 to-fuchsia-600/[0.06] px-4 py-3.5 text-center sm:text-left shadow-[0_0_28px_rgba(34,211,238,0.1)] transition-shadow duration-300 hover:shadow-[0_0_36px_rgba(34,211,238,0.16)]"
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              >
                <p className="text-sm text-slate-200 font-semibold">
                  <span className="text-cyan-300 font-black tabular-nums">#{myLadderPosition.place}</span>
                  <span className="text-slate-500 font-normal mx-1">of</span>
                  <span className="text-white font-black tabular-nums">{myLadderPosition.total}</span>
                  <span className="text-slate-400 font-normal ml-2">Keep ranking to move up.</span>
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
                  Connect, pick, and stake TRUST to show up here.
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
                            className={`w-full rounded-t-3xl bg-gradient-to-b ${ring} p-[3px] shadow-xl ${idx === 0 ? 'shadow-[0_0_40px_rgba(251,191,36,0.25)]' : 'shadow-black/50'}`}
                          >
                            <div
                              className={`rounded-t-[1.15rem] bg-gradient-to-b from-[#0c1520] to-[#060a10] ${h} flex flex-col items-center justify-end pb-2.5 px-2 border-b border-white/10`}
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
                        <motion.li
                          key={p.address}
                          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.35,
                            delay: reduceMotion ? 0 : Math.min(rowIdx, 20) * 0.03,
                            ease: [0.16, 1, 0.3, 1],
                          }}
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
                            className={`group relative flex min-w-0 flex-1 flex-col rounded-2xl sm:rounded-3xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-[13px] transition-all duration-300 ease-out hover:-translate-y-0.5 ${
                              isYou
                                ? 'bg-gradient-to-br from-cyan-500/[0.12] via-slate-950/95 to-slate-950 border border-cyan-400/50 shadow-[0_0_28px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_0_40px_rgba(34,211,238,0.22)]'
                                : top
                                  ? 'bg-gradient-to-br from-amber-500/[0.08] via-[#0b1018]/98 to-slate-950/98 border border-amber-400/35 hover:border-amber-300/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:shadow-[0_12px_36px_rgba(245,158,11,0.08)]'
                                  : 'border border-slate-700/65 bg-slate-950/95 hover:border-slate-500/55 hover:bg-slate-900/95 hover:shadow-[0_10px_32px_rgba(0,0,0,0.45)]'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="relative h-10 w-10 shrink-0 rounded-2xl overflow-hidden ring-1 ring-white/15 bg-gradient-to-br from-slate-800 to-slate-950 shadow-inner">
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
                            <div className="mt-2.5 h-2.5 rounded-full bg-slate-900/95 overflow-hidden ring-1 ring-slate-700/70 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)]">
                              <motion.div
                                className={`h-full rounded-full ${
                                  isYou
                                    ? 'bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-fuchsia-600'
                                    : 'bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400'
                                }`}
                                initial={false}
                                animate={{ width: `${xpPct}%` }}
                                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                              />
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ol>
                </div>
              </>
            )}
          </div>
        </motion.section>
        )}
      </div>

      {ARENA_BATCH_MODE && listId && (
        <ArenaBatchReviewModal
          open={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          themeShort={activeList?.title ?? 'Arena'}
          contextSuffix={activeList?.tag ?? 'list'}
          stakeLabel={stakeTRUST}
          rows={pendingRows}
          onUpdateUnits={updatePendingUnits}
          onToggleSupport={togglePendingSupport}
          onRemove={removePendingRow}
          onSubmit={() => void submitArenaBatch()}
          submitting={stakingTx}
          depositBlocked={batchDepositBelowProtocol}
          minDepositLabel={ARENA_BATCH_MODE ? PROTOCOL_MIN_CLAIM_DEPOSIT_LABEL : undefined}
        />
      )}

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
