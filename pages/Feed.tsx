import React from 'react';
import ClaimFeed from '../components/ClaimFeed';
import { Radio, Activity, Globe } from 'lucide-react';

const Feed: React.FC = () => {
  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-8 pb-32">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-intuition-primary/20 pb-6">
            <div>
                <h1 className="text-4xl font-black text-white font-display tracking-wide text-glow flex items-center gap-3">
                    <Globe className="text-intuition-primary" size={36} />
                    GLOBAL_FEED
                </h1>
                <p className="text-intuition-primary/60 mt-2 font-mono text-sm">
                    &gt;&gt; REAL_TIME_SEMANTIC_VERIFICATION_LAYER
                </p>
            </div>
            
            <div className="flex items-center gap-3 bg-black border border-intuition-border px-4 py-2 clip-path-slant">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                <span className="text-xs font-bold text-white font-mono tracking-widest">LIVE UPLINK ACTIVE</span>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3">
                <ClaimFeed />
            </div>
            
            {/* Sidebar Stats */}
            <div className="hidden lg:block space-y-6">
                <div className="p-6 bg-black border border-intuition-primary/30 clip-path-slant">
                    <h3 className="text-xs font-bold font-mono text-intuition-primary mb-4 uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} /> Network Pulse
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Claims / Hour</div>
                            <div className="text-2xl font-black text-white font-display">~142</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Trust Ratio</div>
                            <div className="w-full h-1 bg-slate-800 mt-1 mb-1">
                                <div className="h-full bg-intuition-success w-[75%] shadow-[0_0_10px_rgba(0,255,157,0.5)]"></div>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-intuition-success">75% TRUST</span>
                                <span className="text-intuition-danger">25% DISTRUST</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border border-intuition-border bg-intuition-card/30 clip-path-slant">
                    <div className="text-[10px] font-mono text-slate-500 mb-2">SYSTEM MSG</div>
                    <p className="text-xs text-slate-300 leading-relaxed font-mono">
                        Claims are cryptographically verified via the Intuition Protocol.
                        Large stakes equate to higher confidence scores.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Feed;