
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Medal, Award, Zap, TrendingUp, Crown, AlertTriangle, RefreshCw, Users, Shield, Flame, Activity, Search, ArrowRight, Terminal, Loader2, ArrowRightCircle, ShieldAlert, BadgeCheck, UserCog } from 'lucide-react';
import { getTopPositions, getAllAgents, getTopClaims, getAccountPnlCurrent, getPnlLeaderboard, searchAccountsByLabel } from '../services/graphql';
import { reverseResolveENS, resolveENS } from '../services/web3';
import { formatEther, isAddress } from 'viem';
import { playHover, playClick } from '../services/audio';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from '../components/Toast';
import { formatMarketValue, isSystemVerified } from '../services/analytics';
import { CURRENCY_SYMBOL, PAGE_HERO_EYEBROW, PAGE_HERO_TITLE, PAGE_HERO_BODY } from '../constants';
import { CurrencySymbol } from '../components/CurrencySymbol';
import { PageLoading } from '../components/PageLoading';
import { Season2LeaderboardPanel } from '../components/Season2LeaderboardPanel';

type LeaderboardType = 'STAKERS' | 'SEASON_2' | 'AGENTS_SUPPORT' | 'AGENTS_CONTROVERSY' | 'CLAIMS' | 'PNL';

interface LeaderboardEntry {
  rank: number;
  id: string;
  label: string;
  subLabel: string;
  value: string;
  rawValue: number;
  image?: string;
  trend?: 'up' | 'down' | 'flat';
  subject?: any;
  predicate?: string;
  object?: any;
  verified?: boolean;
}

const PNL_CACHE_MS = 5 * 60 * 1000; // 5 minutes (memory + sessionStorage)
const PNL_STORAGE_KEY = 'inturank_stats_pnl_lb_v1';
const PNL_FETCH_LIMIT = 20;

const VALID_LB_TABS: LeaderboardType[] = ['SEASON_2', 'STAKERS', 'PNL', 'AGENTS_SUPPORT', 'AGENTS_CONTROVERSY', 'CLAIMS'];

function parseTabParam(searchParams: URLSearchParams): LeaderboardType {
  const raw = searchParams.get('tab');
  if (!raw) return 'SEASON_2';
  if (raw.toLowerCase() === 'season2') return 'SEASON_2';
  const u = raw.toUpperCase() as LeaderboardType;
  if (VALID_LB_TABS.includes(u)) return u;
  return 'SEASON_2';
}

function tabParamForLeaderboard(tab: LeaderboardType): string {
  if (tab === 'SEASON_2') return 'season2';
  return tab.toLowerCase();
}

function loadPnlFromStorage(): { entries: LeaderboardEntry[]; at: number } | null {
  try {
    const s = sessionStorage.getItem(PNL_STORAGE_KEY);
    if (!s) return null;
    const o = JSON.parse(s) as { entries?: LeaderboardEntry[]; at?: number };
    if (!o?.entries?.length || typeof o.at !== 'number') return null;
    if (Date.now() - o.at > PNL_CACHE_MS) return null;
    return { entries: o.entries, at: o.at };
  } catch {
    return null;
  }
}

function savePnlToStorage(entries: LeaderboardEntry[], at: number) {
  try {
    sessionStorage.setItem(PNL_STORAGE_KEY, JSON.stringify({ entries, at }));
  } catch {
    /* quota / private mode */
  }
}

