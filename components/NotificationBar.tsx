import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, TrendingDown, TrendingUp, ExternalLink, Loader2, Mail, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatEther } from 'viem';
import { getActivityOnMyMarkets, getActivityBySenderIds, getUserPositions, getCurveLabel, type PositionActivityNotification } from '../services/graphql';
import { formatMarketValue, formatDisplayedShares } from '../services/analytics';
import { requestEmailNotification, requestFollowedActivityEmail } from '../services/emailNotifications';
import { getFollowedIdentities } from '../services/follows';
import { useEmailNotify } from '../contexts/EmailNotifyContext';
import { EXPLORER_URL } from '../constants';
import { CurrencySymbol } from './CurrencySymbol';
import { playClick, playHover } from '../services/audio';

const REFRESH_INTERVAL_MS = 60_000;
const READ_STORAGE_KEY_PREFIX = 'inturank_notification_read_';
const MAX_READ_IDS = 2000;

function normalizeWallet(addr: string): string {
  return (addr || '').toLowerCase();
}

function loadReadIds(walletAddress: string): Set<string> {
  try {
    const key = READ_STORAGE_KEY_PREFIX + normalizeWallet(walletAddress);
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.slice(-MAX_READ_IDS)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(walletAddress: string, ids: Set<string>): void {
  try {
    const key = READ_STORAGE_KEY_PREFIX + normalizeWallet(walletAddress);
    const arr = Array.from(ids).slice(-MAX_READ_IDS);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (_) {}
}

type FilterType = 'all' | 'acquired' | 'liquidated';

function formatTimeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return m === 1 ? '1m ago' : `${m}m ago`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (m === 0) return h === 1 ? '1h ago' : `${h}h ago`;
    return `${h}h ${m}m ago`;
  }
  const d = Math.floor(s / 86400);
  return d === 1 ? '1d ago' : `${d}d ago`;
}

function getTimeGroup(ts: number): 'today' | 'yesterday' | 'week' | 'older' {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  if (ts >= startOfToday.getTime()) return 'today';
  if (ts >= startOfYesterday.getTime()) return 'yesterday';
  if (ts >= startOfWeek.getTime()) return 'week';
  return 'older';
}

const TIME_GROUP_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  older: 'Older',
};

interface NotificationBarProps {
  walletAddress: string | null;
}

