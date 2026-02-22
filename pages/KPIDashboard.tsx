
import React, { useEffect, useState, useRef } from 'react';
import { Shield, Activity, Users, Database, Zap, Download, RefreshCw, FileText, Globe, Terminal, Award, ArrowUpRight, BarChart3, TrendingUp, Loader2, UserCircle, BadgeCheck, Network, Cpu, Lock, Coins, PieChart, Clock, Box, ShieldCheck } from 'lucide-react';
import { getNetworkKPIs } from '../services/graphql';
import { formatEther } from 'viem';
import { playClick, playHover } from '../services/audio';
import { toast } from '../components/Toast';
import html2canvas from 'html2canvas';
import { CURRENCY_SYMBOL } from '../constants';
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
                    <span className={`text-[9px] font-mono uppercase tracking-[0.3em] font-black text-slate-400 group-hover:text-white ${isPrimary ? 'group-hover:text-glow-blue' : 'group-hover:text-glow-red'} transition-all duration-300`}>{label}</span>
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
                <span className={`text-[10px] font-black uppercase tracking-widest ${accentColor} ${accentGlow} inline-flex items-baseline`}>{sub}</span>
            </div>
            {isZero && (
                <div className="absolute bottom-3 left-5 text-[7px] font-black text-slate-500 uppercase tracking-widest animate-pulse font-mono">
                    // Recon_Pending_Signal
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
        addLog("INITIALIZING_ARES_RECON_SEQUENCE...");
        
        try {
            await new Promise(r => setTimeout(r, 1200)); 
            addLog("SCANNING_CONTRACT_HASH_VARIANTS...");
            addLog("QUERYING_INTUITION_L3_SUBGRAPH_BUFFERS...");
            const data = await getNetworkKPIs();
            
            if (data.txCount > 0) {
                addLog(`SUCCESS: ${data.txCount} proxy transactions reconciled.`);
                addLog(`IDENTITY_MAP: ${data.userCount} citizens verified.`);
                addLog(`VALUATION: ${parseFloat(formatEther(BigInt(data.proxyTVL))).toFixed(4)} ${CURRENCY_SYMBOL}.`);
                toast.success("TELEMETRY_SYNCED");

                // Fetching top user balances asynchronously for the "Fun" part
                const topUsers = data.userLedger.slice(0, 15);
                addLog("POLLING_WALLET_BALANCES_VIA_RPC...");
                const balanceMap: Record<string, string> = {};
                for(const user of topUsers) {
                    try {
                        const b = await getWalletBalance(user.id);
                        balanceMap[user.id] = parseFloat(b).toLocaleString(undefined, { maximumFractionDigits: 2 });
                    } catch { balanceMap[user.id] = "0.00"; }
                }
                setUserBalances(balanceMap);
            } else {
                addLog("WARNING: NULL_SET recovered.");
                addLog("ACTION: PERSISTING_MONITOR_THREAD...");
            }
            
            setStats(data);
        } catch (e) {
            addLog("CRITICAL: UPLINK_TIMEOUT.");
            toast.error("RECON_FAILURE");
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
        toast.info("ENCRYPTING_REPORT...");

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
            toast.success("REPORT_SECURED");
        } catch (e) {
            toast.error("EXPORT_FAILURE");
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-10 text-intuition-primary font-mono bg-black">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-intuition-primary/10 border-t-intuition-primary rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity size={24} className="animate-pulse" />
                    </div>
                </div>
                <div className="space-y-4 text-center">
                    <span className="text-[10px] font-black tracking-[0.8em] uppercase animate-pulse">Establishing_Link...</span>
                    <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-intuition-primary animate-marquee w-1/3"></div>
                    </div>
                </div>
            </div>
        );
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
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-10 pb-24 font-mono min-w-0 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between mb-12 gap-6 border-b border-slate-900 pb-8">
                <div>
                    <div className="flex items-center gap-3 text-intuition-secondary mb-2">
                        <ShieldCheck size={16} className="animate-pulse shadow-glow-red" />
                        <span className="text-[10px] font-black tracking-[0.5em] uppercase">Sector_04_ARES_Audit</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white font-display tracking-tighter uppercase text-glow-red leading-tight mobile-break min-w-0">
                        INTERNAL_KPI_DECK
                    </h1>
                </div>
                
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={fetchData}
                        className="px-6 py-3 bg-black border border-slate-800 text-slate-500 hover:text-white hover:border-white transition-all clip-path-slant flex items-center gap-3 uppercase text-[9px] font-black tracking-widest group"
                    >
                        <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" /> RE-SYNC
                    </button>
                    <button 
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-8 py-3 bg-intuition-secondary text-white font-black uppercase text-[9px] tracking-widest clip-path-slant hover:bg-white hover:text-black shadow-glow-red transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        EXPORT_REPORT
                    </button>
                </div>
            </div>

            {/* Container */}
            <div ref={reportRef} className="space-y-8 bg-transparent relative">
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none z-0 overflow-hidden select-none">
                    <span className="text-[18rem] font-black rotate-[-20deg] whitespace-nowrap">SOVEREIGN</span>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
                    <KPIStatCard label="Ingress Volume" value={formattedProxyTVL} sub={<CurrencySymbol size="md" />} icon={Coins} color="secondary" animate={!isProxyEmpty} isZero={isProxyEmpty} />
                    <KPIStatCard label="Verified Citizens" value={stats?.userCount || 0} sub="WALLETS" icon={Users} color="primary" isZero={isProxyEmpty} />
                    <KPIStatCard label="Protocol Transactions" value={stats?.txCount || 0} sub="ALL_TIME" icon={Box} color="secondary" animate={!isProxyEmpty} isZero={isProxyEmpty} />
                    <KPIStatCard label="Market Power" value={`${formattedMarketShare}%`} sub="MAGNITUDE" icon={PieChart} color="primary" isZero={isProxyEmpty} />
                    <KPIStatCard label="Semantic Nodes" value={stats?.atomCount || 0} sub="ATOMS" icon={Database} color="secondary" isZero={isProxyEmpty} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                    {/* Main Table */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-[#02040a] border border-slate-900 clip-path-slant shadow-2xl overflow-hidden">
                            <div className="p-6 border-b border-slate-900 bg-white/[0.02] flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <Activity size={24} className="text-intuition-secondary animate-pulse" />
                                    <h3 className="font-black text-white font-display tracking-[0.3em] uppercase text-lg">Citizen_Ledger</h3>
                                </div>
                                <div className="text-[8px] text-slate-700 font-black uppercase tracking-[0.3em] hidden sm:block">IDENT_HASH: 0xCBFE...</div>
                            </div>
                            <div className="overflow-x-auto min-h-[400px]">
                                {stats?.userLedger?.length > 0 ? (
                                    <table className="w-full text-left font-mono">
                                        <thead className="bg-[#080808] text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] border-b border-slate-800">
                                            <tr>
                                                <th className="px-4 sm:px-6 py-4 w-12 text-center">#</th>
                                                <th className="px-4 sm:px-6 py-4">RECON_ID</th>
                                                <th className="px-4 sm:px-6 py-4 text-center">TOTAL_TXS</th>
                                                <th className="px-4 sm:px-6 py-4 text-right">VOLUME_SIGNALED</th>
                                                <th className="px-4 sm:px-6 py-4 text-right">{`${CURRENCY_SYMBOL}_BAL`}</th>
                                                <th className="px-4 sm:px-6 py-4 text-right">RANK</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {stats.userLedger.map((user: any, i: number) => (
                                                <tr key={user.id} className="hover:bg-white/5 transition-all group cursor-pointer">
                                                    <td className="px-4 sm:px-6 py-5 text-center">
                                                        <span className="text-sm sm:text-base font-black text-slate-400 group-hover:text-white transition-colors tabular-nums">{i + 1}</span>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5">
                                                        <div className="flex items-center gap-3 sm:gap-4">
                                                            <div className="w-10 h-10 bg-black border border-slate-800 clip-path-slant flex items-center justify-center overflow-hidden group-hover:border-intuition-secondary transition-all shrink-0">
                                                                {user.image ? <img src={user.image} className="w-full h-full object-cover" alt="" /> : <UserCircle size={20} className="text-slate-600" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-black text-white uppercase group-hover:text-intuition-secondary transition-colors truncate max-w-[140px] sm:max-w-[200px]">{user.label || user.id.slice(0, 14)}</div>
                                                                <div className="text-[10px] text-slate-500 font-mono truncate max-w-[100px] sm:max-w-[160px] mt-0.5">{user.id}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 text-center">
                                                        <div className="text-base sm:text-lg font-black text-white font-display group-hover:text-glow-white leading-none tabular-nums">{user.txCount}</div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 text-right">
                                                        <div className="text-base sm:text-lg font-black text-intuition-success font-mono group-hover:text-glow-success leading-none tabular-nums">
                                                            {user.volume.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 text-right">
                                                        <div className="text-sm font-black text-intuition-primary font-mono group-hover:text-glow-blue leading-none tabular-nums">
                                                            {userBalances[user.id] || "0.00"}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 uppercase mt-1 font-black tracking-wider">WALLET_BALANCE</div>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-5 text-right">
                                                        <span className={`px-3 py-1.5 border text-[9px] font-black uppercase clip-path-slant ${i < 3 ? 'border-intuition-secondary text-intuition-secondary bg-intuition-secondary/10 shadow-glow-red' : 'border-slate-600 text-slate-400'}`}>
                                                            {i < 3 ? 'ELITE' : 'CORE'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[400px] space-y-6">
                                        <Shield size={60} className="text-slate-900 animate-pulse" />
                                        <p className="text-slate-700 text-[10px] font-black uppercase tracking-[1em]">Awaiting_Signal</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Components */}
                    <div className="lg:col-span-4 space-y-8">
                        {/* Terminal */}
                        <div className="bg-black border border-intuition-primary/20 p-6 clip-path-slant shadow-2xl group hover:border-intuition-primary/40 hover:shadow-[0_0_25px_rgba(0,243,255,0.08)] transition-all duration-500">
                            <div className="flex items-center gap-3 mb-6 border-b border-intuition-primary/20 pb-3">
                                <Terminal size={14} className="text-intuition-primary animate-pulse text-glow-blue" />
                                <h4 className="text-[10px] font-black text-intuition-primary uppercase tracking-[0.4em] text-glow-blue">Protocol_Log</h4>
                            </div>
                            <div className="space-y-3 font-mono text-[10px] min-h-[160px]">
                                {reconLog.map((log, i) => (
                                    <div key={i} className="text-slate-400 group-hover:text-intuition-primary transition-colors duration-300 uppercase leading-relaxed font-bold border-l-2 border-intuition-primary/30 pl-3 group-hover:border-intuition-primary/60">
                                        <span className="text-intuition-primary font-black">{">_"}</span> <span className="group-hover:text-glow-blue">{log}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gauges */}
                        <div className="bg-[#020308] border border-intuition-primary/20 p-8 clip-path-slant shadow-2xl relative overflow-hidden group hover:border-intuition-primary/40 hover:shadow-[0_0_25px_rgba(0,243,255,0.08)] transition-all duration-500">
                            <h4 className="text-[11px] font-black text-intuition-primary uppercase tracking-[0.5em] mb-8 flex items-center gap-3 text-glow-blue">
                                <Cpu size={16} className="animate-pulse" /> System_Flux
                            </h4>
                            <div className="space-y-8">
                                <div className="group/diag">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-black group-hover/diag:text-intuition-primary group-hover/diag:text-glow-blue transition-all tracking-widest">Global_TVL</span>
                                        <span className="text-sm font-black text-white text-glow-white inline-flex items-baseline gap-1">{formattedGlobalTVL} <CurrencySymbol size="md" /></span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-950 overflow-hidden border border-white/10 rounded-none">
                                        <div className="h-full bg-intuition-primary/40 group-hover/diag:bg-intuition-primary group-hover/diag:shadow-glow-blue transition-all duration-500" style={{ width: '100%' }}></div>
                                    </div>
                                </div>
                                <div className="group/diag">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-black group-hover/diag:text-intuition-secondary group-hover/diag:text-glow-red transition-all tracking-widest">Avg_Handshake</span>
                                        <span className={`text-sm font-black ${isProxyEmpty ? 'text-slate-600' : 'text-intuition-secondary text-glow-red'}`}>
                                            {stats?.txCount > 0 ? (parseFloat(formatEther(BigInt(stats.proxyTVL))) / stats.txCount).toFixed(4) : "0.0000"}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-950 overflow-hidden border border-white/10 rounded-none">
                                        <div className={`h-full bg-intuition-secondary shadow-glow-red transition-all duration-1000 ${!isProxyEmpty ? 'animate-pulse' : ''}`} style={{ width: isProxyEmpty ? '0%' : '50%' }}></div>
                                    </div>
                                </div>
                                <div className="group/diag">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-[10px] text-slate-400 uppercase font-black group-hover/diag:text-intuition-primary tracking-widest transition-colors">Sync_Buffer</span>
                                        <span className="text-[10px] font-black text-intuition-primary text-glow-blue animate-pulse uppercase">LOCKED</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-950 overflow-hidden border border-white/10 rounded-none relative">
                                        <div className="h-full bg-intuition-primary shadow-glow-blue animate-buffer-fill"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Audit Log Box */}
                        <div className="bg-[#050505] border-2 border-intuition-secondary/30 p-8 clip-path-slant shadow-2xl relative overflow-hidden group hover:border-intuition-secondary/60 hover:shadow-[0_0_30px_rgba(255,30,109,0.12)] transition-all duration-500">
                             <div className="relative z-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <Lock size={18} className="text-intuition-secondary animate-pulse text-glow-red" />
                                    <h4 className="text-[11px] font-black text-intuition-secondary uppercase tracking-[0.5em] text-glow-red">Isolated_Protocol</h4>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed uppercase font-mono font-bold group-hover:text-slate-300 transition-colors">
                                    // Target_Identifier:<br/>
                                    <span className="text-intuition-primary/90 font-black select-all break-all mt-3 block py-3 px-4 bg-white/5 border border-intuition-primary/20 clip-path-slant text-[10px] text-glow-blue group-hover:border-intuition-primary/40 transition-all">0xCbFe767E67d04fBD58f8e3b721b8d07a73D16c93</span>
                                </p>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-16 border-t border-white/5 flex items-center justify-between opacity-30 group-hover:opacity-60 transition-all duration-1000">
                    <div className="flex items-center gap-6">
                         <div className="w-12 h-12 bg-black border border-white/10 flex items-center justify-center text-white clip-path-slant group-hover:border-intuition-primary transition-colors">
                             <Shield size={24} strokeWidth={1.5} />
                         </div>
                         <div>
                             <div className="text-xs font-black font-display text-white uppercase tracking-[0.2em] mb-1">ARES_Audit_v1.4.0</div>
                             <div className="text-[8px] font-black font-mono text-slate-500 uppercase tracking-[0.4em]">Sector_04 // RECON_LAYER</div>
                         </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                         <div className="text-[10px] font-black font-mono text-white uppercase tracking-widest">{new Date().toLocaleDateString().toUpperCase()}</div>
                         <div className="text-[8px] font-black font-mono text-slate-600 uppercase tracking-[0.3em]">SECURE_FRAMEWORK</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KPIDashboard;
