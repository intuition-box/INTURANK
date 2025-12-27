import React, { useState, useEffect, useRef, useMemo } from 'react';
import ClaimFeed from '../components/ClaimFeed';
import { Activity, Terminal, ShieldCheck, Target, Cpu, Layers, Satellite, Zap, RefreshCw, Clock, Wifi, WifiOff, Loader2, Radio, ZapOff, Fingerprint } from 'lucide-react';
import { getGlobalClaims } from '../services/graphql';
import { Claim } from '../types';
import { playClick, playHover } from '../services/audio';

// --- TACTICAL RADAR COMPONENT ---
const TacticalRadar: React.FC<{ 
    signals: Claim[], 
    onCollision?: (magnitude: number) => void 
}> = ({ signals, onCollision }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const requestRef = useRef<number>(0);
  const lastCollisionRef = useRef<Record<string, number>>({});

  const animate = (t: number) => {
    setTime(t / 1000);
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const blips = useMemo(() => {
    return signals.map((s) => {
      const hash = s.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const baseAngle = (hash % 360);
      const baseRadius = 0.25 + ((hash % 60) / 100); 
      
      return {
        id: s.id,
        label: s.subject.label || s.subject.id.slice(0, 8),
        baseAngle,
        baseRadius,
        driftSpeed: 0.05 + (hash % 5) * 0.02,
        wobbleFreq: 0.3 + (hash % 10) * 0.1,
        type: s.predicate.includes('TRUST') ? 'SUCCESS' : s.predicate.includes('DISTRUST') ? 'DANGER' : 'PRIMARY',
        magnitude: s.confidence || 50
      };
    });
  }, [signals]);

  const sweepAngle = (time * 120) % 360; // Increased sweep speed for better "Refresh" feel

  // Enhanced Collision Detection for "Neural Surge"
  useEffect(() => {
    blips.forEach(blip => {
      const currentAngle = (blip.baseAngle + (time * blip.driftSpeed)) % 360;
      const angleDiff = Math.abs((360 - currentAngle) - sweepAngle) % 360;
      const isSwept = angleDiff < 4 || angleDiff > 356;
      
      if (isSwept && (!lastCollisionRef.current[blip.id] || time - lastCollisionRef.current[blip.id] > 2.0)) {
        lastCollisionRef.current[blip.id] = time;
        if (onCollision) onCollision(blip.magnitude);
      }
    });
  }, [sweepAngle, blips, time, onCollision]);

  return (
    <div className="relative w-full aspect-square max-w-[240px] mx-auto border-2 border-white/5 rounded-full flex items-center justify-center mb-8 bg-black/60 shadow-[inset_0_0_60px_rgba(0,0,0,1)] group-hover:border-intuition-primary/10 transition-all duration-700 overflow-visible scale-100 hover:scale-[1.02]">
        
        {/* Radar Tactical Overlay (Sweep) */}
        <div 
            className="absolute inset-0 bg-gradient-to-tr from-intuition-primary/30 via-transparent to-transparent rounded-full pointer-events-none z-30 opacity-40"
            style={{ transform: `rotate(${sweepAngle}deg)` }}
        ></div>
        
        {/* Concentric Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-[85%] h-[85%] border border-white/10 rounded-full flex items-center justify-center">
                <div className="w-[70%] h-[70%] border border-white/10 rounded-full flex items-center justify-center">
                    <div className="w-[50%] h-[50%] border border-white/10 rounded-full"></div>
                </div>
            </div>
            {/* Axis Lines */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 -translate-y-1/2"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2"></div>
        </div>

        {/* Signal Blips */}
        <div className="absolute inset-0 z-20">
            {blips.map((blip) => {
                const currentAngle = (blip.baseAngle + (time * blip.driftSpeed)) % 360;
                const jitter = (Math.sin(time * 15) * 0.003); // Tactical high-freq jitter
                const r = blip.baseRadius + Math.sin(time * blip.wobbleFreq) * 0.015 + jitter;
                const rad = currentAngle * (Math.PI / 180);
                const x = 50 + Math.cos(rad) * r * 45;
                const y = 50 + Math.sin(rad) * r * 45;
                const angleDiff = Math.abs((360 - currentAngle) - sweepAngle) % 360;
                const isSwept = angleDiff < 20 || angleDiff > 340;

                return (
                    <div key={blip.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                        <div 
                            onMouseEnter={() => { setHoveredNode(blip.label); playHover(); }}
                            onMouseLeave={() => setHoveredNode(null)}
                            className={`relative w-2 h-2 rounded-full transition-all duration-300 cursor-crosshair border border-white/20 ${
                                isSwept ? 'scale-[1.8] opacity-100' : 'scale-100 opacity-30'
                            } ${
                                blip.type === 'SUCCESS' ? 'bg-intuition-success shadow-[0_0_15px_#00ff9d]' : 
                                blip.type === 'DANGER' ? 'bg-intuition-danger shadow-[0_0_15px_#ff0055]' : 
                                'bg-intuition-primary shadow-[0_0_15px_#00f3ff]'
                            }`}
                        >
                            {isSwept && <div className="absolute -inset-2 animate-ping rounded-full bg-inherit opacity-40"></div>}
                        </div>
                        
                        {/* Hover Tooltip - Tactical */}
                        {hoveredNode === blip.label && (
                            <div className="absolute top-4 left-4 bg-black/90 border border-intuition-primary px-2 py-1 whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in duration-150">
                                <div className="text-[7px] font-black font-mono text-intuition-primary uppercase tracking-[0.2em]">IDENT_CONFIRMED</div>
                                <div className="text-[10px] font-black text-white font-display uppercase">{blip.label}</div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Center Processor Core */}
        <div className="w-[20%] h-[20%] border border-intuition-primary/30 rounded-none clip-path-slant flex items-center justify-center bg-black/90 shadow-[0_0_30px_rgba(0,243,255,0.2)] relative z-40 group-hover:scale-110 transition-transform duration-500">
            <div className="absolute inset-0 bg-intuition-primary/5 animate-pulse"></div>
            <Cpu size={18} className="text-intuition-primary opacity-80" />
        </div>
    </div>
  );
};

const Feed: React.FC = () => {
  const [realClaims, setRealClaims] = useState<Claim[]>([]);
  const [pps, setPps] = useState(0);
  const [ping, setPing] = useState(14);
  const [surgeActive, setSurgeActive] = useState(false);
  const [energySurge, setEnergySurge] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [sessionUptime, setSessionUptime] = useState(0);

  // Sync Global Data
  useEffect(() => {
    const sync = async () => {
        try {
            const data = await getGlobalClaims();
            setRealClaims(data.slice(0, 40)); // Larger buffer for better calculation
            setIsConnected(true);
            setLastSyncTime(Date.now());
            
            // Refined CPM (Claims Per Minute) calculation
            if (data.length > 5) {
                const latest = data[0].timestamp;
                const referenceIdx = Math.min(data.length - 1, 19);
                const oldest = data[referenceIdx].timestamp;
                const timeSpanMins = (latest - oldest) / 60000;
                const calculatedCPM = timeSpanMins > 0 ? (referenceIdx / timeSpanMins) : 0.1;
                setPps(Math.min(120, calculatedCPM));
            } else {
                setPps(0.1); 
            }
            setPing(prev => Math.max(8, Math.min(45, prev + (Math.random() - 0.5) * 4)));
        } catch (e) {
            console.error("Feed Sync Error", e);
            setIsConnected(false);
        }
    };
    sync();
    const interval = setInterval(sync, 15000);
    const uptimeTimer = setInterval(() => setSessionUptime(p => p + 1), 1000);
    return () => {
        clearInterval(interval);
        clearInterval(uptimeTimer);
    };
  }, []);

  // Energy Decay Logic (for Flux Bar)
  useEffect(() => {
    const decay = setInterval(() => {
      setEnergySurge(prev => Math.max(0, prev - 0.5));
    }, 150);
    return () => clearInterval(decay);
  }, []);

  const handleRadarCollision = (magnitude: number) => {
    // TRIGGER NEURAL SURGE (Luminance based)
    if (magnitude > 60) {
        setSurgeActive(true);
        setTimeout(() => setSurgeActive(false), 300);
        setEnergySurge(prev => Math.min(10, prev + 1.5));
    }
  };

  // Filter for UNIQUE subjects for the Side Log to maximize information density
  const uniqueSignalLog = useMemo(() => {
      const seen = new Set();
      return realClaims.filter(c => {
          const subject = c.subject.label || c.subject.id;
          if (seen.has(subject)) return false;
          seen.add(subject);
          return true;
      }).slice(0, 5);
  }, [realClaims]);

  const syncAgeSec = Math.floor((Date.now() - lastSyncTime) / 1000);
  const isStale = syncAgeSec > 25;

  return (
    <div className={`w-full max-w-[1500px] mx-auto px-4 py-6 md:py-8 pb-32 font-mono relative transition-colors duration-500 ${surgeActive ? 'bg-intuition-primary/5' : ''}`}>
        
        {/* Background Visual Layer */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-intuition-primary/5 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
            {surgeActive && (
                 <div className="absolute inset-0 bg-intuition-primary/5 animate-in fade-in duration-200"></div>
            )}
        </div>

        {/* --- GLOBAL HUD HEADER --- */}
        <div className="mb-10 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 border-b border-white/10 pb-8 relative z-10">
            <div className="relative group">
                <div className="flex items-center gap-2 text-intuition-primary/60 mb-1">
                    <Satellite size={14} className={isConnected ? 'animate-pulse' : ''} />
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase">SYSTEM_UPTIME: {Math.floor(sessionUptime/60)}M {sessionUptime%60}S</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white font-display tracking-tighter leading-none uppercase text-glow">
                    GLOBAL<span className="text-intuition-primary/80">_SIGNAL_FEED</span>
                </h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <div className="bg-black/60 border border-white/10 px-6 py-4 clip-path-slant flex items-center gap-5 hover:border-intuition-primary/40 transition-all group hover:-translate-y-1">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest group-hover:text-white transition-colors">Signal_Uplink</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px_#ff0055] ${isConnected ? 'bg-red-500' : 'bg-slate-700'}`}></div>
                            <span className="text-sm font-black text-white font-mono tracking-tighter">{ping.toFixed(0)}MS</span>
                        </div>
                    </div>
                </div>

                <div className="bg-black/60 border border-white/10 px-6 py-4 clip-path-slant flex items-center gap-5 hover:border-intuition-success/40 transition-all group hover:-translate-y-1">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest group-hover:text-white transition-colors">Integrity_Lock</span>
                        <div className="flex items-center gap-2 mt-1">
                            {isConnected ? <ShieldCheck size={16} className="text-intuition-success" /> : <WifiOff size={16} className="text-intuition-danger" />}
                            <span className="text-sm font-black text-white font-mono tracking-tighter uppercase">{isConnected ? 'L3_SYNC' : 'LOST'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 relative z-10">
            {/* SIDEBAR TELEMETRY DECK */}
            <div className="xl:col-span-3 space-y-6 order-2 xl:order-1">
                
                {/* PRIMARY RADAR HUD */}
                <div className={`p-6 bg-[#05080f] border-2 transition-all duration-500 clip-path-slant shadow-2xl relative overflow-hidden group ${surgeActive ? 'border-intuition-primary shadow-[0_0_40px_rgba(0,243,255,0.2)]' : 'border-slate-900'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none opacity-40"></div>
                    <div className="flex justify-between items-center mb-8 relative z-10">
                        <h3 className="text-[10px] font-black font-display text-intuition-primary uppercase tracking-[0.4em] flex items-center gap-3">
                            <Target size={16} className="text-intuition-primary animate-pulse" /> Neural_Radar
                        </h3>
                        <div className={`px-2 py-0.5 rounded-sm text-[7px] font-black font-mono border-2 transition-all ${isStale ? 'bg-intuition-danger/20 border-intuition-danger text-intuition-danger animate-pulse' : 'bg-intuition-success/20 border-intuition-success text-intuition-success'}`}>
                            {isStale ? 'SIGNAL_STALE' : 'DATA_SYNC_OK'}
                        </div>
                    </div>
                    
                    <TacticalRadar signals={realClaims.slice(0, 15)} onCollision={handleRadarCollision} />
                    
                    <div className="space-y-6 pt-6 border-t border-white/10 relative z-10">
                        {/* NET THROUGHPUT GAUGE */}
                        <div className="group/stat">
                            <div className="flex justify-between items-end mb-2">
                                <div className="text-[8px] text-slate-500 uppercase font-mono tracking-widest font-black group-hover/stat:text-white transition-colors">Net_Throughput</div>
                                <div className={`text-[9px] font-black uppercase transition-all duration-300 ${surgeActive ? 'text-white' : 'text-intuition-primary'}`}>
                                    {!isConnected ? 'INITIALIZING...' : `${pps.toFixed(1)} CPM`}
                                </div>
                            </div>
                            <div className="h-2 w-full bg-slate-900 relative overflow-hidden rounded-none border border-white/5">
                                <div 
                                    className={`h-full bg-intuition-primary shadow-[0_0_12px_#00f3ff] transition-all duration-1000 relative z-10 ${surgeActive ? 'brightness-150' : ''}`} 
                                    style={{ width: isConnected ? `${Math.max(5, Math.min(100, pps * 3))}%` : '0%' }}
                                >
                                    <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-r from-transparent to-white/30 animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                        
                        {/* SEMANTIC FLUX METER */}
                        <div className="group/stat">
                            <div className="flex justify-between items-end mb-2">
                                <div className="text-[8px] text-slate-500 uppercase font-mono tracking-widest font-black group-hover/stat:text-white transition-colors">Semantic_Flux</div>
                                <div className={`text-[9px] font-black uppercase tracking-tighter transition-all duration-300 ${energySurge > 7 ? 'text-intuition-primary text-glow' : 'text-intuition-success'}`}>
                                    {energySurge > 8 ? 'CONVERGENCE_PEAK' : pps > 15 ? 'FLUX_CRITICAL' : 'STABLE_ORBIT'}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 h-3">
                                {[...Array(12)].map((_, i) => {
                                    const isActive = isConnected && (i < 3 || i < (pps / 3) || i < energySurge * 1.2);
                                    const isPeak = isConnected && i < energySurge * 1.2 && i >= 4;
                                    
                                    return (
                                        <div 
                                            key={i} 
                                            className={`flex-1 h-full clip-path-slant transition-all duration-300 ${
                                                isActive 
                                                    ? isPeak 
                                                        ? 'bg-intuition-primary shadow-[0_0_15px_#00f3ff] scale-y-110' 
                                                        : 'bg-intuition-success shadow-[0_0_8px_rgba(0,255,157,0.4)]' 
                                                    : 'bg-slate-900 opacity-20'
                                            }`}
                                        ></div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* TACTICAL SIGNAL LOG - UNIQUE SUBJECT FILTERING */}
                <div className="p-6 border-l-4 border-intuition-primary bg-black/60 relative overflow-hidden group hover:bg-black/80 transition-all h-52 flex flex-col shadow-inner shadow-black">
                    <div className="flex items-center justify-between mb-5 shrink-0 border-b border-white/5 pb-2">
                        <div className="flex items-center gap-3">
                            <Terminal size={14} className="text-intuition-primary" />
                            <h4 className="text-[9px] font-black font-mono text-white uppercase tracking-[0.4em]">live_signal_log</h4>
                        </div>
                        <div className="text-[7px] font-mono text-slate-500 flex items-center gap-1.5">
                            <Clock size={10} /> {syncAgeSec}S_LATENCY
                        </div>
                    </div>
                    <div className="space-y-4 overflow-hidden flex-1">
                        {uniqueSignalLog.length > 0 ? uniqueSignalLog.map((c, i) => (
                             <div key={c.id} className="flex gap-3 animate-in slide-in-from-left duration-300 group/log" style={{ animationDelay: `${i * 150}ms` }}>
                                <div className={`w-0.5 h-auto shrink-0 transition-all ${c.predicate.includes('TRUST') ? 'bg-intuition-success shadow-[0_0_5px_#00ff9d]' : 'bg-intuition-primary shadow-[0_0_5px_#00f3ff]'}`}></div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-400 leading-tight font-mono tracking-tight group-hover/log:text-white transition-colors uppercase truncate">
                                        {c.predicate} signal on <span className="text-intuition-primary font-bold">{c.subject.label || c.subject.id.slice(0,8)}</span>.
                                    </p>
                                    <div className="text-[7px] text-slate-600 font-mono mt-1 opacity-60 group-hover/log:opacity-100 uppercase">
                                        Source: {c.txHash?.slice(0, 10)}...
                                    </div>
                                </div>
                             </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-700 font-mono text-[9px] gap-3">
                                <Loader2 size={18} className="animate-spin opacity-30" />
                                <span className="animate-pulse tracking-[0.3em] uppercase">Awaiting_Ingress_Packet...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* NETWORK NODE STATUS CARD */}
                <div className="bg-black/40 border-2 border-slate-900 p-4 clip-path-slant font-mono text-[9px] text-slate-500 uppercase tracking-widest flex items-center justify-between group hover:border-intuition-primary/30 transition-all shadow-xl">
                    <div className="flex items-center gap-3">
                        <Layers size={14} className="text-intuition-primary group-hover:animate-bounce" />
                        <span className="group-hover:text-white transition-colors">Active_Network_Nodes</span>
                    </div>
                    <span className="text-white font-black text-sm text-glow">2,401</span>
                </div>

                {/* BOTTOM STREAM DECK */}
                <div className="bg-[#05080f] border-b-2 border-intuition-primary p-3 rounded-none font-mono text-[8px] text-slate-600 uppercase tracking-widest flex items-center gap-4 overflow-hidden relative group">
                    <div className="flex items-center gap-2 text-intuition-primary font-black shrink-0 relative z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-intuition-primary animate-ping"></div>
                        [RECON_STREAM]
                    </div>
                    <div className="whitespace-nowrap animate-marquee opacity-40 group-hover:opacity-100 group-hover:text-slate-300 transition-all relative z-10 italic">
                        {realClaims.length > 0 ? realClaims.map(c => `// SYNC: ${c.subject.label || 'NODE'} >> ${c.predicate} >> [${c.confidence}%] `).join(' ') : 'ESTABLISHING HANDSHAKE WITH MAINNET NODES... STANDBY...'} 
                    </div>
                </div>
            </div>

            {/* MAIN CENTRAL FEED */}
            <div className="xl:col-span-9 relative order-1 xl:order-2">
                <div className="absolute -top-6 right-0 text-[8px] font-mono text-slate-600 uppercase tracking-widest hidden md:block">
                    Sector_04_Live_Relay // IntuRank_Core_Sync
                </div>
                <ClaimFeed />
            </div>
        </div>
    </div>
  );
};

export default Feed;