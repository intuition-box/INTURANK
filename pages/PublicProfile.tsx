
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getWalletBalance, getShareBalanceEffective, getQuoteRedeem, resolveENS, reverseResolveENS, toAddress } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds, getUserActivityStats, getUserIdTransactionCount, getCurveLabel } from '../services/graphql';
import { User, PieChart as PieIcon, Activity, Zap, Shield, TrendingUp, Layers, RefreshCw, Search, ArrowRight, AlertTriangle, Database, Wallet, Loader2, Fingerprint, Activity as PulseIcon, UserPlus, UserMinus, Mail, Copy, ChevronRight, Trash2 } from 'lucide-react';
import { formatEther, isAddress, getAddress } from 'viem';
import { Transaction } from '../types';
import { calculateCategoryExposure, calculateSentimentBias, formatMarketValue, formatDisplayedShares } from '../services/analytics';
import {
  CURRENCY_SYMBOL,
  DISTRUST_ATOM_ID,
  LINEAR_CURVE_ID,
  OFFSET_PROGRESSIVE_CURVE_ID,
  PAGE_HERO_EYEBROW,
  PAGE_HERO_TITLE,
  PAGE_HERO_BODY,
} from '../constants';
import { CurrencySymbol } from '../components/CurrencySymbol';
import { PageLoadingSpinner } from '../components/PageLoading';
import { playClick, playHover } from '../services/audio';
import { toast } from '../components/Toast';
import { isFollowing, addFollow, removeFollow, setFollowEmailAlerts, type FollowEntry } from '../services/follows';
// import BadgesSection from '../components/BadgesSection';
import { getEmailSubscription, removeEmailSubscription, setEmailAlertFrequency, type EmailAlertFrequency } from '../services/emailNotifications';
import { useEmailNotify } from '../contexts/EmailNotifyContext';

const COLORS = ['#00f3ff', '#00ff9d', '#ff0055', '#facc15', '#94a3b8'];

/** Rounded “product” glass — matches Home / Skill Playground energy */
const GLASS_SHEET =
  'relative overflow-hidden rounded-[1.5rem] border border-white/[0.1] bg-[#05070c]/[0.88] ' +
  'shadow-[0_20px_50px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.07)] ' +
  'ring-1 ring-inset ring-white/[0.04] backdrop-blur-2xl backdrop-saturate-150 ' +
  'transition-[border-color,box-shadow,transform] duration-300';

const MESH_ACCENT = {
  background:
    'radial-gradient(ellipse 80% 55% at 0% 0%, rgba(0,243,255,0.14), transparent 52%), ' +
    'radial-gradient(ellipse 60% 45% at 100% 100%, rgba(255,30,109,0.1), transparent 48%)',
} as const;

/** Card / table labels: crisp sans, no faux-wide tracking */
const labelSm =
  'font-sans text-xs font-semibold text-slate-100 antialiased tracking-tight [text-rendering:geometricPrecision]';
const labelMuted =
  'font-sans text-[10px] font-medium text-slate-400 antialiased tracking-tight [text-rendering:geometricPrecision]';
const statDisplay =
  'font-display text-4xl font-black tracking-tight text-white antialiased [text-rendering:geometricPrecision] [text-shadow:none]';

const POSITIONS_PER_PAGE = 10;
/** Unbounded `Promise.all` on large holder accounts hammers RPC + can hang the page before `setLoading(false)`. */
const PROFILE_LIVE_CHECK_CAP = 200;
const LIVE_VERIFY_BATCH = 8;

