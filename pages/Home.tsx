
import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Activity, ChevronDown, Binary, Box, HardDrive, Terminal, AlertCircle, Cpu, Network, Zap, Mail } from 'lucide-react';
import { useEmailNotify } from '../contexts/EmailNotifyContext';
import { formatEther } from 'viem';
import { playHover, playClick } from '../services/audio';
import { getAllAgents, getNetworkStats } from '../services/graphql';
import { CURRENCY_SYMBOL } from '../constants';

interface InViewOptions extends IntersectionObserverInit {
  once?: boolean;
}

const useInView = (options: InViewOptions = {}) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        if (options.once) observer.unobserve(entry.target);
      } else if (!options.once) {
        setIsInView(false);
      }
    }, { threshold: 0.1, ...options });

    const currentRef = ref.current;
    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [options.once]);

  return [ref, isInView] as const;
};

const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string; direction?: 'up' | 'down' | 'none' }> = ({ 
    children, 
    delay = 0, 
    className = "",
    direction = 'up'
}) => {
  const [ref, isInView] = useInView({ once: true });
  
  const getTransform = () => {
      if (!isInView) {
          if (direction === 'up') return 'translateY(20px)';
          if (direction === 'down') return 'translateY(-20px)';
          return 'scale(0.98)';
      }
      return 'translateY(0) scale(1)';
  };

  return (
    <div
      ref={ref}
      className={`transition-all duration-[900ms] ${className} ${
        isInView ? 'opacity-100 blur-none' : 'opacity-0 blur-sm'
      }`}
      style={{
        transitionDelay: `${delay}ms`,
        transform: getTransform(),
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {children}
    </div>
  );
};

const TickerItem: React.FC<{ symbol: string, price: string, isUp: boolean }> = ({ symbol, price, isUp }) => (
  <div className="flex items-center gap-2 sm:gap-4 px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-r border-white/10 text-[9px] sm:text-[10px] font-black font-mono whitespace-nowrap bg-black/40 hover:bg-intuition-secondary/10 transition-all group">
    <span className="text-slate-300 tracking-[0.2em] group-hover:text-white transition-colors uppercase font-black">{symbol}</span>
    <span className="text-white tracking-tighter text-sm font-black">{price}</span>
    <span className={`px-1.5 py-0.5 rounded-sm font-black shadow-sm ${isUp ? 'text-intuition-success bg-intuition-success/10 text-glow-success' : 'text-intuition-secondary bg-intuition-secondary/20 shadow-[0_0_10px_rgba(255,0,85,0.2)] text-glow-red'}`}>
      {isUp ? '▲' : '▼'}{Math.floor(Math.random() * 8)}.{Math.floor(Math.random() * 9)}%
    </span>
  </div>
);

const MissionTerminal: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-32 relative">
      <Reveal delay={200}>
        <div className="bg-[#05080f] border-2 border-intuition-primary/40 rounded-xl overflow-hidden shadow-[0_0_80px_rgba(0,243,255,0.15)] clip-path-slant group">
          <div className="flex items-center justify-between px-6 py-4 bg-black/60 border-b border-white/5">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
              <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
            </div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.4em] font-black">mission_log.txt</div>
            <div className="w-12"></div>
          </div>
          
          <div className="p-8 md:p-16 font-mono space-y-10 relative">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-20"></div>
            
            <div className="text-intuition-primary text-sm md:text-base font-black tracking-widest flex items-center gap-3">
              <span className="animate-pulse">{">>"}</span> SYSTEM BOOT SEQUENCE INITIATED ...
            </div>
            
            <p className="text-slate-300 text-lg md:text-xl leading-relaxed font-black uppercase tracking-tight">
              The internet is broken. Information is abundant, but <span className="inline-block px-2 py-0.5 bg-intuition-primary/10 border border-intuition-primary/30 text-white text-glow-blue rounded-sm">trust</span> is scarce. We are drowning in noise, deepfakes, and sybil attacks.
            </p>
            
            <p className="text-slate-300 text-lg md:text-xl leading-relaxed font-black uppercase tracking-tight">
              Intuition is the solution. A decentralized, semantic graph where reputation has a price. By attaching financial value to truth, we make lying expensive.
            </p>
            
            <p className="text-lg md:text-xl leading-relaxed font-black uppercase tracking-tight">
              <span className="text-intuition-success text-glow-success">We are building the credit score for everything.</span> <span className="text-slate-300">Not controlled by a bank, but by you. The market decides what is true.</span>
            </p>
            
            <div className="text-intuition-primary text-sm md:text-base font-black tracking-widest flex items-center gap-2 pt-4 text-glow-blue">
              <span>{">>"}</span> AWAITING INPUT<span className="w-2.5 h-6 bg-intuition-primary animate-[pulse_0.8s_infinite] shadow-glow-blue"></span>
            </div>
          </div>
        </div>
      </Reveal>
      
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-intuition-primary/5 rounded-full blur-[80px] -z-10 animate-pulse"></div>
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-intuition-secondary/5 rounded-full blur-[80px] -z-10 animate-pulse delay-1000"></div>
    </div>
  );
};

