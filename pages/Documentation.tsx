
import React, { useState, useEffect, useRef } from 'react';
/* Fixed: Added Coins, Layers and other missing icons to lucide-react imports */
import { 
  Terminal, Cpu, Network, TrendingUp, Shield, Target, 
  Fingerprint, BookOpen, Ghost, Database, Zap, ArrowRight, 
  ChevronRight, ChevronsRight, Activity, ShieldCheck, 
  Sparkles, Command, Info, Globe, AlertCircle, BarChart2,
  Coins, Layers
} from 'lucide-react';
/* Fixed: Added missing Link import from react-router-dom */
import { Link } from 'react-router-dom';
import { playClick, playHover } from '../services/audio';

const SectionGlow = ({ color }: { color: string }) => (
  <div className={`absolute -top-20 -left-20 w-64 h-64 blur-[120px] rounded-full pointer-events-none opacity-20 transition-all duration-1000 group-hover:opacity-40 group-hover:scale-125`} style={{ backgroundColor: color }}></div>
);

const DocSection = ({ id, title, icon: Icon, children, badge, color = "#00f3ff" }: any) => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id={id} 
      ref={sectionRef}
      className={`py-32 border-b border-white/5 group scroll-mt-32 relative transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
    >
      <SectionGlow color={color} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20 relative z-10">
        <div className="flex items-center gap-10">
          <div 
            className="w-20 h-20 bg-black border-2 flex items-center justify-center transition-all duration-700 clip-path-slant shadow-2xl group-hover:rotate-12 group-hover:scale-110"
            style={{ color, borderColor: `${color}44`, boxShadow: `0 0 40px ${color}11` }}
          >
            <Icon size={38} className="group-hover:animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-black font-mono uppercase tracking-[0.8em] mb-4 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color }}>{badge}</div>
            <h2 className="text-4xl md:text-6xl font-black font-display text-white uppercase tracking-tighter leading-none group-hover:text-glow-white transition-all">
              {title.split('_').join(' ')}
            </h2>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-4 text-slate-800 font-black text-[8px] tracking-[0.5em] uppercase">
          <Activity size={12} /> Live_Telemetry_Active
        </div>
      </div>
      <div className="pl-0 lg:pl-32 relative z-10">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent hidden lg:block"></div>
        <div className="max-w-4xl space-y-12">
          {children}
        </div>
      </div>
    </section>
  );
};

const ArchitectureNode = ({ title, desc, icon: Icon, color }: any) => (
  <div className="p-8 bg-black border-2 border-slate-900 clip-path-slant group/node hover:border-white/20 transition-all duration-500 relative overflow-hidden shadow-2xl h-full">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover/node:opacity-100 transition-opacity"></div>
    <div className="flex items-center gap-5 mb-6">
      <div className="p-3 bg-white/5 border border-white/10 rounded-xl group-hover/node:scale-110 transition-transform" style={{ color }}>
        <Icon size={24} />
      </div>
      <h4 className="text-xl font-black text-white uppercase tracking-tighter">{title}</h4>
    </div>
    <p className="text-sm font-mono text-slate-500 uppercase tracking-widest leading-relaxed group-hover/node:text-slate-300 transition-colors">
      {desc}
    </p>
  </div>
);

/* Fixed: Added missing GlossaryItem component to define terms in the Neural Index section */
const GlossaryItem = ({ term, definition }: { term: string; definition: string }) => (
  <div className="p-6 bg-white/[0.02] border border-white/5 clip-path-slant group hover:border-white/20 transition-all">
    <h5 className="text-[10px] font-black text-intuition-primary uppercase tracking-[0.3em] mb-3 group-hover:text-white transition-colors">{term}</h5>
    <p className="text-[11px] text-slate-500 uppercase font-mono tracking-wider leading-relaxed">{definition}</p>
  </div>
);

const Documentation: React.FC = () => {
  const [activeSection, setActiveSection] = useState('intro');
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);

      const sections = navItems.map(item => document.getElementById(item.id));
      const current = sections.findIndex(section => {
        if (!section) return false;
        const rect = section.getBoundingClientRect();
        return rect.top >= 0 && rect.top <= 400;
      });
      if (current !== -1) setActiveSection(navItems[current].id);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'intro', label: '00_INTRODUCTION', icon: Terminal, badge: 'RECON_OVERVIEW', color: '#00f3ff' },
    { id: 'mission', label: '01_MISSION_MOTIVE', icon: Target, badge: 'CORE_PURPOSE', color: '#ff1e6d' },
    { id: 'primitives', label: '02_CORE_PRIMITIVES', icon: Fingerprint, badge: 'BASE_LAYER', color: '#00ff9d' },
    { id: 'economics', label: '03_MARKET_DYNAMICS', icon: TrendingUp, badge: 'VALUATION_MODEL', color: '#facc15' },
    { id: 'ares', label: '04_INTELLIGENCE_LAYER', icon: Cpu, badge: 'AI_SYNTHESIS', color: '#a855f7' },
    { id: 'guide', label: '05_OPERATOR_GUIDE', icon: Command, badge: 'EXECUTION_FLOW', color: '#ffffff' },
    { id: 'glossary', label: '06_GLOSSARY', icon: BookOpen, badge: 'NEURAL_INDEX', color: '#475569' },
  ];

  const scrollTo = (id: string) => {
    playClick();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  return (
    <div className="w-full bg-[#020308] min-h-screen selection:bg-intuition-primary selection:text-black">
      
      {/* HUD - READING PROGRESS */}
      <div className="fixed top-20 left-0 w-full h-1 z-[60] pointer-events-none">
        <div 
          className="h-full bg-gradient-to-r from-intuition-primary via-intuition-secondary to-intuition-primary shadow-glow-blue transition-all duration-300 ease-out"
          style={{ width: `${scrollProgress}%` }}
        ></div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 py-12 md:py-24">
        
        {/* CINEMATIC HERO */}
        <div className="mb-48 relative">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-intuition-primary/10 blur-[180px] rounded-full animate-pulse pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 text-intuition-primary mb-12 animate-in slide-in-from-left duration-1000">
              <Activity size={24} className="animate-pulse shadow-glow-blue" />
              <span className="text-[12px] font-black tracking-[1.2em] uppercase opacity-70">Sector_04 // Compendium // v1.4.0</span>
            </div>
            
            <h1 className="text-6xl md:text-[10rem] font-black text-white font-display tracking-tighter uppercase leading-[0.8] mb-16 animate-in slide-in-from-bottom duration-1000 fill-mode-both">
              PROTOCOL<br />
              <span className="text-intuition-primary text-glow-blue">BLUEPRINTS</span>
            </h1>

            <div className="max-w-3xl bg-white/[0.02] border-l-4 border-intuition-primary p-12 clip-path-slant backdrop-blur-xl relative group overflow-hidden animate-in fade-in duration-1000 delay-300">
              <div className="absolute inset-0 bg-gradient-to-r from-intuition-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <p className="text-lg md:text-xl text-slate-300 font-mono leading-relaxed uppercase font-bold tracking-widest relative z-10">
                // Official documentation for the <span className="text-white">IntuRank Intelligence Layer</span>. 
                Establishing the global source of truth via capital-weighted semantic dynamics anchored natively on the 
                <span className="text-intuition-primary underline decoration-2 underline-offset-8 ml-2">INTUITION NETWORK MAINNET</span>.
              </p>
            </div>
          </div>

          <div className="absolute right-0 bottom-0 hidden xl:flex flex-col items-end gap-10 animate-in fade-in slide-in-from-right duration-1000 delay-500">
             <div className="text-right">
                 <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 font-mono">Kernel_Sync_Status</div>
                 <div className="text-2xl text-intuition-success font-black animate-pulse flex items-center justify-end gap-4 tracking-widest uppercase text-glow-success">
                    <ShieldCheck size={32} /> L3_CONVERGENCE
                 </div>
             </div>
             <div className="h-32 w-px bg-gradient-to-b from-white/20 to-transparent"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
          
          {/* TACTICAL NAVIGATION */}
          <aside className="lg:col-span-3 sticky top-32 h-fit hidden lg:block z-50">
            <div className="bg-[#05060b]/80 border border-slate-900 p-8 clip-path-slant shadow-[0_0_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl group">
              <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
                <div className="w-2.5 h-2.5 bg-intuition-primary rounded-full animate-ping shadow-glow-blue"></div>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em]">System_Manifest</h4>
              </div>
              
              <nav className="space-y-4">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    onMouseEnter={playHover}
                    className={`w-full flex items-center justify-between p-4 text-left transition-all border clip-path-slant group/item relative overflow-hidden ${
                      activeSection === item.id 
                        ? 'bg-white text-black border-white shadow-glow-white' 
                        : 'bg-black/40 text-slate-500 border-slate-900 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <item.icon size={16} className={activeSection === item.id ? 'animate-pulse' : 'opacity-30 group-hover/item:opacity-100 transition-opacity'} />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">{item.label}</span>
                    </div>
                    {activeSection === item.id && (
                      <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-transparent opacity-10"></div>
                    )}
                    <ChevronRight size={12} className={activeSection === item.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3 transition-all'} />
                  </button>
                ))}
              </nav>

              <div className="mt-10 pt-8 border-t border-white/5">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center text-[8px] font-black text-slate-700 uppercase tracking-widest">
                    <span>Neural_Load</span>
                    <span>68%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-intuition-primary w-[68%] animate-pulse shadow-glow-blue"></div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* DOCUMENTATION CONTENT */}
          <main className="lg:col-span-9">
            
            {/* 00_INTRODUCTION */}
            <DocSection id="intro" title="The_Intelligence_Layer" icon={Terminal} badge="00_INTRO" color="#00f3ff">
              <div className="space-y-12">
                <p className="text-2xl md:text-4xl text-slate-200 leading-tight uppercase font-black tracking-tight border-l-8 border-intuition-primary pl-10 py-4 group-hover:text-white transition-colors">
                  IntuRank is the <span className="text-intuition-primary">Tactical Command Deck</span> for the Intuition Ecosystem. It turns protocol telemetry into actionable reputation alpha.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="p-4 sm:p-6 md:p-8 lg:p-10 bg-[#050508] border border-slate-900 clip-path-slant relative overflow-hidden group/card hover:border-intuition-primary/40 transition-all shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-white"><Ghost size={120} /></div>
                    <h4 className="text-xs font-black text-intuition-primary uppercase tracking-[0.4em] mb-6 flex items-center gap-3"><Activity size={14}/> Denoising Protocol</h4>
                    <p className="text-sm font-mono text-slate-400 uppercase tracking-widest leading-relaxed group-hover/card:text-slate-200 transition-colors">
                      Raw on-chain data is noisy. We utilize <span className="text-white">Heuristic Sifting</span> to identify high-conviction human signals versus bot-driven volume residuals.
                    </p>
                  </div>
                  <div className="p-4 sm:p-6 md:p-8 lg:p-10 bg-[#050508] border border-slate-900 clip-path-slant relative overflow-hidden group/card hover:border-intuition-secondary/40 transition-all shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-white"><Target size={120} /></div>
                    <h4 className="text-xs font-black text-intuition-secondary uppercase tracking-[0.4em] mb-6 flex items-center gap-3"><Zap size={14}/> Market Verification</h4>
                    <p className="text-sm font-mono text-slate-400 uppercase tracking-widest leading-relaxed group-hover/card:text-slate-200 transition-colors">
                      Before you stake, we verify. Every market is audited for <span className="text-white">Semantic Consistency</span>—ensuring the "Reason" for a rank matches the on-chain metadata.
                    </p>
                  </div>
                </div>
              </div>
            </DocSection>

            {/* 01_MISSION_MOTIVE */}
            <DocSection id="mission" title="Mission_&_Motive" icon={Target} badge="01_MISSION" color="#ff1e6d">
              <div className="space-y-16">
                <div className="p-12 bg-gradient-to-br from-intuition-secondary/10 via-black to-black border-2 border-intuition-secondary/20 clip-path-slant relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.02] text-white pointer-events-none group-hover:scale-110 transition-transform duration-1000"><Database size={240} /></div>
                  <h3 className="text-3xl font-black text-white font-display uppercase tracking-tighter mb-10 flex items-center gap-4">
                    <Zap size={28} className="text-intuition-secondary animate-pulse" /> The Core Motive
                  </h3>
                  <div className="space-y-10 font-mono text-base uppercase tracking-widest leading-relaxed text-slate-400 font-bold">
                    <p>
                      In a world of generative noise and Sybil-driven consensus, <span className="text-white underline decoration-intuition-secondary decoration-4 underline-offset-8">Truth is a Scarce Asset</span>. 
                    </p>
                    <p>
                      IntuRank was built to solve the <span className="text-intuition-primary">Epistemic Crisis</span> of the digital age. By turning belief into a tradeable commodity, we force financial accountability onto semantic claims.
                    </p>
                    <p className="text-slate-200">
                      Our Mission: Establish a machine-readable, trust-less, and verifiable <span className="text-intuition-success">Reputation Infrastructure</span> for the entire on-chain economy.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { title: "INCENTIVIZE_TRUTH", desc: "Rewarding early signalers on high-integrity nodes.", icon: ShieldCheck },
                        { title: "TAX_DECEPTION", desc: "Protocol-level fees make spamming the graph a negative-EV operation.", icon: Coins },
                        { title: "GLOBAL_CONSENSUS", desc: "Building the underlying trust primitive for AI agents and DAOs.", icon: Network }
                    ].map((m, i) => (
                        <div key={i} className="p-8 bg-black border border-white/5 clip-path-slant hover:border-white/20 transition-all">
                            <m.icon size={24} className="text-intuition-primary mb-6" />
                            <h5 className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-4">{m.title}</h5>
                            <p className="text-[11px] text-slate-500 uppercase font-mono tracking-wider leading-relaxed">{m.desc}</p>
                        </div>
                    ))}
                </div>
              </div>
            </DocSection>

            {/* 02_PRIMITIVES */}
            <DocSection id="primitives" title="Semantic_Primitives" icon={Fingerprint} badge="02_PRIMITIVES" color="#00ff9d">
              <div className="space-y-16">
                <p className="text-xl text-slate-300 uppercase tracking-widest leading-relaxed font-bold border-l-4 border-intuition-success pl-10">
                  The Trust Graph is composed of two primary data objects. These are the building blocks of decentralized intelligence.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <ArchitectureNode 
                    title="Atoms" 
                    desc="Atomic identifiers for any unique entity. An Atom represents the 'Who' or 'What'. In the market, an Atom is a liquid pool of reputation capital." 
                    icon={Database} 
                    color="#00f3ff"
                  />
                  <ArchitectureNode 
                    title="Logic Triples" 
                    desc="Directed semantic linkages (Subject-Predicate-Object). Triples define relationships and claims, forming the 'Why' of the network." 
                    icon={Network} 
                    color="#ff1e6d"
                  />
                </div>

                <div className="bg-[#080a12] p-12 border border-slate-800 clip-path-slant relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-intuition-success/[0.03] to-transparent pointer-events-none"></div>
                  <h4 className="text-xs font-black text-intuition-success uppercase tracking-[0.5em] mb-8 flex items-center gap-4"><Zap size={18} className="animate-pulse" /> The Ingress Flow</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 font-mono">
                    <div className="space-y-3">
                        <div className="text-[9px] font-black text-white flex items-center gap-2 uppercase tracking-widest"><div className="w-4 h-px bg-intuition-success"></div> 01_COMMIT</div>
                        <p className="text-[11px] text-slate-500 uppercase leading-relaxed font-bold">Signalers deposit ₸ into an Atom's MultiVault to mint portal shares.</p>
                    </div>
                    <div className="space-y-3">
                        <div className="text-[9px] font-black text-white flex items-center gap-2 uppercase tracking-widest"><div className="w-4 h-px bg-intuition-success"></div> 02_SIGNAL</div>
                        <p className="text-[11px] text-slate-500 uppercase leading-relaxed font-bold">Holding shares signals high-conviction belief in that node's reputation.</p>
                    </div>
                    <div className="space-y-3">
                        <div className="text-[9px] font-black text-white flex items-center gap-2 uppercase tracking-widest"><div className="w-4 h-px bg-intuition-success"></div> 03_HARVEST</div>
                        <p className="text-[11px] text-slate-500 uppercase leading-relaxed font-bold">Signalers liquidate shares on the curve to reclaim assets + arbitrage gains.</p>
                    </div>
                  </div>
                </div>
              </div>
            </DocSection>

            {/* 03_ECONOMICS */}
            <DocSection id="economics" title="Mathematical_Dynamics" icon={TrendingUp} badge="03_CURVES" color="#facc15">
              <div className="space-y-16">
                <div className="p-4 sm:p-6 md:p-10 bg-black border-l-8 border-intuition-warning clip-path-slant font-mono shadow-2xl">
                    <p className="text-slate-400 text-sm leading-relaxed uppercase font-black tracking-widest">
                        // CORE_SPECIFICATION_V1:<br />
                        Pricing is governed by <span className="text-white">Deterministic Bonding Curves</span>. This ensures perpetual liquidity—you can always exit a position, but the cost of entry increases as consensus builds.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="bg-[#0a0a0a] border border-slate-900 p-4 sm:p-6 md:p-10 clip-path-slant group hover:border-intuition-warning/40 transition-all shadow-xl">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-16 h-16 bg-intuition-warning/10 border border-intuition-warning/30 flex items-center justify-center text-intuition-warning clip-path-slant shadow-glow-gold"><TrendingUp size={32}/></div>
                            <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Offset Progressive</h4>
                        </div>
                        <p className="text-[12px] text-slate-500 leading-relaxed uppercase font-mono tracking-widest mb-10 group-hover:text-slate-300">
                            The "Alpha" curve. Exponential price scaling rewards high-conviction early signalers. Designed for discovery phases.
                        </p>
                        <div className="bg-black p-6 border border-white/5 font-mono text-[9px] space-y-4">
                            <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-600 uppercase font-black">Curve_ID</span><span className="text-white">0x01_PROGRESSIVE</span></div>
                            <div className="flex justify-between"><span className="text-slate-600 uppercase font-black">Velocity</span><span className="text-intuition-warning font-black uppercase">QUADRATIC_EXP</span></div>
                        </div>
                    </div>

                    <div className="bg-[#0a0a0a] border border-slate-900 p-4 sm:p-6 md:p-10 clip-path-slant group hover:border-intuition-primary/40 transition-all shadow-xl">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-16 h-16 bg-intuition-primary/10 border border-intuition-primary/30 flex items-center justify-center text-intuition-primary clip-path-slant shadow-glow-blue"><Layers size={32}/></div>
                            <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Linear Utility</h4>
                        </div>
                        <p className="text-[12px] text-slate-500 leading-relaxed uppercase font-mono tracking-widest mb-10 group-hover:text-slate-300">
                            Designed for stable nodes and large-scale organizational clusters. Fixed price-to-supply ratio for predictable ingress.
                        </p>
                        <div className="bg-black p-6 border border-white/5 font-mono text-[9px] space-y-4">
                            <div className="flex justify-between border-b border-white/5 pb-2"><span className="text-slate-600 uppercase font-black">Curve_ID</span><span className="text-white">0x02_STABLE</span></div>
                            <div className="flex justify-between"><span className="text-slate-600 uppercase font-black">Velocity</span><span className="text-intuition-primary font-black uppercase">LINEAR_FIXED</span></div>
                        </div>
                    </div>
                </div>
              </div>
            </DocSection>

            {/* 04_ARES */}
            <DocSection id="ares" title="Intelligence_Synthesis" icon={Cpu} badge="04_ARES_CORE" color="#a855f7">
              <div className="space-y-16">
                <p className="text-2xl text-slate-300 leading-relaxed uppercase tracking-widest font-black font-mono text-center lg:text-left">
                  The <span className="text-white underline decoration-intuition-primary/40">ARES Intelligence Engine</span> is our proprietary denoising layer.
                </p>

                <div className="bg-[#05050a] border border-white/5 p-12 clip-path-slant relative overflow-hidden group shadow-[0_0_120px_rgba(0,0,0,0.8)]">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.02] text-white pointer-events-none group-hover:scale-125 transition-transform duration-1000"><Cpu size={300} /></div>
                  
                  <div className="flex items-center gap-8 mb-12 relative z-10">
                    <Sparkles size={24} className="text-[#a855f7] animate-pulse" />
                    <h4 className="text-sm font-black text-white uppercase tracking-[0.6em]">NEURAL_RECON_PIPELINE</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
                    <div className="space-y-10">
                        <div className="group/item">
                            <div className="text-[10px] font-black text-intuition-primary uppercase tracking-widest mb-4 border-b border-white/5 pb-2 group-hover/item:text-white transition-colors">Semantic Audit</div>
                            <p className="text-[11px] text-slate-500 leading-relaxed uppercase font-mono tracking-widest font-bold group-hover/item:text-slate-300 transition-colors">ARES processes triples through the <span className="text-white">Gemini-3-Pro</span> LLM to identify semantic inconsistencies and project reputation risk vectors.</p>
                        </div>
                        <div className="group/item">
                            <div className="text-[10px] font-black text-intuition-secondary uppercase tracking-widest mb-4 border-b border-white/5 pb-2 group-hover/item:text-white transition-colors">Arbitrage Scoring</div>
                            <p className="text-[11px] text-slate-500 leading-relaxed uppercase font-mono tracking-widest font-bold group-hover/item:text-slate-300 transition-colors">By comparing sentiment bias vs. capital depth, ARES predicts node stabilization points and identifies arbitrage opportunities for signalers.</p>
                        </div>
                    </div>

                    <div className="bg-black/60 border border-white/10 p-10 clip-path-slant flex flex-col justify-center items-center text-center shadow-inner relative overflow-hidden">
                        <div className="absolute inset-0 bg-[#a855f7]/[0.03] animate-pulse"></div>
                        <div className="text-xs font-black text-white uppercase tracking-[0.5em] mb-10 font-display">ARES_CORE_L3_ACTIVE</div>
                        <div className="flex gap-3 mb-10">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="w-2 h-10 bg-[#a855f7] shadow-[0_0_15px_#a855f7] animate-pulse" style={{ animationDelay: `${i * 150}ms` }}></div>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-600 font-mono italic uppercase tracking-tighter max-w-[220px]">"Analyzing global graph for consensus collision probability. Sector_04 stable."</p>
                    </div>
                  </div>
                </div>
              </div>
            </DocSection>

            {/* 05_OPERATOR_GUIDE */}
            <DocSection id="guide" title="Operator_Guide" icon={Command} badge="05_GUIDE" color="#ffffff">
              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { step: "01", title: "Establish Link", desc: "Connect an Ethereum-compatible wallet to the Intuition Network." },
                        { step: "02", title: "Identify Signal", desc: "Select a high-signal Identity or Claim node from the Terminal." },
                        { step: "03", title: "Acquire Shares", desc: "Commit ₸ to ingress. Your conviction is now on-chain." }
                    ].map((step, i) => (
                        <div key={i} className="p-10 bg-[#05060b] border-2 border-slate-900 clip-path-slant hover:border-white transition-all shadow-xl group">
                            <div className="text-4xl font-black text-white font-display mb-6 opacity-10 group-hover:opacity-100 group-hover:text-intuition-primary transition-all">{step.step}</div>
                            <h4 className="text-xs font-black text-white uppercase tracking-[0.3em] mb-4 group-hover:translate-x-2 transition-transform">{step.title}</h4>
                            <p className="text-[11px] text-slate-500 uppercase tracking-widest leading-relaxed group-hover:text-slate-300 transition-colors">{step.desc}</p>
                        </div>
                    ))}
                </div>
              </div>
            </DocSection>

            {/* 06_GLOSSARY */}
            <DocSection id="glossary" title="Neural_Index" icon={BookOpen} badge="06_GLOSSARY" color="#475569">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <GlossaryItem term="Rank" definition="Reputation-weighted score of an atom, derived from total assets and supply deltas." />
                    <GlossaryItem term="MultiVault" definition="The core contract managing identity liquidity pools and portal shares." />
                    <GlossaryItem term="Ingress" definition="The act of committing capital to acquire support or opposition shares in a node." />
                    <GlossaryItem term="Handshake" definition="The smart-contract interaction sequence required to commit or withdraw capital." />
                    <GlossaryItem term="Arbitrage" definition="Extracting value by correcting overvalued or deceptive reputation claims natively." />
                    <GlossaryItem term="Sector_04" definition="Current tactical operating zone for the ARES engine and IntuRank interface." />
                    <GlossaryItem term="Provenance" definition="Verified logical history of a node, tracing creators and primary signalers." />
                    <GlossaryItem term="Synapse" definition="A verified logical link between two discrete semantic primitives." />
                    <GlossaryItem term="Denoising" definition="Algorithmic filtering of sybil volume from high-conviction signals." />
                </div>
            </DocSection>

            {/* FINAL CALL TO ACTION */}
            <div className="mt-48 p-16 md:p-32 bg-black border-2 border-intuition-primary/40 flex flex-col items-center text-center clip-path-slant relative overflow-hidden group shadow-[0_0_150px_rgba(0,243,255,0.2)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,243,255,0.06),transparent_70%)]"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-intuition-primary to-transparent animate-pulse"></div>
                
                <div className="relative z-10 space-y-12">
                    <h3 className="text-4xl md:text-7xl font-black font-display text-white uppercase tracking-tighter leading-[0.9] max-w-4xl text-glow-white">
                        THE_FUTURE_OF_TRUTH<br /><span className="text-intuition-primary">IS_A_MARKET.</span>
                    </h3>
                    <p className="text-xs md:text-base text-slate-500 uppercase tracking-[0.5em] font-mono font-bold max-w-2xl leading-relaxed">
                        Signal intelligence is power. Initialize your transmission sequence to acquire shares in truth.
                    </p>
                    
                    <div className="flex flex-col md:flex-row gap-6 justify-center w-full max-w-xl mx-auto">
                        <Link to="/markets" onClick={playClick} className="flex-1 py-6 bg-white text-black font-black uppercase text-xs tracking-[0.5em] clip-path-slant hover:bg-intuition-primary transition-all shadow-[0_20px_50px_rgba(255,255,255,0.1)] active:scale-95 group/btn flex items-center justify-center gap-3">
                            ENTER_TERMINAL <ArrowRight size={18} className="group-hover/btn:translate-x-3 transition-transform" />
                        </Link>
                        <Link to="/portfolio" onClick={playClick} className="flex-1 py-6 bg-black border border-white/20 text-white font-black uppercase text-xs tracking-[0.5em] clip-path-slant hover:border-white transition-all active:scale-95 flex items-center justify-center gap-3">
                            MY_PORTFOLIO <Activity size={18} />
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mt-24 flex items-center justify-between opacity-10 font-mono text-[8px] font-black uppercase tracking-[2em] pb-24">
                <span>© 2025 IntuRank_Technical_Corps</span>
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-intuition-primary animate-ping"></div>
                  <span>Sector_04_Secured</span>
                </div>
                <span>END_OF_TRANSMISSION</span>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