const PublicProfile: React.FC = () => {
  const { address: addressParam = '' } = useParams<{ address: string }>();
  const navigate = useNavigate();
  /** Checksummed; avoids search/navigation race with mixed-case 0x in the path. */
  const address = useMemo(() => {
    const t = addressParam?.trim();
    if (!t) return undefined;
    if (!isAddress(t as `0x${string}`)) return undefined;
    try {
      return getAddress(t as `0x${string}`);
    } catch {
      return undefined;
    }
  }, [addressParam]);

  const activeProfileFetchFor = useRef<string | null>(null);
  const { address: connectedAddress } = useAccount();
  const { openEmailNotify, isEmailNotifyOpen } = useEmailNotify();
  const [ensName, setEnsName] = useState<string | null>(null);
  const [followEntry, setFollowEntry] = useState<FollowEntry | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState('0.00');
  const [ethBalance, setEthBalance] = useState('0.00');
  const [sentimentBias, setSentimentBias] = useState({ trust: 50, distrust: 50 });
  const [exposureData, setExposureData] = useState<any[]>([]);
  const [semanticFootprint, setSemanticFootprint] = useState(0);
  const [activeHoldingsCount, setActiveHoldingsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [subscription, setSubscription] = useState<{ email: string; nickname?: string; subscribedAt?: number; alertFrequency?: EmailAlertFrequency } | null>(null);
  const [positionsPage, setPositionsPage] = useState(1);

  const isOwnProfile = !!address && !!connectedAddress && address.toLowerCase() === connectedAddress.toLowerCase();
  /** Param present in URL but not a valid 0x address (e.g. typos, truncated paste). */
  const isInvalidAddressParam = Boolean(addressParam?.trim()) && !address;

  const totalPositionPages = Math.max(1, Math.ceil(positions.length / POSITIONS_PER_PAGE));
  const positionsPageSlice = useMemo(() => {
    const start = (positionsPage - 1) * POSITIONS_PER_PAGE;
    return positions.slice(start, start + POSITIONS_PER_PAGE);
  }, [positions, positionsPage]);

  const refreshSubscription = useCallback((addr: string | null) => {
    if (!addr) {
      setSubscription(null);
      return;
    }
    const sub = getEmailSubscription(addr);
    setSubscription(sub ? { email: sub.email, nickname: sub.nickname, subscribedAt: sub.subscribedAt, alertFrequency: sub.alertFrequency } : null);
  }, []);

  useEffect(() => {
    if (isOwnProfile && address) refreshSubscription(address);
    else setSubscription(null);
  }, [isOwnProfile, address, refreshSubscription]);

  useEffect(() => {
    if (isEmailNotifyOpen === false && isOwnProfile && address) refreshSubscription(address);
  }, [isEmailNotifyOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (address) {
      setEnsName(null);
      setPositions([]);
      setHistory([]);
      setVolumeData([]);
      setPortfolioValue('0.00');
      setEthBalance('0.00');
      setSentimentBias({ trust: 50, distrust: 50 });
      setExposureData([]);
      setSemanticFootprint(0);
      setActiveHoldingsCount(0);
      fetchUserData(address);
    } else if (addressParam?.trim()) {
      setLoading(false);
      setPositions([]);
      setHistory([]);
      setVolumeData([]);
      setSemanticFootprint(0);
      setActiveHoldingsCount(0);
    }
  }, [address, addressParam]);

  useEffect(() => {
    setPositionsPage(1);
  }, [address]);

  useEffect(() => {
    if (positionsPage > totalPositionPages) setPositionsPage(totalPositionPages);
  }, [positionsPage, totalPositionPages]);

  useEffect(() => {
    if (connectedAddress && address) setFollowEntry(isFollowing(connectedAddress, address) ?? null);
    else setFollowEntry(null);
  }, [connectedAddress, address]);

  // If follow has emailAlerts on but user never added email, turn alerts off so UI and backend stay in sync
  useEffect(() => {
    if (!connectedAddress || !address || !followEntry?.emailAlerts) return;
    if (!getEmailSubscription(connectedAddress)) {
      setFollowEmailAlerts(connectedAddress, address, false);
      setFollowEntry((prev) => (prev ? { ...prev, emailAlerts: false } : null));
    }
  }, [connectedAddress, address, followEntry?.emailAlerts]);

  const fetchUserData = async (addr: string) => {
    activeProfileFetchFor.current = addr;
    setLoading(true);
    try {
      reverseResolveENS(addr).then((name) => {
        if (activeProfileFetchFor.current === addr) setEnsName(name);
      });
      const bal = await getWalletBalance(addr);
      if (activeProfileFetchFor.current !== addr) return;
      setEthBalance(Number(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

      // High-precision parallel fetch (all from Intuition graph / chain)
      const [graphPositions, chainHistory, activityStats, graphTxCount] = await Promise.all([
          getUserPositions(addr).catch(() => []),
          getUserHistory(addr).catch(() => []),
          getUserActivityStats(addr).catch(() => ({ txCount: 0, holdingsCount: 0 })),
          getUserIdTransactionCount(addr).catch(() => 0)
      ]);
      if (activeProfileFetchFor.current !== addr) return;
      
      const uniqueVaultIds = Array.from(new Set([
          ...graphPositions.map((p: any) => p.vault?.term_id?.toLowerCase()),
          ...chainHistory.map(tx => tx.vaultId?.toLowerCase())
      ])).filter(Boolean) as string[];

      const metadata = await getVaultsByIds(uniqueVaultIds).catch(() => []);
      if (activeProfileFetchFor.current !== addr) return;

      const DUST = 1e-8; // treat below this as zero (sold / dust) — strict so closed positions never show
      const graphWithShares = graphPositions.filter((p: any) => {
        const s = p.shares;
        if (s === undefined || s === null) return false;
        const n = typeof s === 'string' ? parseFloat(s) : Number(s);
        return n > DUST;
      });
      // Index query is already order_by shares desc — take top N for live verify only (huge accounts exist).
      const graphForLiveCheck = graphWithShares.slice(0, PROFILE_LIVE_CHECK_CAP);

      // Positions: use effective shares (RPC + subgraph merge) and try both curves — in small
      // batches so we never run thousands of concurrent RPC/GQL calls (hangs the UI, loading never ends).
      const processGraphPosition = async (p: any) => {
          const rawId = p.vault?.term_id;
          if (!rawId || typeof rawId !== 'string') return null;
          const id = rawId.toLowerCase();
          const meta = metadata.find(m => m.id.toLowerCase() === id);
          const rawCurve = p.vault.curve_id ?? meta?.curveId;
          const curveFromGraph = rawCurve != null ? Number(rawCurve) || LINEAR_CURVE_ID : LINEAR_CURVE_ID;
          const otherCurve = curveFromGraph === LINEAR_CURVE_ID ? OFFSET_PROGRESSIVE_CURVE_ID : LINEAR_CURVE_ID;

          const sPrimary = await getShareBalanceEffective(addr, id, curveFromGraph);
          const sAlt = await getShareBalanceEffective(addr, id, otherCurve);
          const nPrimary = parseFloat(sPrimary) || 0;
          const nAlt = parseFloat(sAlt) || 0;

          let sharesRaw: string;
          let curveId: number;
          let sharesNum: number;
          if (nAlt > nPrimary && nAlt > DUST) {
            sharesRaw = sAlt;
            curveId = otherCurve;
            sharesNum = nAlt;
          } else if (nPrimary > DUST) {
            sharesRaw = sPrimary;
            curveId = curveFromGraph;
            sharesNum = nPrimary;
          } else {
            return null;
          }

          const valueStr = await getQuoteRedeem(sharesRaw, id, addr, curveId);
          const value = parseFloat(valueStr);

          let label = meta?.label || `Agent ${id.slice(0,6)}...`;
          let image = meta?.image;
          let type = meta?.type || 'ATOM';

          const triple = p.vault?.term?.triple;
          const isCounter = triple?.counter_term_id?.toLowerCase() === id.toLowerCase();
          const pointsToDistrust = triple?.object?.term_id?.toLowerCase().includes(DISTRUST_ATOM_ID.toLowerCase().slice(26));

          if (isCounter || pointsToDistrust) {
              const subjectLabel = triple?.subject?.label || triple?.subject?.term_id?.slice(0, 8) || 'NODE';
              label = `OPPOSING_${subjectLabel}`.toUpperCase();
              image = triple?.subject?.image;
              type = 'CLAIM';
          }

          return {
              id,
              curveId,
              shares: sharesNum,
              value: value,
              atom: { label, id, image, type }
          };
      };

      const liveResolved: (Awaited<ReturnType<typeof processGraphPosition>>)[] = [];
      for (let o = 0; o < graphForLiveCheck.length; o += LIVE_VERIFY_BATCH) {
        if (activeProfileFetchFor.current !== addr) return;
        const chunk = graphForLiveCheck.slice(o, o + LIVE_VERIFY_BATCH);
        const part = await Promise.all(chunk.map(processGraphPosition));
        if (activeProfileFetchFor.current !== addr) return;
        liveResolved.push(...part);
      }

      const finalPositions = (liveResolved.filter(Boolean) as any[]).sort(
        (a, b) => (b.value ?? 0) - (a.value ?? 0)
      );
      const totalAssetsSum = finalPositions.reduce((s, p) => s + (p.value || 0), 0);
      setPositions(finalPositions);
      setActiveHoldingsCount(activityStats.holdingsCount || finalPositions.length);
      setExposureData(calculateCategoryExposure(finalPositions));
      setPortfolioValue(
        totalAssetsSum.toLocaleString(undefined, {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        }),
      );

      const mergedHistory = chainHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setHistory(mergedHistory);

      // SEMANTIC FOOTPRINT: total transactions from Intuition graph (same definition as getUserHistory)
      const footprintCount =
        graphTxCount > 0
          ? graphTxCount
          : (mergedHistory.length > 0 ? mergedHistory.length : (activityStats.txCount > 0 ? activityStats.txCount : finalPositions.length));
      setSemanticFootprint(footprintCount); 

      // SENTIMENT BIAS: use history when available, otherwise infer from holdings
      if (mergedHistory.length > 0) {
          setSentimentBias(calculateSentimentBias(mergedHistory));
      } else if (finalPositions.length > 0) {
          // Power users with holdings but no on-chain events yet: show bullish bias
          setSentimentBias({ trust: 95, distrust: 5 });
      } else {
          setSentimentBias({ trust: 50, distrust: 50 });
      }
      
      // Reconstruct temporal growth chart
      let currentRunningVol = 0;
      let chartPoints = mergedHistory
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .map((tx, idx) => {
              try {
                  const assetVal = parseFloat(formatEther(BigInt(tx.assets || '0')));
                  currentRunningVol += assetVal > 0 ? assetVal : 0;
              } catch (e) {}
              return { idx, val: currentRunningVol };
          });
      
      if (chartPoints.length === 0 && finalPositions.length > 0) {
          chartPoints = [
              { idx: 0, val: 0 },
              { idx: 1, val: totalAssetsSum }
          ];
      }
      setVolumeData(chartPoints);

    } catch (e) {
      console.error("PROFILE_RECON_FAILURE:", e);
    } finally {
      if (activeProfileFetchFor.current === addr) {
        setLoading(false);
      }
    }
  };

  const handleSearch = async () => {
      const cleanQuery = searchQuery.trim();
      if (isAddress(cleanQuery)) {
          playClick();
          try {
            const normalized = getAddress(cleanQuery as `0x${string}`);
            navigate(`/profile/${normalized}`);
            setSearchQuery('');
          } catch {
            toast.error('Invalid address');
          }
          return;
      }
      if (cleanQuery.endsWith('.eth')) {
          playClick();
          setIsResolving(true);
          try {
              const resolvedAddress = await resolveENS(cleanQuery);
              if (resolvedAddress) {
                  const n = toAddress(resolvedAddress);
                  if (n) {
                    navigate(`/profile/${n}`);
                    setSearchQuery('');
                  } else {
                    toast.error('ENS did not resolve to a valid address');
                  }
              } else { toast.error(`ENS NOT FOUND: ${cleanQuery}`); }
          } catch (e) { toast.error("ENS RESOLUTION FAILED"); } finally { setIsResolving(false); }
      }
  };

  /** Non-zero slices + stable color index (matches legend). Pie `data` is only { name, value }. */
  const exposurePieSlices = useMemo(
    () =>
      exposureData
        .map((entry, colorIndex) => ({ name: entry.name, value: entry.value, colorIndex }))
        .filter((row) => row.value > 0),
    [exposureData]
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#020308] font-mono selection:bg-intuition-primary selection:text-black">
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.035]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.04] retro-grid" aria-hidden />
      <div className="pointer-events-none absolute top-0 right-0 z-0 h-[min(70vw,560px)] w-[min(70vw,560px)] rounded-full bg-intuition-primary/6 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 left-0 z-0 h-[min(55vw,480px)] w-[min(55vw,480px)] rounded-full bg-[#ff1e6d]/5 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-5 lg:px-8">
      <header className="mb-8 space-y-2 font-sans">
        <p className={PAGE_HERO_EYEBROW}>{isOwnProfile ? 'Your account' : 'Trader profile'}</p>
        <h1 className={PAGE_HERO_TITLE}>Profile</h1>
        <p className={`${PAGE_HERO_BODY} max-w-2xl`}>
          {isOwnProfile
            ? 'Balances, positions, and activity for your connected wallet.'
            : 'Public view of positions and on-chain activity for this address.'}
        </p>
      </header>

      <div className="relative z-20 mb-8 flex justify-end">
          <div className="flex items-center gap-0 rounded-2xl border border-white/[0.1] bg-[#0a0c14]/80 py-1.5 pl-4 pr-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-all focus-within:border-intuition-primary/45 focus-within:shadow-[0_0_0_1px_rgba(0,243,255,0.12),0_12px_40px_rgba(0,0,0,0.45)]">
              <input
                  type="text"
                  placeholder="Search by address or ENS"
                  className="w-60 bg-transparent font-sans text-sm text-slate-100 outline-none placeholder:text-slate-500 sm:w-72"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={isResolving}
              />
              <button
                  onClick={handleSearch}
                  disabled={!isAddress(searchQuery.trim()) && !searchQuery.trim().endsWith('.eth') || isResolving}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-500 transition-all hover:bg-intuition-primary hover:text-black"
              >
                  {isResolving ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              </button>
          </div>
      </div>

      {isInvalidAddressParam && (
        <div
          role="alert"
          className="relative z-20 mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 font-sans text-sm text-amber-100 [text-rendering:geometricPrecision] sm:items-center"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          <p>
            <span className="font-semibold text-amber-50">Invalid address in URL. </span>
            The path must be a full 42-character <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">0x</code> address. Try pasting the address again or search by ENS.
          </p>
        </div>
      )}

      <div className="mb-10 sm:mb-12 rounded-[1.75rem] bg-gradient-to-r from-intuition-primary/45 via-cyan-200/15 to-intuition-primary/40 p-[1px] shadow-[0_0_50px_rgba(0,243,255,0.14)] sm:rounded-[2rem]">
        <div className="relative flex flex-col items-center gap-8 overflow-hidden rounded-[1.7rem] bg-gradient-to-b from-[#0c101c]/[0.97] to-[#05070d]/[0.98] p-8 sm:p-10 md:flex-row md:items-center md:gap-10 sm:rounded-[1.95rem]">
          <div className="pointer-events-none absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04]" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.55]"
            style={{ background: MESH_ACCENT.background }}
          />
          <div className="group relative flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl border-2 border-white/10 bg-black/40 shadow-[0_0_40px_rgba(0,243,255,0.12),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-inset ring-white/5">
            <div className="absolute inset-0 rounded-3xl bg-intuition-primary/5 transition-colors group-hover:bg-intuition-primary/10" />
            <User size={56} className="relative z-10 text-slate-500 transition-colors group-hover:text-intuition-primary" />
          </div>
          <div className="relative z-10 min-w-0 flex-1 text-center md:text-left">
            <p className="mb-2 font-sans text-sm text-slate-500">{isOwnProfile ? 'Your wallet' : 'Address'}</p>
            <h2 className="mb-1 break-words font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {ensName || (address ? address.slice(0, 6) + "..." + address.slice(-4) : "Unknown address")}
            </h2>
            {ensName && (
                <div className="mx-auto mb-6 w-fit rounded-xl border border-intuition-primary/35 bg-black/50 px-3 py-1.5 font-mono text-xs font-black tracking-widest text-intuition-primary/90 antialiased backdrop-blur-sm md:mx-0">
                    {address}
                </div>
            )}
            {!ensName && <div className="mb-4"></div>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start sm:gap-3">
                {/* {address && <BadgesSection address={address} compact />} */}
                <span className="rounded-full border border-intuition-primary/40 bg-gradient-to-r from-intuition-primary/25 to-intuition-primary/10 px-3.5 py-2 font-sans text-xs font-semibold text-intuition-primary shadow-[0_0_24px_rgba(0,243,255,0.12)] [text-rendering:geometricPrecision]">
                  {activeHoldingsCount > 50 ? 'Level · Elite' : activeHoldingsCount > 10 ? 'Level · Pro' : 'Level · Explorer'}
                </span>
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 font-sans text-xs font-medium text-slate-200 backdrop-blur-sm [text-rendering:geometricPrecision]">
                  {activeHoldingsCount >= 100 ? `${activeHoldingsCount}+` : activeHoldingsCount} open positions
                </span>
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3.5 py-2 font-sans text-xs font-medium text-slate-200 ring-1 ring-inset ring-white/5 [text-rendering:geometricPrecision]">
                    <Wallet size={12} className="text-intuition-primary" /> {ethBalance} {CURRENCY_SYMBOL}
                </span>
              </div>
              {connectedAddress && address && (address.toLowerCase() !== connectedAddress.toLowerCase()) && (
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 shrink-0">
                  {followEntry ? (
                    <>
                      <span className="flex items-center gap-1.5 rounded-full border border-intuition-success/40 bg-intuition-success/15 px-3 py-2 font-sans text-xs font-semibold text-intuition-success [text-rendering:geometricPrecision]">
                        <UserMinus size={12} /> Following
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          removeFollow(connectedAddress, address);
                          setFollowEntry(null);
                          toast.success('Unfollowed');
                        }}
                        className="rounded-xl border-2 border-slate-500 px-3 py-2 font-sans text-xs font-semibold text-slate-200 transition-colors hover:border-slate-400 hover:text-white"
                      >
                        Unfollow
                      </button>
                      <label
                        className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-slate-600 px-3 py-2 transition-all duration-200 hover:border-amber-500/50 hover:text-amber-400/90"
                        title="Email when they buy or sell"
                      >
                        <input
                          type="checkbox"
                          checked={followEntry.emailAlerts && !!getEmailSubscription(connectedAddress)}
                          onChange={(e) => {
                            playClick();
                            const wantOn = e.target.checked;
                            const hasEmail = !!getEmailSubscription(connectedAddress);
                            if (wantOn && !hasEmail) {
                              openEmailNotify();
                              toast.info('Add your email to receive alerts when they buy or sell');
                              return; // don't persist emailAlerts until they have an email
                            }
                            setFollowEmailAlerts(connectedAddress, address, wantOn);
                            setFollowEntry((prev) => (prev ? { ...prev, emailAlerts: wantOn } : null));
                          }}
                          className="sr-only"
                        />
                        <span className={`flex items-center justify-center w-5 h-5 border-2 rounded-sm shrink-0 ${(followEntry.emailAlerts && getEmailSubscription(connectedAddress)) ? 'bg-amber-500 border-amber-400 text-black' : 'bg-black border-slate-500 text-transparent'}`}>
                          {(followEntry.emailAlerts && getEmailSubscription(connectedAddress)) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </span>
                        <Mail size={14} className={followEntry.emailAlerts ? 'text-amber-400' : 'text-slate-400'} />
                        <span className="text-xs font-semibold tracking-normal text-slate-200 antialiased" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          Email alerts
                        </span>
                      </label>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        playClick();
                        const addr = toAddress(address || '');
                        const idToStore = addr || (await resolveENS(address || '').then((r) => toAddress(r) || r)) || address;
                        const label = ensName || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '');
                        const hasEmail = !!getEmailSubscription(connectedAddress);
                        addFollow(connectedAddress, idToStore, { label, emailAlerts: hasEmail });
                        setFollowEntry(isFollowing(connectedAddress, idToStore) ?? null);
                        if (hasEmail) {
                          toast.success('Following — you’ll get alerts when they buy');
                        } else {
                          openEmailNotify();
                          toast.info('Add your email to get alerts when they buy or sell');
                        }
                      }}
                      className="flex items-center gap-2.5 rounded-2xl border-2 border-amber-400 bg-black/60 px-4 py-2.5 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)] backdrop-blur-sm transition-all duration-200 hover:border-amber-300 hover:text-amber-300 hover:shadow-[0_0_28px_rgba(251,191,36,0.45)]"
                      title="Get email when they buy or sell"
                    >
                      <UserPlus size={16} strokeWidth={2} className="shrink-0" />
                      <span className="text-sm font-semibold tracking-normal antialiased" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Follow · Email when they buy
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* {address && (
            <BadgesSection address={address} />
          )} */}
          <div
            className={`${GLASS_SHEET} group motion-hover-lift p-7 sm:p-8 hover:border-intuition-primary/35 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(0,243,255,0.08),inset_0_1px_0_rgba(255,255,255,0.08)]`}
          >
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    'radial-gradient(ellipse 100% 80% at 100% 0%, rgba(0,243,255,0.1), transparent 55%)',
                }}
              />
              <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-[0.07] transition-transform group-hover:scale-110">
                <Shield size={80} />
              </div>
              <div className="relative mb-1 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-intuition-primary/25 bg-intuition-primary/10">
                    <Activity size={14} className="text-intuition-primary" />
                  </span>
                  <div>
                    <p className={labelSm}>Total in vaults</p>
                    <p className={`${labelMuted} mt-0.5`}>TRUST value of your open positions</p>
                  </div>
              </div>
              <div className={`relative mt-3 inline-flex items-baseline gap-2 ${statDisplay} tabular-nums`}>
                <CurrencySymbol size="2xl" leading />
                {portfolioValue}
              </div>
          </div>
          <div
            className={`${GLASS_SHEET} group motion-hover-lift p-7 sm:p-8 hover:border-intuition-secondary/40 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_36px_rgba(255,0,85,0.1),inset_0_1px_0_rgba(255,255,255,0.08)]`}
          >
              <div
                className="pointer-events-none absolute inset-0 opacity-35"
                style={{
                  background:
                    'radial-gradient(ellipse 90% 70% at 0% 100%, rgba(255,0,85,0.08), transparent 50%)',
                }}
              />
              <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-[0.07] transition-transform group-hover:scale-110">
                <Layers size={80} />
              </div>
              <div className="relative mb-1 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-intuition-secondary/30 bg-intuition-secondary/10">
                    <Database size={14} className="text-intuition-secondary" />
                  </span>
                  <div>
                    <p className={labelSm}>On-chain transactions</p>
                    <p className={`${labelMuted} mt-0.5`}>Recorded on the Intuition index</p>
                  </div>
              </div>
              <div className={`relative mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 ${statDisplay}`}>
                  <span className="tabular-nums">{semanticFootprint >= 100 ? `${semanticFootprint}+` : semanticFootprint}</span>
                  <span className={labelMuted}>all-time</span>
              </div>
          </div>
          <div
            className={`${GLASS_SHEET} group motion-hover-lift p-7 sm:p-8 md:col-span-2 lg:col-span-1 hover:border-intuition-primary/30 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]`}
          >
              <div className="relative mb-1 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-intuition-primary/25 bg-intuition-primary/10">
                    <PulseIcon size={14} className="animate-pulse text-intuition-primary" />
                  </span>
                  <div>
                    <p className={labelSm}>Trust vs. distrust</p>
                    <p className={`${labelMuted} mt-0.5`}>From your recent activity</p>
                  </div>
              </div>
              {/*
                One full-width track: each segment is a % of the *whole* bar.
                (The old 50/50 split halves made each % only fill half the bar — wrong vs labels.)
              */}
              <div className="relative mt-5 flex h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/10">
                <div
                  style={{ width: `${sentimentBias.trust}%` }}
                  className="h-full shrink-0 bg-intuition-success transition-all duration-1000"
                />
                <div
                  style={{ width: `${sentimentBias.distrust}%` }}
                  className="h-full shrink-0 bg-intuition-danger transition-all duration-1000"
                />
              </div>
              <div className="mt-4 flex items-end justify-between font-sans">
                  <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-semibold text-intuition-success [text-rendering:geometricPrecision]">Trust</span>
                      <span className="text-sm font-semibold tabular-nums text-white [text-rendering:geometricPrecision]">{sentimentBias.trust.toFixed(0)}%</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[11px] font-semibold text-intuition-danger [text-rendering:geometricPrecision]">Distrust</span>
                      <span className="text-sm font-semibold tabular-nums text-white [text-rendering:geometricPrecision]">{sentimentBias.distrust.toFixed(0)}%</span>
                  </div>
              </div>
          </div>
      </div>

      {/* Account settings — only when viewing own profile */}
      {isOwnProfile && address && (
        <div className="mb-10 space-y-6">
          <div className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold text-slate-200 [text-rendering:geometricPrecision]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <Shield size={14} className="text-intuition-primary" />
            </span>
            Account settings
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div className={`${GLASS_SHEET} p-6 hover:border-white/15`}>
              <div className="mb-3 flex items-center gap-2">
                <Wallet size={14} className="text-intuition-primary" />
                <span className="font-sans text-xs font-semibold text-slate-300 [text-rendering:geometricPrecision]">Wallet address</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="break-all font-mono text-sm text-slate-300">{address.slice(0, 10)}...{address.slice(-8)}</span>
                <button
                  onClick={() => { playClick(); navigator.clipboard.writeText(address); toast.success('Address copied'); }}
                  onMouseEnter={playHover}
                  className="flex items-center gap-2 rounded-xl border-2 border-white/10 px-4 py-2 font-mono text-[10px] font-black tracking-widest text-slate-400 transition-colors hover:border-intuition-primary hover:text-intuition-primary"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
            </div>
            <div className={`${GLASS_SHEET} p-6 hover:border-white/15`}>
              <div className="flex items-center gap-2 mb-3">
                <Mail size={14} className="text-intuition-primary" />
                <span className="font-sans text-xs font-semibold text-slate-300 [text-rendering:geometricPrecision]">Email alerts</span>
              </div>
              {subscription?.email ? (
                <div className="space-y-3">
                  <p className="text-slate-300 font-mono text-sm">Linked: <span className="text-white">{subscription.email}</span></p>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="alertFrequency"
                        checked={(subscription.alertFrequency ?? 'per_tx') === 'per_tx'}
                        onChange={() => {
                          playClick();
                          setEmailAlertFrequency(address, 'per_tx');
                          setSubscription(prev => prev ? { ...prev, alertFrequency: 'per_tx' } : null);
                          toast.success('Alerts: after every buy/sell');
                        }}
                        className="sr-only"
                      />
                      <span className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center ${(subscription.alertFrequency ?? 'per_tx') === 'per_tx' ? 'border-intuition-primary bg-intuition-primary' : 'border-slate-600'}`} />
                      <span className="font-sans text-xs text-slate-300">Every trade</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="alertFrequency"
                        checked={subscription.alertFrequency === 'daily'}
                        onChange={() => {
                          playClick();
                          setEmailAlertFrequency(address, 'daily');
                          setSubscription(prev => prev ? { ...prev, alertFrequency: 'daily' } : null);
                          toast.success('Alerts: daily summary');
                        }}
                        className="sr-only"
                      />
                      <span className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center ${subscription.alertFrequency === 'daily' ? 'border-intuition-primary bg-intuition-primary' : 'border-slate-600'}`} />
                      <span className="font-sans text-xs text-slate-300">Daily summary</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { playClick(); openEmailNotify(); }} onMouseEnter={playHover} className="rounded-lg border border-intuition-primary/50 px-3 py-1.5 text-[10px] font-black uppercase text-intuition-primary transition-colors hover:bg-intuition-primary hover:text-black">Change</button>
                    <button onClick={() => { playClick(); removeEmailSubscription(address); setSubscription(null); toast.success('Email unlinked'); }} onMouseEnter={playHover} className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 transition-colors hover:border-intuition-danger hover:text-intuition-danger"><Trash2 size={10} /> Delete</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-500 text-xs font-mono">No email linked</p>
                    <button onClick={() => { playClick(); openEmailNotify(); }} onMouseEnter={playHover} className="flex items-center gap-2 rounded-xl border border-intuition-primary bg-intuition-primary px-4 py-2.5 font-mono text-[10px] font-black uppercase text-black shadow-[0_0_24px_rgba(0,243,255,0.25)] transition-colors hover:bg-white"><Mail size={12} /> Add email</button>
                </div>
              )}
            </div>
          </div>
          <Link to="/portfolio" onClick={playClick} onMouseEnter={playHover} className={`${GLASS_SHEET} flex w-full items-center justify-between rounded-2xl px-5 py-4 font-sans text-sm font-semibold text-slate-300 transition-colors hover:border-intuition-primary/40 hover:text-intuition-primary`}>
            <span>View full portfolio</span>
            <ChevronRight size={16} />
          </Link>
        </div>
      )}
      
      {/*
        5-column row: mix 40% · activity 60% — the old 33/66 mix card was too narrow; legend text collided.
      */}
      <div className="mb-12 grid grid-cols-1 gap-5 lg:grid-cols-5 lg:gap-6">
          <div className={`${GLASS_SHEET} group flex min-h-[360px] flex-col p-6 sm:p-8 lg:col-span-2 motion-hover-lift`}>
              <div
                className="pointer-events-none absolute bottom-0 left-0 z-0 p-5 opacity-[0.04] transition-transform group-hover:scale-105"
                aria-hidden
              >
                <PieIcon className="text-slate-500" size={96} />
              </div>
              <h3 className="relative z-10 mb-4 flex items-center gap-3 font-sans text-sm font-semibold text-slate-100 [text-rendering:geometricPrecision]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-intuition-primary/20 bg-intuition-primary/10">
                  <Zap size={16} className="text-intuition-primary" />
                </span>
                <span>
                  <span className="block">Portfolio mix</span>
                  <span className={`${labelMuted} mt-0.5 block font-normal`}>Share of TRUST by category</span>
                </span>
              </h3>
              {exposureData.length > 0 ? (
                  <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-5 xl:grid xl:min-h-0 xl:grid-cols-[minmax(0,200px)_minmax(0,1fr)] xl:items-center xl:gap-6">
                      {/*
                        Recharts: square box only. On xl+ we can sit chart + legend side-by-side with room;
                        below xl, stack so legend is full width (avoids crammed / overlapping text).
                      */}
                      <div className="mx-auto aspect-square w-full max-w-[200px] shrink-0 xl:mx-0 xl:max-w-[min(100%,200px)]">
                          <div className="h-full min-h-[160px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                                      <Pie
                                          data={exposurePieSlices.map(({ name, value }) => ({ name, value }))}
                                          dataKey="value"
                                          nameKey="name"
                                          cx="50%"
                                          cy="50%"
                                          innerRadius="48%"
                                          outerRadius="78%"
                                          paddingAngle={1}
                                          startAngle={90}
                                          endAngle={-270}
                                          stroke="#05070c"
                                          strokeWidth={2}
                                          isAnimationActive
                                      >
                                          {exposurePieSlices.map((row) => (
                                              <Cell
                                                  key={`cell-${row.name}-${row.colorIndex}`}
                                                  fill={COLORS[row.colorIndex % COLORS.length]}
                                              />
                                          ))}
                                      </Pie>
                                      <Tooltip
                                          formatter={(value: number) => [`${Number(value).toFixed(1)}%`, 'Share']}
                                          contentStyle={{
                                              backgroundColor: 'rgba(5,7,12,0.95)',
                                              border: '1px solid rgba(255,255,255,0.1)',
                                              fontSize: '11px',
                                              borderRadius: '12px',
                                          }}
                                      />
                                  </PieChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                      <ul className="font-sans min-h-0 w-full list-none space-y-2.5 [text-rendering:optimizeLegibility] xl:max-h-[280px] xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                          {exposureData.map((entry, index) => (
                              <li
                                  key={`${entry.name}-${index}`}
                                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 border-b border-white/[0.06] pb-2.5 last:border-0 last:pb-0"
                              >
                                  <div className="flex min-w-0 items-start gap-2.5 sm:items-center sm:gap-3">
                                      <div
                                          className="mt-0.5 h-2.5 w-2.5 shrink-0 self-start rounded-sm shadow-sm ring-1 ring-white/20 sm:mt-0"
                                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                      />
                                      <span className="min-w-0 break-words text-left text-xs font-medium leading-snug text-slate-200">
                                          {entry.name}
                                      </span>
                                  </div>
                                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-white">
                                      {entry.value.toFixed(0)}%
                                  </span>
                              </li>
                          ))}
                      </ul>
                  </div>
              ) : (
                  <div className="font-sans flex h-full min-h-[200px] flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center text-sm text-slate-500 [text-rendering:geometricPrecision]">No category breakdown yet — open a position to see a split.</div>
              )}
          </div>
          <div className={`${GLASS_SHEET} group relative flex h-[360px] flex-col overflow-hidden p-8 sm:p-10 lg:col-span-3 motion-hover-lift`}>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-intuition-primary/8 via-transparent to-[#ff1e6d]/5 opacity-60" />
              <h3 className="relative z-10 mb-4 flex items-center gap-3 font-sans text-sm font-semibold text-slate-100 [text-rendering:geometricPrecision]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-intuition-primary/20 bg-intuition-primary/10">
                  <Activity size={16} className="animate-pulse text-intuition-primary" />
                </span>
                <span>
                  <span className="block">Activity over time</span>
                  <span className={`${labelMuted} mt-0.5 block font-normal`}>Cumulative TRUST from your on-chain events</span>
                </span>
              </h3>
              <div className="relative z-10 min-h-0 flex-1">
                {volumeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={volumeData}>
                            <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 6" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="idx" hide />
                            <YAxis hide />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(5,7,12,0.95)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', borderRadius: '12px' }} />
                            <Area type="stepAfter" dataKey="val" stroke="#00f3ff" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" isAnimationActive={true} animationDuration={1000} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center font-sans text-sm text-slate-500 [text-rendering:geometricPrecision]">Not enough history to chart yet.</div>
                )}
              </div>
          </div>
      </div>

      <div className={`${GLASS_SHEET} overflow-hidden`}>
          <div className="flex flex-col items-start justify-between gap-4 border-b border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:p-6 md:p-8">
              <h3 className="flex items-center gap-3 font-sans text-sm font-semibold text-slate-100 [text-rendering:geometricPrecision] sm:text-base">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Fingerprint size={20} className="shrink-0 text-slate-400" />
                </span>
                Your positions
              </h3>
              <div className="max-w-xs text-right font-sans text-xs text-slate-500 [text-rendering:geometricPrecision]">Sourced from Intuition mainnet</div>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[10px] sm:text-xs">
                  <thead className="border-b border-white/[0.06] bg-[#080a10]/90 font-sans">
                      <tr>
                          <th className="px-3 py-3 font-semibold text-slate-200 sm:px-6 md:px-10 md:py-4">Name</th>
                          <th className="px-3 py-3 font-semibold text-slate-200 sm:px-6 md:px-10 md:py-4">Type</th>
                          <th className="px-3 py-3 font-semibold text-slate-200 sm:px-6 md:px-10 md:py-4">Curve</th>
                          <th className="px-3 py-3 text-right font-semibold text-slate-200 sm:px-6 md:px-10 md:py-4">Shares</th>
                          <th className="px-3 py-3 text-right font-semibold text-slate-200 sm:px-6 md:px-10 md:py-4">Value (TRUST)</th>
                          <th className="px-3 py-3 text-right font-semibold text-slate-200 sm:px-6 md:px-10 md:py-4">Market</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {positions.length > 0 ? positionsPageSlice.map((p, i) => (
                          <tr key={`${p.id}-${p.curveId ?? 1}-${(positionsPage - 1) * POSITIONS_PER_PAGE + i}`} className="hover:bg-white/5 transition-all group relative">
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6">
                                  <Link to={`/markets/${p.id}`} className="flex items-center gap-3 sm:gap-6 group-hover:text-intuition-primary transition-colors">
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-900/80 shadow-lg transition-all group-hover:border-intuition-primary sm:h-12 sm:w-12">
                                          {p.atom?.image ? <img src={p.atom.image} className="w-full h-full object-cover" /> : <User size={20} className="text-slate-700" />}
                                      </div>
                                      <div>
                                          <div className={`font-black text-sm group-hover:text-intuition-primary transition-colors uppercase leading-none mb-1.5 tracking-tight ${p.atom?.type === 'CLAIM' ? 'text-intuition-danger' : 'text-white'}`}>{p.atom?.label || p.id.slice(0,8)}</div>
                                          <div className="text-[10px] font-mono text-slate-500">ID {p.id.slice(0, 10)}…</div>
                                      </div>
                                  </Link>
                              </td>
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6">
                                  <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 font-sans text-[9px] font-medium text-slate-300 transition-colors group-hover:text-white sm:px-3 sm:py-1">
                                    {p.atom?.type === 'CLAIM' ? 'Claim' : p.atom?.type === 'ATOM' ? 'Atom' : p.atom?.type || '—'}
                                  </span>
                              </td>
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6 whitespace-nowrap">
                                  <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase">{getCurveLabel(p.curveId ?? 1)}</span>
                              </td>
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6 text-right font-black text-xs sm:text-sm text-white">{formatDisplayedShares(p.shares)}</td>
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6 text-right">
                                  <div className="inline-flex items-baseline gap-1.5 justify-end font-black text-xs sm:text-sm text-intuition-success tracking-tight">
                                      <CurrencySymbol size="sm" leading className="text-intuition-primary/90" />
                                      {formatMarketValue(p.value)}
                                  </div>
                              </td>
                              <td className="px-3 sm:px-6 md:px-10 py-4 md:py-6 text-right">
                                  <Link to={`/markets/${p.id}`} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-sans text-xs font-semibold text-slate-200 transition-all hover:border-intuition-primary sm:px-6">Open</Link>
                              </td>
                          </tr>
                      )) : (
                          <tr><td colSpan={6} className="p-20 text-center font-sans text-sm text-slate-500 [text-rendering:geometricPrecision]">
                              {isInvalidAddressParam ? (
                                <p className="text-slate-300">This profile link is not a valid address. Use search above or a full checksummed <span className="font-mono text-slate-400">0x…</span> path.</p>
                              ) : loading ? (
                                  <div className="flex flex-col items-center gap-4">
                                      <PageLoadingSpinner size="sm" />
                                      <span className="text-slate-400">Loading positions…</span>
                                  </div>
                              ) : (
                                  <div className="mx-auto max-w-md space-y-2">
                                    <p className="text-slate-300">No open vault positions for this address.</p>
                                    {history.length > 0 && (
                                      <p className="text-xs leading-relaxed text-slate-500">
                                        Past buys, sells, and creates can still appear above — if you closed or redeemed
                                        everything, total in vaults can read as zero while activity stays visible.
                                      </p>
                                    )}
                                  </div>
                              )}
                          </td></tr>
                      )}
                  </tbody>
              </table>
          </div>
          {positions.length > POSITIONS_PER_PAGE && (
            <div className="flex flex-col items-stretch justify-between gap-3 border-t border-white/[0.08] bg-white/[0.02] px-4 py-3 font-sans sm:flex-row sm:items-center sm:px-6">
              <p className="text-center text-xs text-slate-500 sm:text-left">
                Showing{' '}
                <span className="tabular-nums text-slate-300">
                  {(positionsPage - 1) * POSITIONS_PER_PAGE + 1}–{Math.min(positionsPage * POSITIONS_PER_PAGE, positions.length)}
                </span>
                <span> of {positions.length}</span>
              </p>
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setPositionsPage((p) => Math.max(1, p - 1));
                  }}
                  onMouseEnter={playHover}
                  disabled={positionsPage <= 1}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-intuition-primary/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="min-w-[5rem] text-center text-xs text-slate-500 tabular-nums">
                  {positionsPage} / {totalPositionPages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setPositionsPage((p) => Math.min(totalPositionPages, p + 1));
                  }}
                  onMouseEnter={playHover}
                  disabled={positionsPage >= totalPositionPages}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-intuition-primary/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
      </div>
      </div>
    </div>
  );
};

export default PublicProfile;