const Home: React.FC = () => {
  const { openEmailNotify } = useEmailNotify();
  const [tickerData, setTickerData] = useState<any[]>([]);
  const [stats, setStats] = useState({ tvl: "0", atoms: 0, signals: 0, positions: 0 });

  useEffect(() => {
    const initData = async () => {
      try {
        const agentsData = await getAllAgents().catch(() => ({ items: [], hasMore: false }));
        const agents = agentsData.items;
        const topAgents = agents.slice(0, 15).map(a => {
           const assets = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
           const shares = parseFloat(formatEther(BigInt(a.totalShares || '0')));
           const price = shares > 0 ? (assets / shares).toFixed(4) : "0.0001";
           return { symbol: (a.label || 'NODE').toUpperCase().slice(0, 12), price, isUp: Math.random() > 0.45 };
        });
        setTickerData(topAgents);
        const netStats = await getNetworkStats().catch(() => ({ tvl: "0", atoms: 0, signals: 0, positions: 0 }));
        setStats(netStats);
      } catch (e) { console.error(e); }
    };
    initData();
  }, []);

  const volumeValue = parseFloat(formatEther(BigInt(stats.tvl)));
  const formattedVolume = volumeValue > 0 
    ? volumeValue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : "0.0";

  return (
    <div className="relative flex flex-col min-h-screen bg-intuition-dark selection:bg-intuition-secondary selection:text-white max-w-[100vw] overflow-x-hidden">
      
      <div className="relative h-[90vh] flex flex-col justify-center items-center overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,_rgba(0,243,255,0.1),_transparent_60%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,_rgba(255,0,85,0.12),_transparent_40%)]"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.08] retro-grid pointer-events-none"></div>
        
        <div className="relative z-10 text-center max-w-6xl w-full min-w-0 px-4 sm:px-6 flex flex-col items-center">
          <Reveal delay={100} direction="down">
            <div className="inline-flex items-center gap-3 px-4 sm:px-6 py-2 mb-8 bg-black border-2 border-intuition-secondary text-[9px] sm:text-[10px] font-black font-mono tracking-[0.4em] sm:tracking-[0.5em] text-intuition-secondary uppercase shadow-[0_0_30px_rgba(255,0,85,0.6)] clip-path-slant group mobile-break">
              <div className="absolute inset-0 bg-intuition-secondary/10 animate-pulse"></div>
              <Terminal size={14} className="text-intuition-secondary shrink-0" />
              IDENTITY_PROTOCOL_ACTIVE // ARES_HIGH_STAKES
            </div>
          </Reveal>

          <Reveal delay={300}>
            <div className="relative mb-8 min-w-0 w-full">
               <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[8.5rem] font-black tracking-tighter text-white leading-[0.9] font-display text-glow-white uppercase mobile-break">
                 SEMANTIC<br />
                 <span className="text-intuition-secondary text-glow-red animate-pulse">CAPITALISM</span>
               </h1>
            </div>
          </Reveal>

          <Reveal delay={500}>
            <p className="max-w-2xl w-full min-w-0 mx-auto text-sm sm:text-base md:text-2xl text-slate-200 mb-12 font-mono leading-relaxed tracking-wide uppercase font-black px-1 mobile-break">
              Establishing the reputation protocol for a trustless world.<br/>
              <span className="text-intuition-primary text-glow-blue underline decoration-intuition-secondary/50 underline-offset-8">QUANTIFY IDENTITY. ARBITRAGE TRUTH.</span>
            </p>
          </Reveal>

          <Reveal delay={700}>
            <div className="flex flex-col sm:flex-row items-center gap-8 mb-16">
              <Link to="/markets" onClick={playClick} className="btn-cyber btn-cyber-secondary px-16 py-7 text-xl group shadow-[0_0_60px_rgba(255,30,109,0.7)]">
                ENTER_TERMINAL <ArrowRight className="ml-4 group-hover:translate-x-3 transition-transform duration-300" />
              </Link>
              <Link to="/stats" onClick={playClick} className="btn-cyber btn-cyber-outline px-16 py-7 text-xl border-intuition-primary text-intuition-primary hover:text-white shadow-[0_0_30px_rgba(0,243,255,0.3)]">
                NETWORK_STATS
              </Link>
            </div>
          </Reveal>
        </div>

        <div className="absolute bottom-8 flex flex-col items-center gap-2 opacity-80 animate-bounce">
            <span className="text-[10px] font-black font-mono tracking-[0.4em] text-intuition-secondary text-glow-red uppercase font-black">Scroll_For_Telemetry</span>
            <ChevronDown size={24} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
        </div>
      </div>

      <div className="w-full min-w-0 border-y-2 border-intuition-secondary/20 bg-black/90 py-1 overflow-hidden flex items-stretch group relative z-20 shadow-2xl">
         <div className="bg-black z-30 px-4 sm:px-6 md:px-8 py-4 sm:py-5 flex items-center gap-2 sm:gap-4 border-r-2 border-intuition-secondary/40 shadow-[25px_0_45px_rgba(0,0,0,1)] shrink-0">
            <div className="w-3 h-3 rounded-full bg-intuition-secondary animate-pulse-fast shadow-[0_0_15px_#ff0055]"></div>
            <span className="text-[9px] sm:text-[11px] font-black font-display text-white tracking-[0.2em] sm:tracking-[0.3em] uppercase text-glow-white whitespace-nowrap">SYSTEM_PULSE</span>
         </div>
         
         <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar">
            <div className="flex w-max min-h-full animate-marquee group-hover:[animation-play-state:paused]">
               <div className="flex shrink-0">
                  {tickerData.length > 0 ? tickerData.map((item, i) => (
                     <TickerItem key={i} symbol={item.symbol} price={item.price} isUp={item.isUp} />
                  )) : <div className="px-8 sm:px-20 text-[9px] sm:text-[10px] font-mono text-slate-300 animate-pulse uppercase tracking-[0.5em] font-black">Establishing neural uplink...</div>}
               </div>
               <div className="flex shrink-0">
                  {tickerData.length > 0 ? tickerData.map((item, i) => (
                     <TickerItem key={`d-${i}`} symbol={item.symbol} price={item.price} isUp={item.isUp} />
                  )) : null}
               </div>
            </div>
         </div>
      </div>

      <div className="py-16 sm:py-24 md:py-40 bg-[#04060b] relative overflow-hidden border-b border-white/5 min-w-0">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-intuition-secondary/[0.06] rounded-full blur-[140px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 min-w-0">
          <div className="mb-12 md:mb-24 flex flex-col md:flex-row justify-between items-end gap-8 md:gap-10">
            <Reveal className="max-w-3xl min-w-0">
                <div className="flex items-center gap-3 text-intuition-secondary font-black font-mono text-[10px] sm:text-xs mb-6 sm:mb-8 tracking-[0.4em] sm:tracking-[0.6em] uppercase text-glow-red">
                    <Binary size={18} className="sm:w-5 sm:h-5" /> Protocol_Engineering
                </div>
                <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black text-white font-display leading-[0.85] tracking-tighter uppercase mb-4 md:mb-6 text-glow-white">
                  SEMANTIC<br/><span className="text-intuition-secondary text-glow-red">DYNAMICS</span>
                </h2>
                <p className="text-slate-200 text-base sm:text-lg md:text-xl font-mono uppercase tracking-widest leading-relaxed font-black">
                  Mapping global consensus with cryptographic precision.
                </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 min-w-0">
              {[
                  { num: "01", icon: <Shield size={40}/>, color: "text-intuition-primary text-glow-blue", border: "border-intuition-primary/30", glow: "hover:border-intuition-primary hover:shadow-glow-blue", title: "VERIFIED_ATOMS", desc: "Every unique identity is anchored as a persistent primitive in the graph, ready for valuation." },
                  { num: "02", icon: <Binary size={40}/>, color: "text-intuition-secondary text-glow-red", border: "border-intuition-secondary/40", glow: "hover:border-intuition-secondary hover:shadow-glow-red", title: "LOGIC_TRIPLES", desc: "Claims are structured as machine-readable semantic links, creating a network of truth." },
                  { num: "03", icon: <Activity size={40}/>, color: "text-white text-glow-white", border: "border-white/20", glow: "hover:border-white hover:shadow-2xl", title: "STAKE_CONSENSUS", desc: "Conviction is quantified through capital allocation, making deception economically irrational." }
              ].map((item, i) => (
                  <Reveal key={i} delay={200 + (i * 150)}>
                      <div className={`min-w-0 p-6 sm:p-8 md:p-10 bg-black border-2 ${item.border} ${item.glow} motion-hover-lift clip-path-slant group relative overflow-hidden h-full flex flex-col hover:shadow-[0_0_40px_rgba(255,0,85,0.25)]`}>
                          <div className="absolute top-0 right-0 p-2 sm:p-4 text-[4rem] sm:text-[5rem] md:text-[7rem] font-black text-white/5 font-display italic pointer-events-none group-hover:text-intuition-secondary/10 transition-colors">{item.num}</div>
                          <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-white/5 border-2 ${item.border} flex items-center justify-center ${item.color} group-hover:scale-110 transition-all duration-700 mb-6 sm:mb-10 clip-path-slant shadow-2xl shrink-0`}>
                              {item.icon}
                          </div>
                          <h4 className={`text-lg sm:text-xl md:text-2xl font-black font-display text-white mb-4 md:mb-6 uppercase group-hover:text-intuition-secondary transition-all break-words ${item.num === '02' ? 'text-glow-red' : 'group-hover:text-glow-white'}`}>{item.title}</h4>
                          <p className="text-slate-300 font-mono text-xs sm:text-sm leading-relaxed tracking-wider uppercase font-black opacity-100 min-w-0">{item.desc}</p>
                      </div>
                  </Reveal>
              ))}
          </div>
        </div>
      </div>

      <div className="py-40 bg-intuition-dark relative border-y-2 border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10">
          <Reveal className="mb-20 flex items-center gap-6">
            <div className="w-12 h-12 bg-intuition-secondary/10 border border-intuition-secondary flex items-center justify-center clip-path-slant shadow-glow-red">
                <Activity className="text-intuition-secondary animate-pulse" size={24} />
            </div>
            <h2 className="text-4xl md:text-5xl font-black font-display text-white tracking-tight uppercase text-glow-red">Network_Ingress</h2>
          </Reveal>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            <Reveal delay={100}><StatBox label="Protocol Volume" value={formattedVolume} sub={`${CURRENCY_SYMBOL} EQUITY`} icon={<Box size={18}/>} color="secondary" /></Reveal>
            <Reveal delay={200}><StatBox label="Semantic Nodes" value={stats.atoms.toLocaleString()} sub="VERIFIED ATOMS" icon={<HardDrive size={18}/>} color="primary" /></Reveal>
            <Reveal delay={300}><StatBox label="Signal Density" value={stats.signals.toLocaleString()} sub="GRAPH TRIPLES" icon={<Binary size={18}/>} color="secondary" /></Reveal>
            <Reveal delay={400}><StatBox label="Uplink Flux" value={`${stats.positions.toLocaleString()}Hz`} sub="THROUGHPUT" icon={<Activity size={18}/>} color="primary" /></Reveal>
          </div>
        </div>
      </div>

      <section id="email-alerts" className="py-20 sm:py-28 md:py-32 relative overflow-hidden border-y-2 border-amber-400/30 bg-[#04060b] min-w-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_30%,rgba(251,191,36,0.1),_transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_70%,rgba(168,85,247,0.06),_transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] retro-grid pointer-events-none" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Reveal delay={100}>
            <div className="inline-flex items-center gap-3 px-4 py-2 mb-6 bg-black/60 border-2 border-amber-400/70 text-amber-300 font-mono uppercase tracking-[0.5em] text-[10px] font-black clip-path-slant shadow-[0_0_28px_rgba(251,191,36,0.3)]">
              <Mail size={20} className="shrink-0" />
              EMAIL ALERTS
            </div>
            <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black font-display text-white uppercase tracking-tighter mb-4 text-glow-white leading-tight">
              Get notified about your shares & holdings<br className="hidden sm:block" /> <span className="text-amber-300 text-glow-gold">via email</span>
            </h3>
            <p className="text-slate-300 font-mono text-sm sm:text-base max-w-xl mx-auto mb-10 leading-relaxed">
              When others buy or sell in claims you hold, we’ll notify you in the app and by email. Connect your wallet and add your email below.
            </p>
            <button
              type="button"
              onClick={() => { playClick(); openEmailNotify(); }}
              onMouseEnter={playHover}
              className="btn-cyber px-8 py-4 text-sm sm:text-base bg-amber-400 text-black font-black tracking-[0.2em] border-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.4)] hover:bg-amber-300 hover:border-amber-300 hover:shadow-[0_0_40px_rgba(251,191,36,0.5),0_0_0_1px_rgba(168,85,247,0.3)] active:scale-[0.98] transition-all duration-300 inline-flex items-center gap-3 motion-hover-scale"
            >
              <Mail size={18} />
              GET EMAIL ALERTS
            </button>
          </Reveal>
        </div>
      </section>

      <MissionTerminal />

      <div className="py-64 text-center relative overflow-hidden bg-black border-t-2 border-intuition-secondary/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,0,85,0.15),_transparent_70%)]"></div>
        <Reveal delay={200}>
          <div className="inline-flex items-center gap-3 text-intuition-secondary font-black font-mono text-xs mb-12 tracking-[0.8em] uppercase text-glow-red font-black">
             <AlertCircle size={18} /> Initializing_Final_Sequence
          </div>
          <h2 className="text-6xl md:text-[10rem] font-black font-display text-white mb-16 tracking-tighter text-glow-white uppercase leading-[0.85]">
            RECLAIM_THE<br/><span className="text-intuition-secondary text-glow-red">REPUTATION</span>
          </h2>
          <div className="flex justify-center mb-24">
            <Link to="/markets" onClick={playClick} className="btn-cyber btn-cyber-secondary px-24 py-10 text-3xl shadow-[0_0_100px_rgba(255,30,109,0.7)] motion-smooth">
              SYNC_PROTOCOL
            </Link>
          </div>
        </Reveal>
      </div>

    </div>
  );
};

const StatBox = ({ label, value, sub, icon, color }: any) => {
    const isRed = color === 'secondary';
    const borderClass = isRed ? 'border-intuition-secondary/40 hover:border-intuition-secondary' : 'border-intuition-primary/30 hover:border-intuition-primary';
    const textClass = isRed ? 'group-hover:text-intuition-secondary' : 'group-hover:text-intuition-primary';
    const glowClass = isRed ? 'text-glow-red' : 'text-glow-blue';
    const bgClass = isRed ? 'bg-intuition-secondary shadow-glow-red' : 'bg-intuition-primary shadow-glow-blue';

    const valStr = value.toString();
    const valLength = valStr.length;
    
    const getFontSize = () => {
        if (valLength > 15) return 'text-xl sm:text-2xl md:text-3xl';
        if (valLength > 12) return 'text-2xl sm:text-3xl md:text-4xl';
        if (valLength > 10) return 'text-3xl sm:text-4xl md:text-5xl';
        if (valLength > 8) return 'text-4xl sm:text-5xl md:text-6xl';
        return 'text-5xl sm:text-6xl md:text-7xl';
    };

    return (
      <div className={`relative p-8 bg-[#02040a] group motion-hover-lift flex flex-col h-72 overflow-hidden border-2 ${borderClass} shadow-2xl clip-path-slant select-none hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]`}>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] opacity-10 pointer-events-none"></div>
        
        <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 ${isRed ? 'border-intuition-secondary/60' : 'border-intuition-primary/60'} opacity-40 group-hover:opacity-100 transition-opacity duration-500`}></div>
        <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 ${isRed ? 'border-intuition-secondary/60' : 'border-intuition-primary/60'} opacity-40 group-hover:opacity-100 transition-opacity duration-500`}></div>
        
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-40 pointer-events-none"></div>
        
        <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="flex flex-col gap-1.5">
                <span className="text-slate-500 font-mono text-[9px] uppercase tracking-[0.4em] font-black group-hover:text-white transition-colors">{label}</span>
                <div className={`h-[1px] w-12 ${isRed ? 'bg-intuition-secondary' : 'bg-intuition-primary'} opacity-40 group-hover:w-full transition-all duration-1000`}></div>
            </div>
            <div className={`p-3 bg-black border border-white/10 rounded-none clip-path-slant transition-all duration-500 group-hover:scale-110 group-hover:border-current shadow-inner ${textClass}`}>
                {icon}
            </div>
        </div>

        <div className="flex-1 flex items-center justify-start relative z-10 min-h-0 overflow-hidden">
            <div className={`font-black text-white font-display transition-all duration-500 tracking-tighter w-full break-all leading-[1.35] min-h-[1.35em] group-hover:scale-[1.02] ${getFontSize()} ${glowClass}`}>
                {value}
            </div>
        </div>

        <div className="mt-auto relative z-10 pt-4 flex items-center justify-between border-t border-white/5">
            <div className="text-slate-500 font-mono text-[8px] uppercase tracking-[0.5em] font-black group-hover:text-white transition-colors flex items-center gap-2">
                <div className={`w-2 h-2 ${bgClass.split(' ')[0]} animate-pulse shadow-[0_0_10px_currentColor] clip-path-slant`}></div>
                {sub}
            </div>
            <div className="flex items-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                <div className="text-[7px] font-black font-mono text-slate-600 uppercase tracking-widest group-hover:text-slate-400">Ver_04_ARES</div>
                <Network size={10} className="text-slate-600 group-hover:text-white" />
            </div>
        </div>
        
        <div className={`absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-${isRed ? 'intuition-secondary' : 'intuition-primary'}/10 to-transparent -translate-y-full group-hover:animate-[scanline_3s_linear_infinite] pointer-events-none`}></div>

        <div className={`absolute bottom-0 left-0 h-1.5 w-full ${bgClass.split(' ')[0]} scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left shadow-[0_0_20px_currentColor]`}></div>
      </div>
    );
};

export default Home;
