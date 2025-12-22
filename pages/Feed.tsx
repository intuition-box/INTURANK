
import React from 'react';
import ClaimFeed from '../components/ClaimFeed';
import { Radio, Activity, Terminal, ShieldCheck, Target, Cpu, Layers, Zap, Satellite } from 'lucide-react';

const Feed: React.FC = () => {
  return (
    <div className="w-full max-w-[1500px] mx-auto px-4 py-6 md:py-8 pb-32 font-mono relative">
        {/* Atmospheric HUD Overlay */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-intuition-primary/5 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
        </div>

        {/* --- COMPACT UPLINK DECK (HEADER) --- */}
        <div className="mb-8 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 border-b border-white/10 pb-8 relative z-10">
            <div className="relative">
                <div className="flex items-center gap-2 text-intuition-primary/60 mb-1">
                    <Satellite size={14} className="animate-pulse" />
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase">LINK_ESTABLISHED:SEC_04</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white font-display tracking-tight leading-none uppercase">
                    GLOBAL<span className="text-intuition-primary/80">_SIGNAL_FEED</span>
                </h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
                <div className="bg-black/60 border border-white/10 px-5 py-3 clip-path-slant flex items-center gap-4 hover:border-intuition-primary/40 transition-colors group">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ff0055]"></div>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">Uplink</span>
                    </div>
                    <div className="text-sm font-black text-white font-mono tracking-tighter">14MS <span className="text-[7px] text-slate-600 font-bold ml-1">DELAY</span></div>
                </div>

                <div className="bg-black/60 border border-white/10 px-5 py-3 clip-path-slant flex items-center gap-4 hover:border-intuition-success/40 transition-colors group">
                    <div className="flex items-center gap-2 text-slate-500">
                        <ShieldCheck size={12} className="group-hover:text-intuition-success transition-colors" />
                        <span className="text-[8px] font-black uppercase tracking-widest group-hover:text-white transition-colors">Verify</span>
                    </div>
                    <div className="text-sm font-black text-white font-mono tracking-tighter uppercase">L3_SYNC_LIVE</div>
                </div>
            </div>
        </div>

        {/* Main Strategic Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 relative z-10">
            
            {/* --- TACTICAL SIDEBAR (TOP PRIORITY) --- */}
            <div className="xl:col-span-3 space-y-6 order-2 xl:order-1">
                
                {/* NEURAL RADAR MODULE - High Density Visualization */}
                <div className="p-5 bg-[#05080f] border border-slate-900 relative overflow-hidden group hover:border-intuition-primary/40 transition-all duration-700 clip-path-slant shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-intuition-primary/5 via-transparent to-transparent pointer-events-none"></div>
                    
                    <div className="flex justify-between items-center mb-6 relative z-10">
                        <h3 className="text-[9px] font-black font-display text-intuition-primary uppercase tracking-[0.4em] flex items-center gap-3">
                            <Target size={14} className="text-intuition-primary animate-pulse" /> Neural_Radar
                        </h3>
                        <span className="text-[6px] font-mono text-slate-700 bg-black px-1.5 py-0.5 border border-white/5 rounded-sm">RANGE:40KM</span>
                    </div>
                    
                    {/* Visual Calibrated Radar (Optimized Proportions) */}
                    <div className="relative w-full aspect-square max-w-[210px] mx-auto border-2 border-white/5 rounded-full flex items-center justify-center mb-8 bg-black/40 shadow-[inset_0_0_30px_rgba(0,0,0,1)] group-hover:border-intuition-primary/10 transition-colors">
                        {/* High-Contrast Scan Sweep */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-intuition-primary/20 via-transparent to-transparent rounded-full animate-[spin_4s_linear_infinite]"></div>
                        
                        {/* Concentric Calibration Rings */}
                        <div className="w-[85%] h-[85%] border border-white/5 rounded-full relative">
                            <div className="absolute top-1/2 left-0 w-full h-px bg-white/5 -translate-y-1/2"></div>
                            <div className="absolute left-1/2 top-0 w-px h-full bg-white/5 -translate-x-1/2"></div>
                        </div>
                        <div className="w-[60%] h-[60%] border border-white/5 rounded-full"></div>
                        <div className="w-[30%] h-[30%] border border-intuition-primary/20 rounded-full flex items-center justify-center bg-black/60 shadow-[0_0_15px_rgba(0,243,255,0.1)]">
                            <Cpu size={14} className="text-intuition-primary/40 animate-pulse" />
                        </div>

                        {/* Semantic Node Blips (Simulated Real-time events) */}
                        <div className="absolute top-[28%] left-[24%] w-1 h-1 bg-intuition-primary rounded-full shadow-[0_0_8px_#00f3ff] animate-ping"></div>
                        <div className="absolute bottom-[42%] right-[18%] w-1 h-1 bg-intuition-success rounded-full shadow-[0_0_8px_#00ff9d] animate-pulse"></div>
                        <div className="absolute top-[60%] right-[35%] w-1 h-1 bg-intuition-danger rounded-full shadow-[0_0_8px_#ff0055] opacity-40"></div>
                    </div>
                    
                    {/* Performance Metrics Stack */}
                    <div className="space-y-5 pt-4 border-t border-white/5 relative z-10">
                        <div className="group/stat">
                            <div className="flex justify-between items-end mb-1.5">
                                <div className="text-[7px] text-slate-600 uppercase font-mono tracking-widest font-black group-hover/stat:text-white transition-colors">Relay_Throughput</div>
                                <div className="text-[7px] text-intuition-primary font-black uppercase">84.2 PPS</div>
                            </div>
                            <div className="h-1 w-full bg-slate-900 relative overflow-hidden">
                                <div className="h-full bg-intuition-primary w-[84%] shadow-[0_0_8px_#00f3ff] transition-all duration-1000"></div>
                            </div>
                        </div>
                        
                        <div className="group/stat">
                            <div className="flex justify-between items-end mb-1.5">
                                <div className="text-[7px] text-slate-600 uppercase font-mono tracking-widest font-black group-hover/stat:text-white transition-colors">Semantic_Entropy</div>
                                <div className="text-[7px] text-intuition-success font-black uppercase tracking-tighter">Stability_High</div>
                            </div>
                            <div className="flex items-center gap-1 h-2.5">
                                {[...Array(10)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex-1 h-full clip-path-slant transition-all duration-500 ${i < 8 ? 'bg-intuition-success shadow-[0_0_5px_rgba(0,255,157,0.3)]' : 'bg-slate-900 opacity-20'}`}
                                    ></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Protocol Handbook Console */}
                <div className="p-5 border-l-2 border-intuition-primary bg-black/40 relative overflow-hidden group hover:bg-black/60 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                        <Terminal size={12} className="text-intuition-primary group-hover:rotate-12 transition-transform duration-500" />
                        <h4 className="text-[8px] font-black font-mono text-white uppercase tracking-[0.3em]">system_rulebook</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <div className="w-0.5 h-auto bg-slate-800 shrink-0 group-hover:bg-intuition-primary transition-colors"></div>
                            <p className="text-[9px] text-slate-500 leading-relaxed font-mono tracking-tight group-hover:text-slate-300 transition-colors uppercase">
                                Nodes are <span className="text-white font-bold">Cryptographic Atoms</span>. Signal is the currency of truth.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <div className="w-0.5 h-auto bg-slate-800 shrink-0 group-hover:bg-intuition-primary transition-colors"></div>
                            <p className="text-[9px] text-slate-500 leading-relaxed font-mono tracking-tight group-hover:text-slate-300 transition-colors uppercase">
                                Collective conviction creates <span className="text-intuition-primary font-bold">Semantic Gravity</span>.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Identity Nodes Status Bar */}
                <div className="bg-black/40 border border-slate-900 p-3 clip-path-slant font-mono text-[8px] text-slate-600 uppercase tracking-widest flex items-center justify-between group hover:border-intuition-primary/20 transition-colors shadow-lg">
                    <div className="flex items-center gap-2">
                        <Layers size={10} className="text-intuition-primary group-hover:scale-125 transition-transform" />
                        <span className="group-hover:text-white transition-colors">Active_Nodes</span>
                    </div>
                    <span className="text-white font-black text-xs">2,401</span>
                </div>

                {/* System Activity Log Ticker */}
                <div className="bg-[#0a0f1a] border-b border-white/5 p-3 rounded-t-sm font-mono text-[7px] text-slate-700 uppercase tracking-widest flex items-center gap-3 overflow-hidden relative group">
                    <span className="text-intuition-primary font-black shrink-0 relative z-10">[LOG]</span>
                    <div className="whitespace-nowrap animate-marquee opacity-60 relative z-10 italic">
                        Handshake confirmed with sector_09... recalibrating entropy sensors... uplink stable... 
                    </div>
                </div>
            </div>

            {/* PRIMARY SIGNAL RELAY (THE DATA STREAM) */}
            <div className="xl:col-span-9 relative order-1 xl:order-2">
                <ClaimFeed />
            </div>
            
        </div>
    </div>
  );
};

export default Feed;
