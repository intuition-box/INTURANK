import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Database, Network, Cpu, ChevronRight, Activity, Globe, Lock, Terminal, Zap, Hash, TrendingUp, ChevronDown, Radio } from 'lucide-react';
import { formatEther } from 'viem';
import { playHover, playClick } from '../services/audio';
import { getAllAgents, getNetworkStats } from '../services/graphql';

// Ticker Component
const TickerItem: React.FC<{ symbol: string, price: string, isUp: boolean }> = ({ symbol, price, isUp }) => (
  <div className="flex items-center gap-4 px-6 py-3 border-r border-intuition-primary/10 text-sm font-mono whitespace-nowrap bg-black/40 backdrop-blur-sm hover:bg-intuition-primary/10 transition-colors group">
    <span className="text-white font-black tracking-wider drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] group-hover:text-intuition-primary transition-colors">{symbol}</span>
    <span className="text-slate-400 font-bold">{price}</span>
    <span className={`flex items-center gap-1 font-bold text-xs px-1.5 py-0.5 rounded ${isUp ? 'bg-intuition-success/10 text-intuition-success border border-intuition-success/30' : 'bg-intuition-danger/10 text-intuition-danger border border-intuition-danger/30'}`}>
      {isUp ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
      {isUp ? '+' : ''}{Math.floor(Math.random() * 5)}.{Math.floor(Math.random() * 9)}%
    </span>
  </div>
);

const Home: React.FC = () => {
  const [tickerData, setTickerData] = useState<any[]>([]);
  const [stats, setStats] = useState({ tvl: "0", atoms: 0, signals: 0, positions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      try {
        // Fetch Real Top Agents for Ticker
        const agents = await getAllAgents();
        const topAgents = agents.slice(0, 20).map(a => {
           const assets = parseFloat(formatEther(BigInt(a.totalAssets || '0')));
           const shares = parseFloat(formatEther(BigInt(a.totalShares || '0')));
           const price = shares > 0 ? (assets / shares).toFixed(4) : "0.0000";
           const isUp = Math.random() > 0.4; 
           return {
             symbol: a.label.toUpperCase().slice(0, 16),
             price: `${price}`,
             isUp
           };
        });
        setTickerData(topAgents);

        // Fetch Real Network Stats
        const netStats = await getNetworkStats();
        setStats(netStats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Format TVL
  const formattedTVL = (() => {
    const val = parseFloat(formatEther(BigInt(stats.tvl)));
    if (val > 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val > 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toFixed(2);
  })();

  return (
    <div className="relative flex flex-col min-h-screen overflow-x-hidden bg-[#02040a]">
      
      {/* --- HERO SECTION --- */}
      <div className="relative min-h-[90vh] flex flex-col justify-center items-center overflow-hidden border-b border-intuition-primary/20">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-intuition-primary/10 via-black to-black opacity-50"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 border border-intuition-primary/10 rounded-full animate-[spin_20s_linear_infinite] border-dashed pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] border border-intuition-secondary/10 rounded-full animate-[spin_30s_linear_infinite_reverse] border-dotted pointer-events-none"></div>
        
        <div className="relative z-10 text-center max-w-5xl px-4 mt-10">
          <div 
            onMouseEnter={playHover}
            className="inline-flex items-center gap-3 px-6 py-2 mb-10 border border-intuition-primary/50 bg-black/80 backdrop-blur-md rounded-none text-intuition-primary font-mono text-xs tracking-[0.3em] uppercase hover-glow cursor-help clip-path-slant"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-intuition-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-intuition-primary"></span>
            </span>
            INTUITION MAINNET ACTIVE
          </div>

          <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-white mb-8 leading-[0.85] font-display drop-shadow-[0_0_25px_rgba(0,243,255,0.3)]">
            SEMANTIC <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-intuition-primary via-white to-intuition-secondary hover-glitch">CAPITALISM</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-12 font-mono leading-relaxed">
            <span className="text-intuition-primary">>></span> The intelligence layer of the open web.<br/>
            <span className="text-intuition-primary">>></span> Stake on identity. Short the noise. Profit from truth.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">
            <Link
              to="/markets"
              onClick={playClick}
              onMouseEnter={playHover}
              className="group relative w-64 py-5 bg-intuition-primary text-black font-black text-lg tracking-widest font-display overflow-hidden clip-path-slant hover-glow transition-all hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-white/40 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative flex items-center justify-center gap-2">
                ENTER_MARKET <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </span>
            </Link>
            
            <Link
              to="/stats"
              onClick={playClick}
              onMouseEnter={playHover}
              className="group w-64 py-5 border border-intuition-primary/50 text-intuition-primary font-bold text-lg tracking-widest font-display bg-black/50 hover:bg-intuition-primary/10 transition-all clip-path-slant hover-glow hover:-translate-y-1 flex items-center justify-center"
            >
              LEADERBOARD
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 animate-bounce text-intuition-primary/50 flex flex-col items-center">
          <ChevronDown size={32} />
        </div>
      </div>

      {/* --- LIVE TICKER (SUPERB VERSION) --- */}
      <div className="border-y border-intuition-primary/30 bg-black py-1 overflow-hidden relative z-20 h-14 flex items-center group">
         {/* Live Indicator */}
         <div className="absolute left-0 top-0 bottom-0 bg-black z-30 px-4 flex items-center gap-2 border-r border-intuition-primary/30 shadow-[10px_0_20px_rgba(0,0,0,1)]">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
            <span className="text-xs font-black font-display text-white tracking-widest">LIVE</span>
         </div>

         {/* Gradients for smooth fade in/out */}
         <div className="absolute top-0 left-[80px] w-32 h-full bg-gradient-to-r from-black to-transparent z-20 pointer-events-none"></div>
         <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-black to-transparent z-20 pointer-events-none"></div>
         
         {/* Moving Content - Using gap-0 and duplicating for seamless loop */}
         <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] ml-24">
            <div className="flex shrink-0">
               {loading ? (
                  <span className="text-intuition-primary font-mono px-8 animate-pulse flex items-center gap-2">
                      <Radio size={14} className="animate-spin" /> ESTABLISHING UPLINK TO INTUITION NETWORK...
                  </span>
               ) : tickerData.length > 0 ? (
                  tickerData.map((item, i) => (
                     <TickerItem key={i} symbol={item.symbol} price={item.price} isUp={item.isUp} />
                  ))
               ) : (
                  <TickerItem symbol="INTUITION" price="LOADING..." isUp={true} />
               )}
            </div>
            {/* Duplicate for Seamless Loop */}
            <div className="flex shrink-0">
               {loading ? (
                  <span className="text-intuition-primary font-mono px-8 animate-pulse flex items-center gap-2">
                       <Radio size={14} className="animate-spin" /> ESTABLISHING UPLINK TO INTUITION NETWORK...
                  </span>
               ) : tickerData.length > 0 ? (
                  tickerData.map((item, i) => (
                     <TickerItem key={`dup-${i}`} symbol={item.symbol} price={item.price} isUp={item.isUp} />
                  ))
               ) : (
                  <TickerItem symbol="INTUITION" price="LOADING..." isUp={true} />
               )}
            </div>
         </div>
      </div>

      {/* --- NETWORK TELEMETRY --- */}
      <div className="py-24 bg-[#03050a] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-intuition-primary/5 to-transparent pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex items-center gap-4 mb-12">
            <Activity className="text-intuition-primary animate-pulse" size={32} />
            <h2 className="text-3xl font-display font-bold text-white tracking-wide">NETWORK_TELEMETRY</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatBox label="Total Value Locked" value={`${formattedTVL} TRUST`} sub="On-Chain Assets" delay="0" loading={loading} />
            <StatBox label="Active Signals" value={stats.signals.toLocaleString()} sub="Semantic Triples" delay="100" loading={loading} />
            <StatBox label="Identity Nodes" value={stats.atoms.toLocaleString()} sub="Verified Atoms" delay="200" loading={loading} />
            <StatBox label="Active Positions" value={stats.positions.toLocaleString()} sub="Staked Claims" delay="300" loading={loading} />
          </div>
        </div>
      </div>

      {/* --- HOW IT WORKS --- */}
      <div className="py-32 border-t border-intuition-primary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-intuition-secondary/5 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black font-display text-white mb-6">THE PROTOCOL</h2>
            <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">Initializing Trust Algorithm...</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <StepCard 
              num="01" 
              icon={<Shield className="text-intuition-primary" size={48} />}
              title="IDENTIFY"
              desc="Every person, organization, and concept is an 'Atom' on the graph. Find undervalued reputation assets."
            />
            <StepCard 
              num="02" 
              icon={<Zap className="text-intuition-warning" size={48} />}
              title="SIGNAL"
              desc="Stake TRUST tokens to vouch for (or against) an identity. Your stake creates a signal strength."
            />
            <StepCard 
              num="03" 
              icon={<Cpu className="text-intuition-success" size={48} />}
              title="PROFIT"
              desc="Earn yield as others signal on the same atoms. Early signalers capture the most value."
            />
          </div>
        </div>
      </div>

      {/* --- THE MANIFESTO (TERMINAL) --- */}
      <div className="py-24 bg-black border-y border-intuition-primary/20 relative">
        <div className="max-w-4xl mx-auto px-4">
          <div className="w-full bg-[#0a0f1a] border border-intuition-border rounded-lg overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] transform hover:scale-[1.01] transition-transform duration-500">
            <div className="bg-[#1f2937] px-4 py-2 flex items-center gap-2 border-b border-black">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div className="ml-4 text-[10px] font-mono text-slate-400">mission_log.txt</div>
            </div>
            <div className="p-8 font-mono text-sm md:text-base leading-relaxed text-slate-300 relative">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
              <p className="mb-4 text-intuition-primary">>> SYSTEM BOOT SEQUENCE INITIATED...</p>
              <p className="mb-4">
                The internet is broken. Information is abundant, but <span className="text-white font-bold">trust</span> is scarce. 
                We are drowning in noise, deepfakes, and sybil attacks.
              </p>
              <p className="mb-4">
                Intuition is the solution. A decentralized, semantic graph where reputation has a price. 
                By attaching financial value to truth, we make lying expensive.
              </p>
              <p className="mb-6">
                <span className="text-intuition-success">We are building the credit score for everything.</span> Not controlled by a bank, 
                but by you. The market decides what is true.
              </p>
              <p className="animate-pulse text-intuition-primary">>> AWAITING INPUT_</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- CTA FOOTER --- */}
      <div className="py-32 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
        <div className="relative z-10">
          <h2 className="text-5xl md:text-7xl font-black font-display text-white mb-8 tracking-tighter">
            JOIN THE <span className="text-intuition-primary">VANGUARD</span>
          </h2>
          <div className="flex justify-center">
            <Link 
              to="/markets" 
              onClick={playClick}
              className="px-12 py-6 bg-white text-black font-black font-display text-xl tracking-widest clip-path-slant hover:bg-intuition-primary transition-colors shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(0,243,255,0.6)]"
            >
              INITIALIZE_LINK
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};

const StatBox = ({ label, value, sub, delay, loading }: any) => (
  <div 
    className="p-6 border border-intuition-border bg-intuition-card/50 clip-path-slant hover:border-intuition-primary/50 transition-all hover:-translate-y-2 group relative overflow-hidden"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
        <TrendingUp size={40} />
    </div>
    <div className="text-slate-500 font-mono text-xs uppercase tracking-widest mb-2 relative z-10">{label}</div>
    {loading ? (
        <div className="h-8 w-24 bg-white/10 animate-pulse rounded mb-1"></div>
    ) : (
        <div className="text-3xl md:text-4xl font-black text-white font-display mb-1 group-hover:text-intuition-primary transition-colors relative z-10">{value}</div>
    )}
    <div className="text-intuition-success font-mono text-xs relative z-10">{sub}</div>
  </div>
);

const StepCard = ({ num, icon, title, desc }: any) => (
  <div 
    onMouseEnter={playHover}
    className="relative p-8 border border-intuition-border bg-black/50 hover:bg-intuition-primary/5 transition-all duration-500 group clip-path-slant"
  >
    <div className="absolute -top-6 -left-6 text-8xl font-black text-intuition-border/20 font-display group-hover:text-intuition-primary/10 transition-colors select-none">
      {num}
    </div>
    <div className="relative z-10">
      <div className="mb-6 p-4 inline-block bg-black border border-intuition-border rounded-lg group-hover:border-intuition-primary group-hover:shadow-[0_0_20px_rgba(0,243,255,0.2)] transition-all">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-white mb-4 font-display tracking-wide">{title}</h3>
      <p className="text-slate-400 font-mono text-sm leading-relaxed border-l-2 border-intuition-primary/20 pl-4 group-hover:border-intuition-primary/60 transition-colors">
        {desc}
      </p>
    </div>
  </div>
);

export default Home;