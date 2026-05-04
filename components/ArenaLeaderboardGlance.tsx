/**
 * Compact Arena leaderboard glance — top 3 + your rank + CTA to full board.
 *
 * Designed to live in the Arena sidebar without competing for attention with
 * the ranking flow. Links out to the full leaderboard at /stats?tab=rankers.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Trophy, Crown, ArrowUpRight, Award, Sparkles, Loader2 } from 'lucide-react';
import type { ArenaPlayerRow } from '../services/arenaLeaderboard';
import { playClick, playHover } from '../services/audio';
import { ARENA_THEME } from '../services/arenaUiTheme';

const CY = ARENA_THEME.cyan;
const MG = ARENA_THEME.violetDeep;
const GOLD = ARENA_THEME.gold;
const SILVER = '#cbd5e1';
const BRONZE = '#fb923c';

type Props = {
  players: ArenaPlayerRow[];
  loading: boolean;
  myAddress?: string;
  /** Indexed Arena XP (graph / leaderboard mirror). */
  myArenaXp: number;
  /** Protocol activity XP ledger on this browser only. */
  myActivityXp: number;
};

function avatarGlyph(label: string): string {
  const t = (label || '').trim();
  const m = /[a-zA-Z0-9]/.exec(t);
  return m ? m[0].toUpperCase() : '?';
}