const NotificationBar: React.FC<NotificationBarProps> = ({ walletAddress }) => {
  const { openEmailNotify } = useEmailNotify();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PositionActivityNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [readIds, setReadIds] = useState<Set<string>>(() => (walletAddress ? loadReadIds(walletAddress) : new Set()));
  const ref = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDoneRef = useRef(false);

  useEffect(() => {
    if (!walletAddress) {
      setItems([]);
      setReadIds(new Set());
      initialFetchDoneRef.current = false;
      seenIdsRef.current.clear();
      return;
    }
    setReadIds(loadReadIds(walletAddress));
    const fetch = async () => {
      setLoading(true);
      try {
        const positions = await getUserPositions(walletAddress);
        const vaultIds = (positions || [])
          .map((p: any) => p.vault?.term_id)
          .filter(Boolean);
        const list = await getActivityOnMyMarkets(walletAddress, vaultIds, 40);
        if (!initialFetchDoneRef.current) {
          initialFetchDoneRef.current = true;
          list.forEach((n) => seenIdsRef.current.add(n.id));
        } else {
          list.forEach((n) => {
            if (!seenIdsRef.current.has(n.id)) {
              seenIdsRef.current.add(n.id);
              requestEmailNotification(walletAddress, n).catch(() => {});
            }
          });
        }
        setItems(list);

        // Followed identities: fetch their buy/activity and send email if they have emailAlerts on
        const follows = getFollowedIdentities(walletAddress).filter((f) => f.emailAlerts);
        if (follows.length > 0) {
          const senderIds = follows.map((f) => f.identityId);
          const followActivity = await getActivityBySenderIds(senderIds, 30);
          const bySender = new Map(follows.map((f) => [f.identityId.toLowerCase(), f]));
          followActivity.forEach((n) => {
            const follow = bySender.get((n.senderId || '').toLowerCase());
            if (follow) {
              const label = follow.label || n.senderLabel || `${n.senderId?.slice(0, 6)}...`;
              requestFollowedActivityEmail(walletAddress, label, n).catch(() => {});
            }
          });
        }
      } catch (_) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    const t = setInterval(fetch, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [walletAddress]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const byType = filter === 'all' ? items : items.filter((n) => n.type === filter);
    return byType.filter((n) => !readIds.has(n.id));
  }, [items, filter, readIds]);

  const grouped = useMemo(() => {
    const groups: Record<string, PositionActivityNotification[]> = { today: [], yesterday: [], week: [], older: [] };
    filtered.forEach((n) => {
      const g = getTimeGroup(n.timestamp);
      groups[g].push(n);
    });
    return groups;
  }, [filtered]);

  const unreadCount = useMemo(() => items.filter((n) => !readIds.has(n.id)).length, [items, readIds]);

  const markAllRead = () => {
    if (!walletAddress) return;
    playClick();
    const next = new Set(readIds);
    items.forEach((n) => next.add(n.id));
    setReadIds(next);
    saveReadIds(walletAddress, next);
  };

  if (!walletAddress) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { playClick(); setOpen((o) => !o); }}
        onMouseEnter={playHover}
        className={`flex items-center justify-center min-w-[44px] min-h-[44px] w-10 h-10 border-2 clip-path-slant transition-all ${
          open
            ? 'border-intuition-primary bg-intuition-primary/10 text-intuition-primary'
            : 'border-slate-800 text-slate-400 hover:border-intuition-primary/50 hover:text-intuition-primary'
        }`}
        aria-label="Activity on your claims"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-black bg-intuition-secondary text-white rounded-none clip-path-slant">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[400px] max-w-[calc(100vw-2rem)] max-h-[75vh] overflow-hidden bg-black border-2 border-intuition-primary/30 shadow-[0_0_50px_rgba(0,0,0,1)] z-[60] clip-path-slant animate-notification-panel-in">
          <div className="p-3 border-b border-white/10 bg-white/[0.02]">
            <h3 className="text-[12px] font-black font-mono text-white uppercase tracking-widest">
              Activity on your claims
            </h3>
            <p className="text-[10px] font-bold font-mono text-slate-300 mt-1">
              Others buying or selling in claims you hold
            </p>
            {items.length > 0 && (
              <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
              <div className="flex gap-1.5">
                {(['all', 'acquired', 'liquidated'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { playClick(); setFilter(f); }}
                    onMouseEnter={playHover}
                    className={`min-h-[44px] px-3 py-2.5 text-[9px] font-black font-mono uppercase tracking-widest border-2 clip-path-slant transition-all duration-200 ${
                      filter === f
                        ? 'border-intuition-primary bg-intuition-primary/25 text-white'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'acquired' ? 'Acquired' : 'Liquidated'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={markAllRead}
                onMouseEnter={playHover}
                className="flex items-center gap-1.5 px-2.5 py-2 text-[9px] font-black font-mono text-slate-400 hover:text-intuition-primary uppercase tracking-widest border border-slate-700 hover:border-intuition-primary/50 transition-all"
              >
                <CheckCheck size={12} /> Clear all
              </button>
              </div>
            )}
          </div>
          <div className="overflow-y-auto max-h-[calc(75vh-140px)] p-1 scroll-smooth" style={{ scrollBehavior: 'smooth' }}>
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 px-4 text-center text-[11px] font-bold font-mono text-slate-400 uppercase tracking-widest">
                {items.length === 0
                  ? 'No recent activity in claims you hold. When others buy or sell in a claim you hold, it will appear here.'
                  : items.every((n) => readIds.has(n.id))
                    ? 'Cleared. New activity will show here.'
                    : `No ${filter === 'all' ? '' : filter + ' '}activity in this period.`}
              </div>
            ) : (
              <ul className="space-y-4">
                {(() => {
                  let globalItemIndex = 0;
                  return (['today', 'yesterday', 'week', 'older'] as const).map((groupKey) => {
                    const list = grouped[groupKey];
                    if (!list.length) return null;
                    return (
                      <li key={groupKey}>
                        <div className="text-[9px] font-black font-mono text-slate-400 uppercase tracking-widest px-2 py-1.5 sticky top-0 bg-black/98 backdrop-blur-sm z-10 border-b border-white/5">
                          {TIME_GROUP_LABELS[groupKey]}
                        </div>
                        <ul className="space-y-0.5 mt-0.5">
                          {list.map((n) => {
                            const currentIndex = globalItemIndex++;
                            const sharesNum = n.shares ? parseFloat(formatEther(BigInt(n.shares))) : 0;
                            const assetsNum = n.assets ? parseFloat(formatEther(BigInt(n.assets))) : 0;
                            return (
                              <li
                                key={n.id}
                                className="opacity-0 animate-notification-item-in"
                                style={{ animationDelay: `${currentIndex * 40}ms` }}
                              >
                              <div className="flex items-start gap-2 px-3 py-2.5 border border-transparent hover:border-intuition-primary/30 hover:bg-white/5 transition-all duration-200 group motion-hover-lift">
                                <span className={`flex-shrink-0 mt-0.5 ${n.type === 'liquidated' ? 'text-intuition-danger' : 'text-intuition-success'}`}>
                                  {n.type === 'liquidated' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold font-mono text-white leading-tight">
                                    <span className="font-black text-intuition-primary">{n.senderLabel}</span>
                                    {' '}
                                    <span className="text-slate-200">{n.type === 'liquidated' ? 'liquidated' : 'acquired'}</span>
                                    {sharesNum > 0 ? (
                                      <span className="text-slate-300 font-semibold">
                                        {' '}{formatDisplayedShares(n.shares!)} shares
                                        {assetsNum > 0 && (
                                          <span className="text-slate-400 font-bold">
                                            {' '}(<CurrencySymbol size="sm" leading className="text-slate-400" />{formatMarketValue(assetsNum)})
                                          </span>
                                        )}
                                        {' '}in{' '}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300"> shares in </span>
                                    )}
                                    <Link
                                      to={`/markets/${n.vaultId}`}
                                      onClick={() => { playClick(); setOpen(false); }}
                                      onMouseEnter={playHover}
                                      className="font-bold text-slate-100 group-hover:text-intuition-primary transition-colors truncate inline-block max-w-full align-baseline underline-offset-2 group-hover:underline"
                                    >
                                      {n.marketLabel}
                                    </Link>
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-[9px] font-bold font-mono text-slate-400">
                                      {formatTimeAgo(n.timestamp)}
                                    </span>
                                    <span className="text-[9px] font-bold font-mono text-slate-400 border border-slate-600 px-2 py-0.5 clip-path-slant bg-white/[0.03]" title="Bonding curve type">
                                      {getCurveLabel(n.curveId)}
                                    </span>
                                    {n.txHash && (
                                      <a
                                        href={`${EXPLORER_URL}/tx/${n.txHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseEnter={playHover}
                                        className="text-slate-500 hover:text-intuition-primary transition-colors inline-flex items-center gap-0.5 font-bold"
                                        title="View on explorer"
                                      >
                                        <ExternalLink size={12} />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  });
                })()}
              </ul>
            )}
          </div>
          <div className="p-3 border-t border-white/10 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => { playClick(); openEmailNotify(); }}
              onMouseEnter={playHover}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[10px] font-black font-mono text-slate-400 hover:text-intuition-primary uppercase tracking-widest transition-colors"
            >
              <Mail size={12} /> Get email alerts
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBar;
