
import React, { useEffect, useState, useRef } from 'react';
import { Shield, Activity, Users, Database, Zap, Download, RefreshCw, FileText, Globe, Terminal, Award, ArrowUpRight, BarChart3, TrendingUp, Loader2, UserCircle, BadgeCheck, Network, Cpu, Lock, Coins, PieChart, Clock, Box, ShieldCheck } from 'lucide-react';
import { getNetworkKPIs } from '../services/graphql';
import { formatEther } from 'viem';
import { PageLoading } from '../components/PageLoading';
import { playClick, playHover } from '../services/audio';
import { toast } from '../components/Toast';
import html2canvas from 'html2canvas';
import { CURRENCY_SYMBOL, FEE_PROXY_ADDRESS, PAGE_HERO_EYEBROW, PAGE_HERO_TITLE } from '../constants';
import { CurrencySymbol } from '../components/CurrencySymbol';
import { getWalletBalance } from '../services/web3';

const KPIStatCard = ({ label, value, sub, icon: Icon, color = "primary", animate = false, isZero = false }: { label: string; value: string | number; sub: string | React.ReactNode; icon: any; color?: string; animate?: boolean; isZero?: boolean }) => {
    const isPrimary = color === "primary";
    const accentColor = isPrimary ? 'text-intuition-primary' : 'text-intuition-secondary';
    const accentGlow = isPrimary ? 'text-glow-blue' : 'text-glow-red';
    const borderColor = isPrimary ? 'border-intuition-primary/30' : 'border-intuition-secondary/30';
    const bgGlow = isPrimary ? 'bg-intuition-primary/10' : 'bg-intuition-secondary/10';
    const iconBgGlow = isPrimary ? 'shadow-glow-blue' : 'shadow-glow-red';

    return (
        <div className={`p-5 bg-black border-2 ${borderColor} clip-path-slant relative group overflow-hidden shadow-xl transition-all duration-500 hover:border-white/40 hover:shadow-[0_0_30px_rgba(255,255,255,0.06)]`}>
            <div className={`absolute inset-0 ${bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
            <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-all duration-700 group-hover:scale-110 ${isPrimary ? 'text-intuition-primary' : 'text-intuition-secondary'}`}>
                <Icon size={60} className={animate ? 'animate-pulse' : ''} />
            </div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex flex-col gap-1">
                    <span className={`text-xs font-sans font-semibold tracking-wide text-slate-400 group-hover:text-white ${isPrimary ? 'group-hover:text-glow-blue' : 'group-hover:text-glow-red'} transition-all duration-300`}>{label}</span>
                    <div className={`h-px w-8 ${isPrimary ? 'bg-intuition-primary' : 'bg-intuition-secondary'} opacity-60 group-hover:w-full group-hover:opacity-100 transition-all duration-700 shadow-[0_0_8px_currentColor]`}></div>
                </div>
                <div className={`p-2 bg-black border border-white/10 clip-path-slant ${accentColor} ${iconBgGlow} ${animate ? 'animate-pulse' : ''} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={14} />
                </div>
            </div>

            <div className="relative z-10 flex items-baseline gap-2">
                <div className={`text-2xl md:text-3xl font-black text-white font-display tracking-tight leading-none group-hover:text-glow-white transition-all duration-300 ${isZero ? 'opacity-30' : ''}`}>
                    {value}
                </div>
                <span className={`text-xs font-sans font-medium tracking-wide ${accentColor} ${accentGlow} inline-flex items-baseline`}>{sub}</span>
            </div>
            {isZero && (
                <div className="absolute bottom-3 left-5 text-[10px] font-medium text-slate-500 animate-pulse font-sans">
                    No protocol activity yet
                </div>
            )}
        </div>
    );
};

const KPIDashboard: React.FC = () => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [reconLog, setReconLog] = useState<string[]>([]);
    const [userBalances, setUserBalances] = useState<Record<string, string>>({});

    const addLog = (msg: string) => {
        setReconLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-8));
    };

    const fetchData = async () => {
        setLoading(true);
        setReconLog([]);
        addLog("Loading network metrics…");
        
        try {
            await new Promise(r => setTimeout(r, 1200)); 
            addLog("Reading subgraph…");
            addLog("Fetching fee proxy stats…");
            const data = await getNetworkKPIs();
            
            if (data.txCount > 0) {
                addLog(`Found ${data.txCount} fee proxy transactions.`);
                addLog(`${data.userCount} accounts in the leaderboard.`);
                addLog(`Fee proxy TVL: ${parseFloat(formatEther(BigInt(data.proxyTVL))).toFixed(4)} ${CURRENCY_SYMBOL}.`);
                toast.success("Stats updated");

                // Fetching top user balances asynchronously for the "Fun" part
                const topUsers = data.userLedger.slice(0, 15);
                addLog("Loading wallet balances…");
                const balanceMap: Record<string, string> = {};
                for(const user of topUsers) {
                    try {
                        const b = await getWalletBalance(user.id);
                        balanceMap[user.id] = parseFloat(b).toLocaleString(undefined, { maximumFractionDigits: 2 });
                    } catch { balanceMap[user.id] = "0.00"; }
                }
                setUserBalances(balanceMap);
            } else {
                addLog("No fee proxy transactions in this window.");
                addLog("Try again later or check your connection.");
            }
            
            setStats(data);
        } catch (e) {
            addLog("Could not load data (timeout or network error).");
            toast.error("Failed to load stats");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleExport = async () => {
        if (!reportRef.current) return;
        playClick();
        setIsExporting(true);
        toast.info("Saving image…");

        try {
            const canvas = await html2canvas(reportRef.current, {
                backgroundColor: '#020308',
                scale: 2,
                useCORS: true,
                logging: false
            });
            
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `inturank-ares-audit-${new Date().getTime()}.png`;
            link.click();
            toast.success("Image downloaded");
        } catch (e) {
            toast.error("Export failed");
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return <PageLoading message="Loading system health…" backLink={null} />;
    }

    const formattedProxyTVL = parseFloat(formatEther(BigInt(stats?.proxyTVL || '0'))).toLocaleString(undefined, { maximumFractionDigits: 4 });
    const formattedGlobalTVL = parseFloat(formatEther(BigInt(stats?.globalTVL || '0'))).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const isProxyEmpty = !stats || stats.txCount === 0;
    
    // High-precision formatting for market share magnitude
    const marketShareVal = stats?.marketShare || 0;
    const formattedMarketShare = marketShareVal > 0 && marketShareVal < 0.01 
        ? marketShareVal.toFixed(4) 
        : marketShareVal.toFixed(2);

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-10 pb-24 font-sans min-w-0">
            {/* Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between mb-12 gap-6 border-b border-white/10 pb-8">
                <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 text-slate-500">
                        <ShieldCheck size={16} className="shrink-0 text-intuition-secondary/90" aria-hidden />
                        <p className={PAGE_HERO_EYEBROW}>Intuition Mainnet · operator metrics</p>
                    </div>
                    <h1 className={`${PAGE_HERO_TITLE} mobile-break`}>System health</h1>
                </div>
                
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={fetchData}
                        className="px-6 py-3 bg-black border border-slate-800 text-slate-400 hover:text-white hover:border-white transition-all clip-path-slant flex items-center gap-3 text-xs font-semibold tracking-wide group"
                    >
                        <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" /> Refresh
                    </button>
                    <button 
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-8 py-3 bg-intuition-secondary text-white font-semibold text-xs tracking-wide clip-path-slant hover:bg-white hover:text-black shadow-glow-red transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        Export screenshot
                    </button>
                </div>
            </div>

            {/* Container */}
            <div ref={reportRef} className="space-y-8 bg-transparent relative">
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none z-0 overflow-hidden select-none">
                    <span className="text-[18rem] font-black rotate-[-20deg] whitespace-nowrap">Intuition</span>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
                    <KPIStatCard label="Fee proxy TVL" value={formattedProxyTVL} sub={<CurrencySymbol size="md" />} icon={Coins} color="secondary" animate={!isProxyEmpty} isZero={isProxyEmpty} />
                    <KPIStatCard label="Accounts tracked" value={stats?.userCount || 0} sub="wallets" icon={Users} color="primary" isZero={isProxyEmpty} />
                    <KPIStatCard label="Fee proxy transactions" value={stats?.txCount || 0} sub="all time" icon={Box} color="secondary" animate={!isProxyEmpty} isZero={isProxyEmpty} />
                    <KPIStatCard label="Market share" value={`${formattedMarketShare}%`} sub="of activity" icon={PieChart} color="primary" isZero={isProxyEmpty} />
                    <KPIStatCard label="Atoms on graph" value={stats?.atomCount || 0} sub="nodes" icon={Database} color="secondary" isZero={isProxyEmpty} />
                </div>

                <div className="grid grid-cols-1 gap-8 relative z-10">
                    {/* Citizen Ledger: full width so it scales with viewport */}
                    <div className="w-full min-w-0">
                        <div className="bg-[#02040a] border border-slate-900 clip-path-slant shadow-2xl overflow-hidden">
                            <div className="p-6 border-b border-slate-900 bg-white/[0.02] flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <Activity size={24} className="text-intuition-secondary animate-pulse" />
                                    <h3 className="font-bold text-white font-display tracking-tight text-lg">Account leaderboard</h3>
                                </div>
                                <div className="text-[10px] text-slate-600 font-medium hidden sm:block">By volume through the fee proxy</div>
                            </div>
                            <div className="overflow-x-auto min-h-[400px]">
                                {stats?.userLedger?.length > 0 ? (
                                    <table className="w-full text-left font-sans table-fixed">
                                        <colgroup>
                                            <col style={{ width: '4%' }} />
                                            <col style={{ width: '28%' }} />
                                            <col style={{ width: '10%' }} />
                                            <col style={{ width: '18%' }} />
                                            <col style={{ width: '22%' }} />
                                            <col style={{ width: '18%' }} />
                                        </colgroup>
                                        <thead className="bg-[#080808] text-slate-400 text-xs sm:text-sm font-semibold border-b border-slate-800">
                                            <tr>
                                                <th className="px-3 sm:px-4 py-4 w-12 text-center">#</th>
                                                <th className="px-3 sm:px-4 py-4">Account</th>
                                                <th className="px-3 sm:px-4 py-4 text-center">Transactions</th>
                                                <th className="px-3 sm:px-4 py-4 text-right whitespace-nowrap">Volume</th>
                                                <th className="px-3 sm:px-4 py-4 text-right whitespace-nowrap">{`${CURRENCY_SYMBOL} balance`}</th>
                                                <th className="px-3 sm:px-4 py-4 text-right whitespace-nowrap">Tier</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {stats.userLedger.map((user: any, i: number) => (
                                                <tr key={user.id} className="hover:bg-white/5 transition-all group cursor-pointer">
                                                    <td className="px-3 sm:px-4 py-5 text-center">
                                                        <span className="text-sm sm:text-base font-black text-slate-400 group-hover:text-white transition-colors tabular-nums">{i + 1}</span>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-5 min-w-0">
                                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                                            <div className="w-10 h-10 bg-black border border-slate-800 clip-path-slant flex items-center justify-center overflow-hidden group-hover:border-intuition-secondary transition-all shrink-0">
                                                                {user.image ? <img src={user.image} className="w-full h-full object-cover" alt="" /> : <UserCircle size={20} className="text-slate-600" />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-sm font-semibold text-white group-hover:text-intuition-secondary transition-colors truncate">{user.label || user.id.slice(0, 14)}</div>
                                                                <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">{user.id}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-5 text-center">
                                                        <div className="text-base sm:text-lg font-black text-white font-display group-hover:text-glow-white leading-none tabular-nums">{user.txCount}</div>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-5 text-right whitespace-nowrap">
                                                        <div className="text-base sm:text-lg font-black text-intuition-success font-mono group-hover:text-glow-success leading-none tabular-nums">
                                                            {user.volume.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-5 text-right whitespace-nowrap">
                                                        <div className="text-sm font-black text-intuition-primary font-mono group-hover:text-glow-blue leading-none tabular-nums">
                                                            {userBalances[user.id] || "0.00"}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 mt-1 font-medium">Wallet balance</div>
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-5 text-right whitespace-nowrap">
                                                        <span className={`inline-block px-3 py-1.5 border text-xs font-semibold clip-path-slant ${i < 3 ? 'border-intuition-secondary text-intuition-secondary bg-intuition-secondary/10 shadow-glow-red' : 'border-slate-600 text-slate-400'}`}>
                                                            {i < 3 ? 'Top 3' : 'Standard'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[400px] space-y-6">
                                        <Shield size={60} className="text-slate-900 animate-pulse" />
                                        <p className="text-slate-500 text-sm font-medium">No ledger data yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar: full-width grid below ledger so table gets all horizontal space */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full lg:items-stretch">
                        {/* Activity log */}
                        <div className="bg-black border border-intuition-primary/20 p-6 clip-path-slant shadow-2xl group hover:border-intuition-primary/40 hover:shadow-[0_0_25px_rgba(0,243,255,0.08)] transition-all duration-500 h-full flex flex-col min-h-[220px]">
                            <div className="flex items-center gap-3 mb-6 border-b border-intuition-primary/20 pb-3">
                                <Terminal size={14} className="text-intuition-primary animate-pulse text-glow-blue" />
                                <h4 className="text-sm font-semibold text-intuition-primary text-glow-blue">Activity log</h4>
                            </div>
                            <div className="space-y-3 font-sans text-xs sm:text-sm min-h-[160px] flex-1">
                                {reconLog.map((log, i) => (
                                    <div key={i} className="text-slate-400 group-hover:text-intuition-primary transition-colors duration-300 leading-relaxed border-l-2 border-intuition-primary/30 pl-3 group-hover:border-intuition-primary/60">
                                        <span className="group-hover:text-glow-blue">{log}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gauges */}
                        <div className="bg-[#020308] border border-intuition-primary/20 p-8 clip-path-slant shadow-2xl relative overflow-hidden group hover:border-intuition-primary/40 hover:shadow-[0_0_25px_rgba(0,243,255,0.08)] transition-all duration-500 h-full flex flex-col min-h-[220px]">
                            <h4 className="text-sm font-semibold text-intuition-primary mb-8 flex items-center gap-3 text-glow-blue">
                                <Cpu size={16} className="animate-pulse shrink-0" /> Network snapshot
                            </h4>
                            <div className="space-y-8 flex-1 flex flex-col justify-center">
                                <div className="group/diag">
                                    <div className="flex justify-between items-end mb-2 gap-2">
                                        <span className="text-xs text-slate-400 font-medium group-hover/diag:text-intuition-primary group-hover/diag:text-glow-blue transition-all">Network TVL</span>
                                        <span className="text-sm font-bold text-white text-glow-white inline-flex items-baseline gap-1 tabular-nums">{formattedGlobalTVL} <CurrencySymbol size="md" /></span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-950 overflow-hidden border border-white/10 rounded-none">
                                        <div className="h-full bg-intuition-primary/40 group-hover/diag:bg-intuition-primary group-hover/diag:shadow-glow-blue transition-all duration-500" style={{ width: '100%' }}></div>
                                    </div>
                                </div>
                                <div className="group/diag">
                                    <div className="flex justify-between items-end mb-2 gap-2">
                                        <span className="text-xs text-slate-400 font-medium group-hover/diag:text-intuition-secondary group-hover/diag:text-glow-red transition-all">Avg. TVL per transaction</span>
                                        <span className={`text-sm font-bold tabular-nums shrink-0 ${isProxyEmpty ? 'text-slate-600' : 'text-intuition-secondary text-glow-red'}`}>
                                            {stats?.txCount > 0 ? (parseFloat(formatEther(BigInt(stats.proxyTVL))) / stats.txCount).toFixed(4) : "0.0000"}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-950 overflow-hidden border border-white/10 rounded-none">
                                        <div className={`h-full bg-intuition-secondary shadow-glow-red transition-all duration-1000 ${!isProxyEmpty ? 'animate-pulse' : ''}`} style={{ width: isProxyEmpty ? '0%' : '50%' }}></div>
                                    </div>
                                </div>
                                <div className="group/diag">
                                    <div className="flex justify-between items-end mb-2 gap-2">
                                        <span className="text-xs text-slate-400 font-medium group-hover/diag:text-intuition-primary transition-colors">Indexer sync</span>
                                        <span className="text-xs font-semibold text-intuition-primary text-glow-blue animate-pulse">Live</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-950 overflow-hidden border border-white/10 rounded-none relative">
                                        <div className="h-full bg-intuition-primary shadow-glow-blue animate-buffer-fill"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fee proxy */}
                        <div className="bg-[#050505] border-2 border-intuition-secondary/30 p-8 clip-path-slant shadow-2xl relative overflow-hidden group hover:border-intuition-secondary/60 hover:shadow-[0_0_30px_rgba(255,30,109,0.12)] transition-all duration-500 h-full flex flex-col min-h-[220px]">
                             <div className="relative z-10 flex flex-col flex-1">
                                <div className="flex items-center gap-4 mb-6">
                                    <Lock size={18} className="text-intuition-secondary animate-pulse text-glow-red shrink-0" />
                                    <h4 className="text-sm font-semibold text-intuition-secondary text-glow-red">Fee proxy contract</h4>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed font-medium group-hover:text-slate-300 transition-colors flex-1 flex flex-col">
                                    <span className="mb-2">Address (read-only)</span>
                                    <span className="text-intuition-primary/90 font-mono font-semibold select-all break-all py-3 px-4 bg-white/5 border border-intuition-primary/20 clip-path-slant text-xs sm:text-sm text-glow-blue group-hover:border-intuition-primary/40 transition-all">{FEE_PROXY_ADDRESS}</span>
                                </p>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-16 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 opacity-40 group-hover:opacity-70 transition-all duration-1000">
                    <div className="flex items-center gap-6">
                         <div className="w-12 h-12 bg-black border border-white/10 flex items-center justify-center text-white clip-path-slant group-hover:border-intuition-primary transition-colors">
                             <Shield size={24} strokeWidth={1.5} />
                         </div>
                         <div>
                             <div className="text-xs font-semibold font-display text-white mb-1">IntuRank health report</div>
                             <div className="text-[10px] font-medium text-slate-500">On-chain metrics · subgraph + fee proxy</div>
                         </div>
                    </div>
                    <div className="text-left sm:text-right flex flex-col items-start sm:items-end gap-1">
                         <div className="text-xs font-medium text-slate-300">{new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
                         <div className="text-[10px] font-medium text-slate-600">Exported view · not financial advice</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KPIDashboard;