const ArenaLeaderboardGlance: React.FC<Props> = ({ players, loading, myAddress, myArenaXp, myActivityXp }) => {
  const reduceMotion = useReducedMotion();
  const myAddrLc = myAddress?.toLowerCase();
  const myRow = useMemo(
    () => (myAddrLc ? players.find((p) => p.address === myAddrLc) ?? null : null),
    [players, myAddrLc],
  );
  const top3 = players.slice(0, 3);

  return (
    <Link
      to="/stats?tab=rankers"
      onClick={playClick}
      onMouseEnter={playHover}
      className="group block rounded-3xl border border-white/[0.08] overflow-hidden transition-all duration-300 hover:border-[#00f3ff]/40 hover:-translate-y-0.5"
      style={{
        background:
          'linear-gradient(165deg, rgba(10,10,12,0.97) 0%, rgba(5,6,8,0.99) 52%, rgba(16,12,24,0.92) 100%)',
        boxShadow:
          '0 0 0 1px rgba(56,232,255,0.06), 0 16px 44px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 40px rgba(232,197,71,0.04)',
      }}
    >
      {/* Header */}
      <div className="relative px-3.5 pt-3 pb-2.5 border-b border-white/[0.06]">
        <div
          className="absolute inset-0 opacity-[0.4] pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${ARENA_THEME.gold}12 0%, transparent 50%, ${MG}10 100%)`,
          }}
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border"
              style={{ borderColor: `${CY}55`, background: `linear-gradient(135deg, ${CY}22, ${ARENA_THEME.gold}18)` }}
            >
              <Trophy size={14} style={{ color: CY }} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-[0.28em] text-[#00f3ff]/90 font-bold leading-none">
                IntuRank · Rankers
              </p>
              <p className="text-[11px] font-bold text-white leading-tight mt-0.5">Live leaderboard</p>
            </div>
          </div>
          <ArrowUpRight
            size={15}
            className="text-slate-500 group-hover:text-cyan-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all shrink-0"
          />
        </div>
      </div>

      {/* Top 3 horizontal strip */}
      <div className="px-3.5 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 size={14} className="text-cyan-400 animate-spin" />
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Loading</span>
          </div>
        ) : top3.length === 0 ? (
          <div className="text-center py-4 px-2">
            <Sparkles size={18} style={{ color: CY }} className="mx-auto mb-1.5" />
            <p className="text-[11px] font-bold text-white">Be the first ranker</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
              Vote on a list to enter the board.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[1, 0, 2].map((idx, slotI) => {
              const p = top3[idx];
              if (!p) return <div key={idx} aria-hidden />;
              const isFirst = idx === 0;
              const slotColor = idx === 0 ? GOLD : idx === 1 ? SILVER : BRONZE;
              const isYou = myAddrLc && p.address === myAddrLc;

              return (
                <motion.div
                  key={p.address}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: slotI * 0.05 }}
                  className={`flex flex-col items-center min-w-0 ${isFirst ? '-mt-1' : 'mt-1.5'}`}
                >
                  <div className="relative mb-1">
                    {isFirst && (
                      <Crown
                        size={11}
                        className="absolute -top-3 left-1/2 -translate-x-1/2"
                        style={{ color: GOLD, filter: `drop-shadow(0 0 6px ${GOLD}80)` }}
                      />
                    )}
                    <div
                      className="rounded-full p-[2px]"
                      style={{
                        background: `linear-gradient(135deg, ${slotColor}, ${slotColor}88)`,
                        boxShadow: `0 0 12px ${slotColor}45`,
                      }}
                    >
                      <div className={`${isFirst ? 'w-10 h-10' : 'w-8 h-8'} rounded-full overflow-hidden bg-[#040810]`}>
                        {p.image ? (
                          <img src={p.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-black text-cyan-200/90">
                            {avatarGlyph(p.label)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                      style={{
                        background: slotColor,
                        color: '#020308',
                        boxShadow: `0 0 0 1.5px #020308`,
                      }}
                    >
                      {idx + 1}
                    </div>
                  </div>
                  <p
                    className="text-[10px] font-bold truncate w-full text-center"
                    style={{ color: isYou ? CY : '#e2e8f0' }}
                    title={p.label}
                  >
                    {p.label}
                  </p>
                  <span
                    className="text-[10px] font-black tabular-nums leading-none mt-0.5"
                    style={{ color: slotColor, textShadow: `0 0 8px ${slotColor}50` }}
                  >
                    {p.arenaXp.toLocaleString()}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* You row */}
      {myAddrLc && (
        <div className="px-3.5 pb-3">
          <div
            className="rounded-xl border px-3 py-2 flex items-center justify-between gap-2"
            style={{
              borderColor: myRow ? `${CY}40` : 'rgba(148,163,184,0.20)',
              background: myRow
                ? `linear-gradient(135deg, ${CY}10, rgba(8,12,22,0.95))`
                : 'rgba(255,255,255,0.02)',
              boxShadow: myRow ? `0 0 16px ${CY}14` : 'none',
            }}
          >
            <div className="min-w-0">
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] font-bold text-cyan-300/90">
                You
              </p>
              {myRow ? (
                <p className="text-[12px] font-bold text-white leading-tight mt-0.5">
                  Rank{' '}
                  <span
                    className="text-base font-black tabular-nums ml-0.5"
                    style={{ color: CY, textShadow: `0 0 10px ${CY}40` }}
                  >
                    #{myRow.rank}
                  </span>
                  <span className="text-slate-500 font-normal text-[10px]"> · {players.length}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                  {myArenaXp > 0 ? 'Not on board yet' : 'Vote to enter'}
                </p>
              )}
            </div>
            <div className="text-right shrink-0 space-y-1.5 tabular-nums">
              <div title="Arena XP from indexer (leaderboard pool)">
                <p className="text-[8px] font-mono uppercase tracking-wider text-cyan-300/85 font-bold leading-none">Arena</p>
                <p
                  className="text-base font-black leading-none mt-0.5"
                  style={{ color: GOLD, textShadow: `0 0 8px ${GOLD}40` }}
                >
                  {myArenaXp.toLocaleString()}
                </p>
              </div>
              <div title="Activity XP on this device only (markets, creates, sends — not the leaderboard total)">
                <p className="text-[8px] font-mono uppercase tracking-wider text-slate-500 font-bold leading-none">Activity</p>
                <p className="text-sm font-black text-slate-400 leading-none mt-0.5">{myActivityXp.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <div
        className="px-3.5 py-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2"
        style={{ background: `linear-gradient(90deg, ${ARENA_THEME.gold}08, ${CY}06)` }}
      >
        <span className="text-[10px] font-bold text-cyan-200 inline-flex items-center gap-1.5">
          <Award size={11} />
          Full board · stats · streaks
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300 group-hover:text-white transition-colors inline-flex items-center gap-1">
          Open
          <ArrowUpRight size={11} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
};

export default ArenaLeaderboardGlance;