const Stats: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const initialTab = parseTabParam(searchParams);
  const [activeTab, setActiveTab] = useState<LeaderboardType>(initialTab);
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<{ id: string; label: string | null; image?: string | null }[]>([]);
  const [ensSuggestion, setEnsSuggestion] = useState<{ address: string; name: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsFetched, setSuggestionsFetched] = useState(false);
  const searchSuggestionsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pnlCacheRef = React.useRef<{ entries: LeaderboardEntry[]; at: number } | null>(null);
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [diagnostic, setDiagnostic] = useState<{
    address: string;
    label: string;
    txCount: number;
    holdingsCount: number;
    equityValue?: number | null;
    pnlPct?: number | null;
  } | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(parseTabParam(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return;
    const delay =
      activeTab === 'SEASON_2' && (hash === 'season2-champions' || hash === 'season2-panel') ? 550 : 200;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, delay);
    return () => window.clearTimeout(t);
  }, [loading, location.hash, activeTab, data.length]);

  // --- NAME RESOLUTION EFFECT (PnL: parallel + cap so the tab stays snappy) ---
  useEffect(() => {
      if (loading || data.length === 0 || (activeTab !== 'STAKERS' && activeTab !== 'PNL')) return;

      const resolveUnknowns = async () => {
          const updatedData = [...data];
          const limit = activeTab === 'PNL' ? 14 : 50;
          const topItems = updatedData.slice(0, limit);
          const patches = await Promise.all(
            topItems.map(async (item, i) => {
              if (item.label.startsWith('Trader 0x')) {
                try {
                  const ens = await reverseResolveENS(item.id);
                  if (ens && ens !== item.label) {
                    return {
                      i,
                      next: {
                        ...item,
                        label: ens,
                        image: item.image || `https://effigy.im/a/${item.id}.png`,
                      },
                    };
                  }
                  if (!item.image) {
                    return { i, next: { ...item, image: `https://effigy.im/a/${item.id}.png` } };
                  }
                } catch {
                  if (!item.image) {
                    return { i, next: { ...item, image: `https://effigy.im/a/${item.id}.png` } };
                  }
                }
              } else if (!item.image) {
                return { i, next: { ...item, image: `https://effigy.im/a/${item.id}.png` } };
              }
              return null;
            })
          );

          let hasUpdates = false;
          for (const p of patches) {
            if (p) {
              updatedData[p.i] = p.next;
              hasUpdates = true;
            }
          }

          if (hasUpdates) {
              setData(updatedData);
          }
      };

      resolveUnknowns();
  }, [data, loading, activeTab]);

  const fetchData = async () => {
    if (activeTab === 'SEASON_2') {
      setLoading(false);
      setError(false);
      setData([]);
      return;
    }
    if (activeTab === 'PNL') {
      const mem = pnlCacheRef.current;
      const disk = loadPnlFromStorage();
      const fresh =
        mem && Date.now() - mem.at < PNL_CACHE_MS
          ? mem
          : disk && Date.now() - disk.at < PNL_CACHE_MS
            ? { entries: disk.entries, at: disk.at }
            : null;
      if (fresh) {
        setData(fresh.entries);
        setLoading(false);
        setError(false);
        pnlCacheRef.current = fresh;
        try {
          const pnlRows = await getPnlLeaderboard(0, PNL_FETCH_LIMIT);
          const sorted = (pnlRows || []).map((row: any) => {
            const pnlEth = parseFloat(formatEther(BigInt(row.total_pnl_raw || '0')));
            const pct = row.pnl_pct != null ? Number(row.pnl_pct) : 0;
            const winRate = row.win_rate != null ? Number(row.win_rate) : 0;
            return {
              rank: row.rank ?? 0,
              id: row.account_id,
              label: row.account_label || ensNameForDisplay(row.account_id),
              subLabel: 'PNL_LEADERBOARD',
              value:
                (pnlEth >= 0 ? '+' : '') +
                pnlEth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
                ' ' +
                CURRENCY_SYMBOL,
              rawValue: pnlEth,
              image: `https://effigy.im/a/${row.account_id}.png`,
              subject: { pnl_pct: pct, win_rate: winRate, total_volume_raw: row.total_volume_raw },
            };
          });
          pnlCacheRef.current = { entries: sorted, at: Date.now() };
          savePnlToStorage(sorted, Date.now());
          setData(sorted);
        } catch {
          /* keep stale */
        }
        return;
      }
    }
    setLoading(true);
    setError(false);
    setData([]);

    try {
      if (activeTab === 'STAKERS') {
        // High-density reconnaissance: Fetching up to 5000 positions
        // to minimize "whale exclusion" from share-based sorting.
        const positions = await getTopPositions(5000);
        const userMap = new Map<string, number>();
        const userMeta = new Map<string, any>();

        positions.forEach((pos: any) => {
            const accId = pos.account_id;
            if (!accId) return;
            
            // Calculate real-time conviction valuation: (Shares * Vault_Assets) / Vault_Supply
            // Using BigInt for maximum precision during multiplication before division
            const shares = BigInt(pos.shares || '0');
            const vaultAssets = BigInt(pos.vault?.total_assets || '0');
            const vaultShares = BigInt(pos.vault?.total_shares || '1');
            
            const valueWei = vaultShares > 0n ? (shares * vaultAssets) / vaultShares : 0n;
            const valueEth = parseFloat(formatEther(valueWei));
            
            const currentVal = userMap.get(accId) || 0;
            userMap.set(accId, currentVal + valueEth);
            
            if (!userMeta.has(accId)) {
                const baseLabel = pos.account?.label || ensNameForDisplay(accId);
                const baseImage = pos.account?.image || `https://effigy.im/a/${accId}.png`;
                userMeta.set(accId, { 
                  label: baseLabel, 
                  image: baseImage
                });
            }
        });

        const sorted = Array.from(userMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 100)
          .map(([id, val], idx) => ({
            rank: idx + 1,
            id: id,
            label: userMeta.get(id).label,
            subLabel: 'STAKED_CONVICTION',
            value: val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + CURRENCY_SYMBOL,
            rawValue: val,
            image: userMeta.get(id).image,
            verified: id.endsWith('.eth') || isAddress(id)
          }));

        setData(sorted);

      } else if (activeTab === 'AGENTS_SUPPORT') {
        const agentsData = await getAllAgents(1000);
        const agents = agentsData.items;
        const sorted = agents.sort((a, b) => {
            const valA = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
            const valB = parseFloat(formatEther(BigInt(b.totalAssets || '0')));
            return valB - valA;
        }).slice(0, 100).map((a, idx) => {
            const totalAssetsEth = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
            return {
                rank: idx + 1,
                id: a.id,
                label: a.label || 'Unknown Agent',
                subLabel: 'TOTAL_PROTOCOL_VOLUME',
                value: totalAssetsEth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + CURRENCY_SYMBOL,
                rawValue: totalAssetsEth,
                image: a.image,
                verified: isSystemVerified(a)
            };
        });
        setData(sorted);

      } else if (activeTab === 'AGENTS_CONTROVERSY') {
        const agentsData = await getAllAgents(1000);
        const agents = agentsData.items;
        const sorted = agents.map(a => {
            const assets = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
            const shares = parseFloat(formatEther(BigInt(a.totalShares || '0')));
            const positionCount = Number(a.positionCount || 0);
            
            // Heuristic refinement: Controversy is a function of Liquidity Depth vs Node Interaction frequency
            const price = shares > 0 ? (assets / shares) : 1;
            const interactionDensity = Math.sqrt(positionCount + 1);
            const entropyIndex = (Math.log10(assets + 1) * 10) + (price * 2) + (interactionDensity * 5);
            
            return { ...a, heuristic: entropyIndex };
        }).sort((a, b) => b.heuristic - a.heuristic).slice(0, 100).map((a, idx) => ({
            rank: idx + 1,
            id: a.id,
            label: a.label || 'Unknown Agent',
            subLabel: 'MARKET_ENTROPY_INDEX',
            value: 'Score: ' + a.heuristic.toFixed(2),
            rawValue: a.heuristic,
            image: a.image,
            verified: isSystemVerified(a)
        }));
        setData(sorted);
        
      } else if (activeTab === 'CLAIMS') {
          const claimsData = await getTopClaims(1000);
          const claims = claimsData.items;
          const sorted = claims.slice(0, 100).map((c: any, idx: number) => ({
              rank: idx + 1,
              id: c.id,
              label: '', 
              subLabel: 'SEMANTIC_LINK_WEIGHT',
              value: c.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + CURRENCY_SYMBOL,
              rawValue: c.value,
              subject: c.subject,
              predicate: c.predicate,
              object: c.object
          }));
          setData(sorted);
      } else if (activeTab === 'PNL') {
          const pnlRows = await getPnlLeaderboard(0, PNL_FETCH_LIMIT);
          const sorted = (pnlRows || []).map((row: any) => {
              const pnlEth = parseFloat(formatEther(BigInt(row.total_pnl_raw || '0')));
              const pct = row.pnl_pct != null ? Number(row.pnl_pct) : 0;
              const winRate = row.win_rate != null ? Number(row.win_rate) : 0;
              return {
                  rank: row.rank ?? 0,
                  id: row.account_id,
                  label: row.account_label || ensNameForDisplay(row.account_id),
                  subLabel: 'PNL_LEADERBOARD',
                  value: (pnlEth >= 0 ? '+' : '') + pnlEth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + CURRENCY_SYMBOL,
                  rawValue: pnlEth,
                  image: `https://effigy.im/a/${row.account_id}.png`,
                  subject: { pnl_pct: pct, win_rate: winRate, total_volume_raw: row.total_volume_raw }
              };
          });
          pnlCacheRef.current = { entries: sorted, at: Date.now() };
          savePnlToStorage(sorted, Date.now());
          setData(sorted);
      }
    } catch (e) {
        console.error("LEADERBOARD_RECON_FAILURE", e);
        setError(true);
    } finally {
        setLoading(false);
    }
  };

  const ensNameForDisplay = (addr: string) => {
      if (!addr) return 'Unknown';
      return `Trader ${addr.slice(0,6)}...${addr.slice(-4)}`;
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // ENS / name search suggestions: pop up from first character when not typing a wallet address
  useEffect(() => {
    const q = searchQuery.trim();
    if (isAddress(q)) {
      setSearchSuggestions([]);
      setEnsSuggestion(null);
      setShowSuggestions(false);
      setSuggestionsFetched(false);
      return;
    }
    if (!q) {
      setSearchSuggestions([]);
      setEnsSuggestion(null);
      setShowSuggestions(false);
      setSuggestionsLoading(false);
      setSuggestionsFetched(false);
      return;
    }
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    setShowSuggestions(true);
    setSuggestionsLoading(true);
    setSuggestionsFetched(false);
    suggestionDebounceRef.current = setTimeout(async () => {
      const ensName = q.toLowerCase().endsWith('.eth') ? q : `${q}.eth`;
      try {
        const [accounts, resolvedAddress] = await Promise.all([
          searchAccountsByLabel(q),
          q.length >= 2 ? resolveENS(ensName) : Promise.resolve(null),
        ]);
        setSearchSuggestions(accounts || []);
        setEnsSuggestion(resolvedAddress ? { address: resolvedAddress, name: ensName } : null);
        setShowSuggestions(true);
      } catch {
        setSearchSuggestions([]);
        setEnsSuggestion(null);
        setShowSuggestions(true);
      } finally {
        setSuggestionsLoading(false);
        setSuggestionsFetched(true);
      }
      suggestionDebounceRef.current = null;
    }, 280);
    return () => {
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchSuggestionsRef.current && !searchSuggestionsRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = searchQuery.trim();
  const isQueryNonAddress = q.length > 0 && !isAddress(q);
  const showSuggestionsDropdown = isQueryNonAddress && (showSuggestions || suggestionsLoading || suggestionsFetched);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!showSuggestionsDropdown || !searchInputRef.current) {
      setDropdownRect(null);
      return;
    }
    const update = () => {
      if (searchInputRef.current) {
        const r = searchInputRef.current.getBoundingClientRect();
        setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
      }
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showSuggestionsDropdown, searchQuery]);

  const handleSearch = async () => {
      setShowSuggestions(false);
      const query = searchQuery.trim();
      if (!query) return;

      const isWallet = isAddress(query);
      const isEns = query.toLowerCase().endsWith('.eth');

      if (isWallet) { 
          playClick(); 
          navigate(`/profile/${query}`); 
          // Also load diagnostics for this address
          try {
            setDiagnosticLoading(true);
            setDiagnosticError(null);
            const [stats, pnl] = await Promise.all([
              getUserActivityStats(query),
              getAccountPnlCurrent(query).catch(() => null),
            ]);
            setDiagnostic({
              address: query,
              label: ensNameForDisplay(query),
              txCount: stats.txCount,
              holdingsCount: stats.holdingsCount,
              equityValue: pnl ? Number(pnl.equity_value) : null,
              pnlPct: pnl ? Number(pnl.pnl_pct) : null,
            });
          } catch {
            setDiagnosticError('Failed to load diagnostics');
            setDiagnostic(null);
          } finally {
            setDiagnosticLoading(false);
          }
          return; 
      }

      if (isEns) {
          playClick();
          setIsResolving(true);
          try {
              // 1) Try canonical ENS on Ethereum mainnet
              const address = await resolveENS(query);
              if (address) {
                  navigate(`/profile/${address}`);
                  // diagnostics for resolved address
                  try {
                    setDiagnosticLoading(true);
                    setDiagnosticError(null);
                    const [stats, pnl] = await Promise.all([
                      getUserActivityStats(address),
                      getAccountPnlCurrent(address).catch(() => null),
                    ]);
                    setDiagnostic({
                      address,
                      label: query,
                      txCount: stats.txCount,
                      holdingsCount: stats.holdingsCount,
                      equityValue: pnl ? Number(pnl.equity_value) : null,
                      pnlPct: pnl ? Number(pnl.pnl_pct) : null,
                    });
                  } catch {
                    setDiagnosticError('Failed to load diagnostics');
                    setDiagnostic(null);
                  } finally {
                    setDiagnosticLoading(false);
                  }
                  return;
              }

              // 2) Fallback to Intuition account labels (old behavior)
              const matches = await searchAccountsByLabel(query);
              if (matches && matches.length > 0) {
                  navigate(`/profile/${matches[0].id}`);
                  return;
              }

              toast.error(`ENS IDENTITY NOT FOUND: ${query}`);
          } catch (e) { toast.error("ENS RESOLUTION FAILED"); } finally { setIsResolving(false); }
      } else { toast.error("INVALID WALLET OR ENS"); }
  };

  return (
    <div className="min-h-screen bg-[#020308] pt-24 pb-40 relative overflow-x-hidden min-w-0 w-full font-mono selection:bg-intuition-primary selection:text-black">
      {/* HUD OVERLAY EFFECTS */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-intuition-primary/5 rounded-full blur-[150px] animate-pulse pointer-events-none"></div>
      
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 relative z-10 min-w-0">
        
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto space-y-3">
          <p className={PAGE_HERO_EYEBROW}>Rankings &amp; reputation</p>
          <h1 className={PAGE_HERO_TITLE}>Leaderboards</h1>
          <p className={PAGE_HERO_BODY}>
            <span className="text-amber-200/95 font-sans font-semibold normal-case tracking-tight">
              Season 2 is the featured competition right now
            </span>
            {' — '}
            explore epochs and champions, then browse classic network rankings below.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2 text-intuition-primary">
            <Trophy size={18} className="shrink-0" aria-hidden />
            <span className="text-sm font-sans text-slate-400">Other tabs: stakers, PnL, support, claims.</span>
          </div>
        </div>

        {/* Navigation Tabs — Season 2 featured first (default tab) */}
        <div className="flex flex-wrap justify-center gap-3 mb-16 bg-black/40 p-2 border-2 border-slate-900 clip-path-slant backdrop-blur-xl relative z-20 shadow-2xl">
            {(
              [
                {
                  id: 'SEASON_2',
                  icon: Trophy,
                  label: 'SEASON 2',
                  color: 'bg-amber-400',
                  text: 'text-black',
                  glow: 'shadow-[0_0_28px_rgba(251,191,36,0.55)]',
                  featured: true,
                },
                { id: 'STAKERS', icon: Users, label: 'TOP STAKERS', color: 'bg-intuition-primary', text: 'text-black', glow: 'shadow-glow-blue' },
                { id: 'PNL', icon: TrendingUp, label: 'TOP PNL', color: 'bg-amber-500', text: 'text-black', glow: 'shadow-[0_0_25px_rgba(245,158,11,0.4)]' },
                { id: 'AGENTS_SUPPORT', icon: Shield, label: 'MOST SUPPORTED', color: 'bg-intuition-success', text: 'text-black', glow: 'shadow-[0_0_25px_#00ff9d]' },
                { id: 'AGENTS_CONTROVERSY', icon: Flame, label: 'Claim entropy', color: 'bg-intuition-danger', text: 'text-white', glow: 'shadow-glow-red' },
                { id: 'CLAIMS', icon: Activity, label: 'TOP CLAIMS', color: 'bg-[#a855f7]', text: 'text-white', glow: 'shadow-glow-purple' },
              ] as const
            ).map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                const featured = 'featured' in tab && tab.featured;

                return (
                    <button 
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          playClick();
                          const id = tab.id as LeaderboardType;
                          setActiveTab(id);
                          setSearchQuery('');
                          setSearchParams(
                            (prev) => {
                              const n = new URLSearchParams(prev);
                              n.set('tab', tabParamForLeaderboard(id));
                              return n;
                            },
                            { replace: true }
                          );
                        }}
                        onMouseEnter={playHover}
                        className={`relative min-h-[44px] px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-2 clip-path-slant font-black font-display text-xs tracking-[0.2em] transition-all duration-300 flex items-center gap-3 group ${
                            isActive 
                            ? `${tab.color} ${tab.text} ${tab.glow} border-transparent`
                            : featured
                              ? 'bg-black/50 border-amber-500/45 text-amber-100/90 hover:text-white hover:border-amber-400/70 ring-1 ring-amber-500/20'
                              : 'bg-black/40 border-slate-800 text-slate-500 hover:text-white hover:border-white/40'
                        }`}
                    >
                        {featured && (
                          <span
                            className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-sm bg-gradient-to-r from-orange-500 to-amber-400 text-[9px] font-black uppercase tracking-[0.2em] text-black shadow-[0_0_12px_rgba(251,146,60,0.6)] pointer-events-none"
                            aria-hidden
                          >
                            Hot
                          </span>
                        )}
                        <Icon size={16} className={isActive ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'} /> 
                        {tab.label}
                    </button>
                );
            })}
        </div>

        {/* SEARCH BAR - COMMAND LINE STYLE */}
        {(activeTab === 'STAKERS' || activeTab === 'PNL') && (
            <div className="max-w-3xl mx-auto mb-12 relative z-20 group">
                <div className="bg-black border-2 border-slate-900 p-1 clip-path-slant shadow-2xl group-hover:border-intuition-primary/40 transition-all duration-500">
                    <div className="flex items-center gap-0 bg-[#05080f]">
                        <div className="bg-intuition-primary/10 h-16 flex items-center px-6 border-r-2 border-slate-900">
                            <Terminal size={24} className="text-intuition-primary animate-pulse" />
                        </div>
                        <div className="flex-1 relative" ref={searchSuggestionsRef}>
                            <input 
                                ref={searchInputRef}
                                type="text" 
                                placeholder="QUERY_DATABASE: [WALLET_ADDRESS | ENS_NAME]" 
                                className="w-full h-16 bg-transparent text-white font-mono text-sm px-8 outline-none placeholder-slate-700 uppercase tracking-widest font-black"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                onFocus={() => isQueryNonAddress && setShowSuggestions(true)}
                                disabled={isResolving}
                            />
                            {showSuggestionsDropdown && createPortal(
                              <div
                                className="fixed bg-black border-2 border-intuition-primary/30 clip-path-slant shadow-2xl z-[100] max-h-64 overflow-y-auto"
                                style={
                                  dropdownRect
                                    ? { top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, minWidth: 280 }
                                    : { display: 'none' }
                                }
                              >
                                {suggestionsLoading && !suggestionsFetched ? (
                                  <div className="flex items-center gap-3 px-4 py-4 text-slate-400 font-mono text-xs">
                                    <Loader2 size={14} className="animate-spin" /> Searching…
                                  </div>
                                ) : (searchSuggestions.length > 0 || ensSuggestion) ? (
                                  <>
                                    {ensSuggestion && (
                                      <button
                                        type="button"
                                        onClick={() => { playClick(); setShowSuggestions(false); setSearchQuery(ensSuggestion.name); navigate(`/profile/${ensSuggestion.address}`); }}
                                        onMouseEnter={playHover}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-intuition-primary/10 border-b border-white/5"
                                      >
                                        <span className="text-intuition-primary font-mono text-xs font-black">{ensSuggestion.name}</span>
                                        <span className="text-slate-500 text-[10px] font-mono">ENS → {ensSuggestion.address.slice(0, 8)}...</span>
                                      </button>
                                    )}
                                    {searchSuggestions.map((acc) => (
                                      <button
                                        key={acc.id}
                                        type="button"
                                        onClick={() => { playClick(); setShowSuggestions(false); setSearchQuery(acc.label || acc.id); navigate(`/profile/${acc.id}`); }}
                                        onMouseEnter={playHover}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-intuition-primary/10 border-b border-white/5"
                                      >
                                        {acc.image && <img src={acc.image} alt="" className="w-8 h-8 rounded-full object-cover" />}
                                        <span className="text-white font-mono text-xs font-bold truncate">{acc.label || `${acc.id.slice(0, 10)}...`}</span>
                                      </button>
                                    ))}
                                  </>
                                ) : (
                                  <div className="px-4 py-3 text-slate-500 font-mono text-[10px] uppercase tracking-widest">
                                    No matches for “{q}”
                                  </div>
                                )}
                              </div>,
                              document.body
                            )}
                        </div>
                        {(() => {
                            const query = searchQuery.trim();
                            const isWallet = isAddress(query);
                            const isEns = query.toLowerCase().endsWith('.eth');
                            const isValidTarget = isWallet || isEns;
                            return (
                        <button 
                                onClick={handleSearch}
                                disabled={isResolving || !isValidTarget}
                                className={`h-16 px-10 font-black font-display text-sm tracking-widest flex items-center justify-center gap-3 transition-all duration-300 ${
                                    isValidTarget
                                    ? 'bg-intuition-primary text-black hover:bg-white cursor-pointer shadow-glow-blue' 
                                    : 'bg-transparent text-slate-800 cursor-not-allowed border-l-2 border-slate-900'
                                }`}
                            >
                                {isResolving ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                            </button>
                            );
                        })()}
                    </div>
                </div>
            </div>
        )}

        {/* Account diagnostics: shows stats for the last searched wallet / ENS */}
        {diagnostic && (
          <div className="max-w-3xl mx-auto mb-16 bg-black border-2 border-slate-900 clip-path-slant shadow-2xl relative z-10">
            <div className="px-5 py-4 border-b border-slate-800 bg-white/5 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em]">
                  Account diagnostics
                </span>
                <span className="text-sm font-black text-white font-mono uppercase tracking-[0.18em] truncate">
                  {diagnostic.label}
                </span>
                <span className="text-[10px] font-mono text-slate-500 tracking-widest truncate">
                  {diagnostic.address}
                </span>
              </div>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px] font-mono text-slate-200">
              <div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-slate-500 mb-1">
                  Transactions
                </div>
                <div className="text-xl font-black text-white">
                  {diagnostic.txCount}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-slate-500 mb-1">
                  Active holdings
                </div>
                <div className="text-xl font-black text-white">
                  {diagnostic.holdingsCount}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-slate-500 mb-1">
                  Equity / PnL
                </div>
                <div className="text-xs font-bold text-slate-300">
                  {diagnostic.equityValue != null
                    ? `${diagnostic.equityValue.toFixed(2)} ${CURRENCY_SYMBOL}`
                    : 'N/A'}
                  {diagnostic.pnlPct != null && (
                    <span className={`ml-2 ${diagnostic.pnlPct >= 0 ? 'text-intuition-success' : 'text-intuition-danger'}`}>
                      ({diagnostic.pnlPct >= 0 ? '+' : ''}{diagnostic.pnlPct.toFixed(2)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
            {diagnosticError && (
              <div className="px-5 pb-4 text-[10px] text-intuition-danger font-mono uppercase tracking-widest">
                {diagnosticError}
              </div>
            )}
          </div>
        )}

        {/* Content Area */}
        {activeTab === 'SEASON_2' ? (
          <div className="max-w-6xl mx-auto w-full animate-in fade-in duration-500">
            <Season2LeaderboardPanel />
          </div>
        ) : loading ? (
          <PageLoading
            variant="section"
            backLink={null}
            className="min-h-[500px]"
            message={activeTab === 'PNL' ? 'Loading PNL leaderboard…' : 'Loading rankings…'}
          />
        ) : error ? (
           <div className="flex flex-col items-center justify-center h-[500px] gap-10 text-center border-2 border-intuition-secondary/20 bg-[#050505] p-20 clip-path-slant shadow-glow-red">
              <ShieldAlert className="text-intuition-secondary animate-pulse" size={80} />
              <div className="space-y-4">
                <h2 className="text-4xl font-black text-white font-display tracking-widest text-glow-red">DATA_UPLINK_SEVERED</h2>
                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Core reconciliation failure detected in Sector_04.</p>
              </div>
              <button onClick={fetchData} className="px-12 py-5 bg-intuition-secondary text-white font-black hover:bg-white hover:text-black transition-all font-display uppercase text-sm flex items-center gap-4 clip-path-slant shadow-glow-red active:scale-95">
                 <RefreshCw size={18} /> RE-INITIALIZE_HANDSHAKE
              </button>
           </div>
        ) : data.length === 0 ? (
           <div className="text-center py-40 text-slate-800 font-mono border-2 border-dashed border-slate-900 bg-black/40 clip-path-slant font-black tracking-[0.5em] uppercase">
              [NULL_SET] No claim data
           </div>
        ) : activeTab === 'PNL' ? (
            <div
              id="network-pnl"
              className="bg-black border-2 border-slate-900 clip-path-slant overflow-hidden shadow-2xl relative group animate-in fade-in zoom-in-95 duration-500 scroll-mt-28"
            >
                <div className="p-4 sm:p-6 md:p-8 border-b-2 border-slate-900 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                   <div className="flex items-center gap-4">
                        <TrendingUp size={24} className="text-amber-500 animate-pulse shrink-0" />
                        <div>
                          <h3 className="font-black text-white font-display tracking-[0.2em] sm:tracking-[0.3em] uppercase text-lg sm:text-xl">PnL_Leaderboard</h3>
                          <p className="text-[11px] text-slate-500 font-sans font-medium normal-case tracking-normal mt-1 max-w-xl">
                            Network-wide realized PnL (all-time style rankings). Season 2 epochs live under the Season 2 tab.
                          </p>
                        </div>
                   </div>
                   <div className="text-[10px] text-slate-700 font-black uppercase tracking-[0.3em]">get_pnl_leaderboard</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono border-collapse min-w-[900px]">
                        <thead className="bg-[#080808] text-slate-700 text-[10px] font-black uppercase tracking-[0.3em] border-b-2 border-slate-900">
                            <tr>
                                <th className="px-4 md:px-10 py-4 md:py-6 w-24 text-center">RANK</th>
                                <th className="px-4 md:px-10 py-4 md:py-6">ACCOUNT</th>
                                <th className="px-4 md:px-10 py-4 md:py-6 text-right">TOTAL_PNL</th>
                                <th className="px-4 md:px-10 py-4 md:py-6 text-right">PNL_%</th>
                                <th className="px-4 md:px-10 py-4 md:py-6 text-right">WIN_RATE</th>
                                <th className="px-4 md:px-10 py-4 md:py-6 text-right">VOLUME</th>
                                <th className="px-4 md:px-10 py-4 md:py-6 text-right">RECON</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.map((item, i) => (
                                <tr
                                  key={item.id}
                                  id={i === 0 ? 'pnl-top-row' : undefined}
                                  className="hover:bg-white/5 transition-all group relative animate-in fade-in slide-in-from-bottom-2"
                                  style={{ animationDelay: `${i * 30}ms` }}
                                >
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-center font-black text-slate-700 text-base sm:text-lg group-hover:text-amber-500 transition-colors">#{String(item.rank || i + 1).padStart(2, '0')}</td>
                                    <td className="px-4 md:px-10 py-4 md:py-6">
                                        <div className="flex items-center gap-2 sm:gap-4 bg-slate-900/50 pr-4 sm:pr-6 rounded-none clip-path-slant border border-slate-800 group-hover:border-amber-500/40 transition-colors">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-none bg-black flex items-center justify-center overflow-hidden border-r border-slate-800 shrink-0">
                                                {item.image ? <img src={item.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" alt="" /> : <div className="text-sm sm:text-lg font-black text-slate-700">{item.label?.[0]}</div>}
                                            </div>
                                            <span className="font-black text-white text-xs sm:text-sm uppercase whitespace-nowrap max-w-[120px] sm:max-w-[180px] truncate tracking-tighter leading-none">{item.label}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-right">
                                        <div className={`font-display font-black text-base sm:text-xl tracking-normal leading-none mb-1 ${item.rawValue >= 0 ? 'text-intuition-success' : 'text-intuition-danger'}`}>{item.value}</div>
                                    </td>
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-right font-black text-white text-xs sm:text-sm">{(item.subject?.pnl_pct != null ? (Number(item.subject.pnl_pct) * 100).toFixed(2) : '—')}%</td>
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-right font-black text-white text-xs sm:text-sm">{(item.subject?.win_rate != null ? (Number(item.subject.win_rate) * 100).toFixed(0) : '—')}%</td>
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-right font-black text-slate-400 text-xs sm:text-sm">{item.subject?.total_volume_raw != null ? <span className="inline-flex items-baseline gap-1 justify-end">{formatMarketValue(formatEther(BigInt(item.subject.total_volume_raw)))} <CurrencySymbol size="sm" className="text-slate-500" /></span> : '—'}</td>
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-right">
                                        <Link to={`/profile/${item.id}`} className="inline-flex min-h-[44px] px-4 sm:px-6 md:px-8 py-2.5 bg-amber-500 text-black font-black text-[10px] uppercase clip-path-slant hover:bg-white shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all active:scale-95 tracking-widest items-center justify-center">
                                            PROFILE
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        ) : activeTab === 'CLAIMS' ? (
            <div className="bg-black border-2 border-slate-900 clip-path-slant overflow-hidden shadow-2xl relative group animate-in fade-in zoom-in-95 duration-500">
                <div className="p-4 sm:p-6 md:p-8 border-b-2 border-slate-900 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                   <div className="flex items-center gap-4">
                        <Activity size={24} className="text-[#a855f7] animate-pulse shrink-0" />
                        <h3 className="font-black text-white font-display tracking-[0.2em] sm:tracking-[0.3em] uppercase text-lg sm:text-xl">Semantic_Triple_Leaderboard</h3>
                   </div>
                   <div className="text-[10px] text-slate-700 font-black uppercase tracking-[0.3em]">L3_Network_Convergence</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono border-collapse min-w-[1000px]">
                        <thead className="bg-[#080808] text-slate-700 text-[10px] font-black uppercase tracking-[0.3em] border-b-2 border-slate-900">
                            <tr>
                                <th className="px-4 md:px-10 py-4 md:py-6 w-24 text-center">RANK</th>
                                <th className="px-4 md:px-10 py-4 md:py-6">SEMANTIC_TRIPLE (SUBJECT &rarr; PREDICATE &rarr; OBJECT)</th>
                                <th className="px-4 md:px-10 py-4 md:py-6 text-right">MARKET_CAPITALIZATION</th>
                                <th className="px-4 md:px-10 py-4 md:py-6 text-right">HANDSHAKE</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.map((item, i) => (
                                <tr key={item.id} className="hover:bg-white/5 transition-all group relative animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${i * 30}ms` }}>
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-center font-black text-slate-700 text-base sm:text-lg group-hover:text-[#a855f7] transition-colors">#{(i+1).toString().padStart(2, '0')}</td>
                                    <td className="px-4 md:px-10 py-4 md:py-6">
                                        <div className="flex flex-col md:flex-row items-center gap-3 sm:gap-4">
                                            <div className="flex items-center gap-4 bg-slate-900/50 pr-6 rounded-none clip-path-slant border border-slate-800 group-hover:border-[#a855f7]/40 transition-colors">
                                                <div className="w-12 h-12 rounded-none bg-black flex items-center justify-center overflow-hidden border-r border-slate-800">
                                                    {item.subject?.image ? <img src={item.subject.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" /> : <div className="text-lg font-black text-slate-700">{item.subject?.label?.[0]}</div>}
                                                </div>
                                                <span className="font-black text-white text-sm uppercase whitespace-nowrap max-w-[140px] truncate tracking-tighter leading-none">{item.subject?.label}</span>
                                            </div>
                                            
                                            <div className="px-4 py-1 bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/40 text-[9px] font-black uppercase whitespace-nowrap shadow-[0_0_15px_rgba(168,85,247,0.3)] clip-path-slant animate-pulse">
                                                {item.predicate || 'LINK'}
                                            </div>
                                            
                                            <div className="flex items-center gap-4 bg-slate-900/50 pr-6 rounded-none clip-path-slant border border-slate-800 group-hover:border-[#a855f7]/40 transition-colors">
                                                <div className="w-12 h-12 rounded-none bg-black flex items-center justify-center overflow-hidden border-r border-slate-800">
                                                    {item.object?.image ? <img src={item.object.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" /> : <div className="text-lg font-black text-slate-700">{item.object?.label?.[0]}</div>}
                                                </div>
                                                <span className="font-black text-white text-sm uppercase whitespace-nowrap max-w-[140px] truncate tracking-tighter leading-none">{item.object?.label}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-right">
                                        <div className="font-display font-black text-white text-base sm:text-xl group-hover:text-[#a855f7] group-hover:text-glow-purple transition-all tracking-normal leading-none mb-1">{item.value}</div>
                                        <div className="text-[8px] text-slate-700 font-black uppercase inline-flex items-baseline gap-0.5"><CurrencySymbol size="sm" />_UNITS</div>
                                    </td>
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-right">
                                        <Link to={`/markets/${item.id}`} className="inline-flex min-h-[44px] px-4 sm:px-6 md:px-8 py-2.5 bg-[#a855f7] text-white font-black text-[10px] uppercase clip-path-slant hover:bg-white hover:text-black shadow-glow-purple transition-all active:scale-95 tracking-widest items-center justify-center">
                                            TRADE
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        ) : (
          <div className="space-y-12">
             {/* TOP 3 PODIUM - ARCADE HUD STYLE */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-24 mt-36 items-end relative">
                {[1, 0, 2].map(orderIdx => {
                    const item = data[orderIdx];
                    if (!item) return null;
                    const isFirst = orderIdx === 0;
                    
                    let rankStyles = { border: '', shadow: '', text: '', glow: '', bg: '' };
                    let accentColorClass = activeTab === 'AGENTS_CONTROVERSY' ? 'text-intuition-secondary text-glow-red' : activeTab === 'AGENTS_SUPPORT' ? 'text-intuition-success text-glow-success' : 'text-intuition-primary text-glow-blue';

                    if (isFirst) { // GOLD
                        rankStyles = { 
                            border: 'border-intuition-warning', 
                            shadow: 'shadow-[0_0_80px_rgba(250,204,21,0.2)]', 
                            text: 'text-intuition-warning', 
                            glow: 'text-glow-gold', 
                            bg: 'bg-intuition-warning/5'
                        };
                    } else if (orderIdx === 1) { // SILVER
                        rankStyles = { 
                            border: 'border-slate-300', 
                            shadow: 'shadow-[0_0_50px_rgba(255,255,255,0.1)]', 
                            text: 'text-slate-200', 
                            glow: 'text-glow-white', 
                            bg: 'bg-slate-500/5'
                        };
                    } else { // BRONZE
                        rankStyles = { 
                            border: 'border-[#ff5f00]', 
                            shadow: 'shadow-[0_0_50px_rgba(255,95,0,0.1)]', 
                            text: 'text-[#ff5f00]', 
                            glow: 'text-shadow', 
                            bg: 'bg-[#ff5f00]/5'
                        };
                    }

                    return (
                        <div key={item.id} className={`${isFirst ? '-mt-16 z-20 scale-110' : 'z-10'} transform transition-all duration-700 hover:-translate-y-2`}>
                            {isFirst && (
                                <div className="flex justify-center mb-4">
                                    <Crown size={56} className="text-intuition-warning fill-intuition-warning drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse" />
                                </div>
                            )}
                            
                            <div className={`relative bg-black border-4 p-8 flex flex-col items-center clip-path-slant h-full group ${rankStyles.border} ${rankStyles.shadow} ${rankStyles.bg} transition-all duration-500`}>
                                <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center font-black font-display rounded-full border-4 bg-black text-xl ${rankStyles.text} ${rankStyles.border} shadow-[0_0_15px_currentColor] z-30`}>
                                    {orderIdx + 1}
                                </div>
                                
                                <div className={`w-32 h-32 mb-8 rounded-none clip-path-slant overflow-hidden border-2 bg-slate-900 flex items-center justify-center text-4xl shadow-2xl group-hover:scale-110 transition-transform duration-1000 ${rankStyles.border}`}>
                                    {item.image ? <img src={item.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" /> : <div className="text-3xl font-black text-slate-800">{item.label?.[0]}</div>}
                                </div>
                                
                                <div className="flex flex-col items-center gap-1.5 mb-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-black text-white text-xl truncate max-w-full group-hover:text-intuition-primary transition-all uppercase tracking-tighter leading-none`}>{item.label}</h3>
                                        {item.verified && <BadgeCheck size={16} className="text-intuition-primary animate-pulse" />}
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-mono uppercase tracking-[0.4em] font-black">{item.subLabel}</p>
                                </div>
                                
                                <div className={`mt-auto font-black font-display text-3xl tracking-tighter leading-none ${accentColorClass}`}>
                                    {item.value}
                                </div>
                                
                                <Link 
                                    to={activeTab === 'STAKERS' ? `/profile/${item.id}` : `/markets/${item.id}`} 
                                    className="absolute inset-0 z-40" 
                                    onClick={playClick} 
                                />
                            </div>
                        </div>
                    );
                })}
             </div>

             {/* The List (Rank 4+) - MONOLITHIC ARES TABLE */}
             <div className="bg-black border-2 border-slate-900 overflow-hidden clip-path-slant relative shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-intuition-primary/40 to-transparent opacity-50"></div>
                <div className="overflow-x-auto">
                <table className="w-full text-left font-mono border-collapse min-w-[320px]">
                    <thead className="bg-[#080808] text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] sm:tracking-[0.4em] border-b-2 border-slate-900">
                        <tr>
                            <th className="px-4 md:px-10 py-4 md:py-6 w-20 sm:w-24 text-center">RANK</th>
                            <th className="px-4 md:px-10 py-4 md:py-6">ENTITY_IDENTITY</th>
                            <th className="px-4 md:px-10 py-4 md:py-6 text-right">METRIC_VOLUME</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.slice(3).map((item, i) => {
                            let accentColorClass = activeTab === 'AGENTS_CONTROVERSY' ? 'text-intuition-secondary text-glow-red' : activeTab === 'AGENTS_SUPPORT' ? 'text-intuition-success text-glow-success' : 'text-intuition-primary text-glow-blue';
                            
                            return (
                                <tr 
                                    key={item.id} 
                                    className="hover:bg-white/5 transition-all group relative animate-in fade-in slide-in-from-bottom-4" 
                                    style={{ animationDelay: `${i * 20}ms` }}
                                >
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-center font-black text-slate-700 text-lg sm:text-xl group-hover:text-intuition-primary transition-colors">
                                        #{(i+4).toString().padStart(2, '0')}
                                    </td>
                                    <td className="px-4 md:px-10 py-4 md:py-6">
                                        <div className="flex items-center gap-3 sm:gap-6">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-none clip-path-slant bg-slate-950 flex items-center justify-center text-xs overflow-hidden border-2 border-slate-800 group-hover:border-intuition-primary transition-all duration-500 shadow-xl shrink-0">
                                                {item.image ? <img src={item.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" /> : <div className="text-sm sm:text-lg font-black text-slate-800">{item.label?.[0]}</div>}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 sm:gap-3 mb-1.5">
                                                    <div className="font-black text-white text-base sm:text-xl group-hover:text-intuition-primary transition-colors uppercase tracking-tight leading-none truncate">{item.label}</div>
                                                    {item.verified ? (
                                                        <BadgeCheck size={14} className="text-intuition-primary shrink-0 sm:w-4 sm:h-4" title="System Verified" />
                                                    ) : (
                                                        <UserCog size={12} className="text-slate-700 shrink-0 sm:w-[14px] sm:h-[14px]" title="User Node" />
                                                    )}
                                                </div>
                                                <div className="text-[8px] text-slate-600 font-mono uppercase tracking-[0.3em] font-black truncate">{item.subLabel}</div>
                                            </div>
                                        </div>
                                        <Link 
                                            to={activeTab === 'STAKERS' ? `/profile/${item.id}` : `/markets/${item.id}`} 
                                            className="absolute inset-0" 
                                            onClick={playClick} 
                                        />
                                    </td>
                                    <td className="px-4 md:px-10 py-4 md:py-6 text-right">
                                        <div className={`font-display font-black text-xl sm:text-2xl tracking-tighter leading-none mb-1 ${accentColorClass} group-hover:text-white transition-colors`}>
                                            {item.value}
                                        </div>
                                        <div className="text-[8px] text-slate-700 font-black uppercase tracking-widest">PROTOCOL_MAGNITUDE</div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;
