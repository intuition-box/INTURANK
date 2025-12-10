import React from 'react';
import ClaimFeed from '../components/ClaimFeed';
import { Radio, Activity, Globe, Wifi, Terminal } from 'lucide-react';

const Feed: React.FC = () => {
  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8 pb-32">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-intuition-primary/20 pb-6">
            <div>
                <h1 className="text-4xl md:text-5xl font-black text-white font-display tracking-wide text-glow flex items-center gap-4">
                    <Globe className="text-intuition-primary animate-pulse-fast" size={42} />
                    GLOBAL_FEED
                </h1>
                <p className="text-intuition-primary/60 mt-2 font-mono text-sm tracking-widest">
                    &gt;&gt; REAL_TIME_SEMANTIC_VERIFICATION_LAYER
                </p>
            </div>
            
            <div className="flex items-center gap-4 bg-black border border-intuition-primary/50 px-6 py-3 clip-path-slant shadow-[0_0_20px_rgba(0,243,255,0.2)]">
                <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute opacity-75"></div>
                    <div className="w-3 h-3 rounded-full bg-red-500 relative shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                </div>
                <span className="text-sm font-black text-white font-display tracking-widest">LIVE UPLINK ACTIVE</span>
                <Wifi size={18} className="text-slate-500" />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3">
                <ClaimFeed />
            </div>
            
            {/* Sidebar Stats - Monitoring Station */}
            <div className="hidden lg:block space-y-6 sticky top-24">
                <div className="p-6 bg-black border-2 border-intuition-primary/20 clip-path-slant relative overflow-hidden group hover:border-intuition-primary/50 transition-colors">
                    {/* Background Grid */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
                    
                    <h3 className="text-xs font-bold font-mono text-intuition-primary mb-6 uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-2">
                        <Activity size={14} /> Network Pulse
                    </h3>
                    
                    <div className="space-y-6">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Throughput (TPS)</div>
                            <div className="text-3xl font-black text-white font-display text-glow">~14.2</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Trust Ratio</div>
                            <div className="w-full h-2 bg-slate-800 mt-1 mb-2 rounded-full overflow-hidden flex">
                                <div className="h-full bg-intuition-success w-[75%] shadow-[0_0_10px_rgba(0,255,157,0.5)] animate-pulse"></div>
                                <div className="h-full bg-intuition-danger w-[25%]"></div>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono font-bold">
                                <span className="text-intuition-success">75% LONG</span>
                                <span className="text-intuition-danger">25% SHORT</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Active Validators</div>
                            <div className="text-xl font-bold text-slate-300 font-mono">2,401 NODES</div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border border-intuition-border bg-intuition-card/30 clip-path-slant relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-intuition-primary"></div>
                    <div className="text-[10px] font-mono text-intuition-primary mb-2 flex items-center gap-2">
                        <Terminal size={12} /> SYSTEM_LOG
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-mono">
                        All claims are cryptographically signed and verified on the Intuition Protocol.
                        <br/><br/>
                        <span className="text-white font-bold">Note:</span> Large stakes equate to higher confidence scores in the trust graph.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Feed;