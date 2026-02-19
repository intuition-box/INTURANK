
import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, ShieldAlert, ZapOff, ArrowLeft, Radio, Network } from 'lucide-react';
import { playClick, playHover } from '../services/audio';

const ComingSoon: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 relative overflow-hidden font-mono">
      {/* HUD Background Decorations */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-intuition-primary/5 rounded-full blur-[120px] animate-pulse pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-[#050505] border-2 border-intuition-primary/40 p-12 md:p-16 flex flex-col items-center text-center clip-path-slant shadow-[0_0_100px_rgba(0,0,0,1)] relative overflow-hidden">
          
          {/* Animated Scanline Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-10"></div>
          
          {/* Status Badge */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-intuition-secondary/10 border border-intuition-secondary px-6 py-1 text-[9px] font-black text-intuition-secondary tracking-[0.4em] uppercase clip-path-slant animate-pulse shadow-glow-red">
            ACCESS_RESTRICTED
          </div>

          <div className="relative mb-12 mt-4">
            <div className="absolute -inset-8 bg-intuition-primary/20 blur-3xl rounded-full animate-pulse"></div>
            <div className="w-24 h-24 bg-black border-2 border-intuition-primary flex items-center justify-center text-intuition-primary shadow-glow-blue clip-path-slant transition-transform duration-1000 group-hover:rotate-12">
              <ZapOff size={48} className="animate-pulse" />
            </div>
          </div>

          <div className="mb-10 space-y-4">
            <h1 className="text-4xl md:text-6xl font-black text-white font-display tracking-tighter uppercase leading-none text-glow-white">SIGNAL_INGRESS</h1>
            <h1 className="text-4xl md:text-6xl font-black text-intuition-primary font-display tracking-tighter uppercase leading-none text-glow-blue">ENCRYPTED</h1>
          </div>

          <p className="text-xs font-black text-slate-500 uppercase tracking-[0.25em] leading-relaxed max-w-md mb-12">
            Sector_05 integration is currently in progress. Neural handshake for <span className="text-white">ON-CHAIN_CREATION</span> protocols will be activated in the next terminal push.
          </p>

          <div className="w-full flex flex-col md:flex-row gap-4 relative z-20">
            <Link 
              to="/" 
              onClick={playClick}
              onMouseEnter={playHover}
              className="flex-1 bg-white/5 border border-white/10 hover:border-white text-white font-black py-4 text-xs tracking-[0.3em] uppercase flex items-center justify-center gap-3 transition-all clip-path-slant"
            >
              <ArrowLeft size={16} /> RETURN_TO_ROOT
            </Link>
            <Link 
              to="/markets" 
              onClick={playClick}
              onMouseEnter={playHover}
              className="flex-1 bg-intuition-primary hover:bg-white text-black font-black py-4 text-xs tracking-[0.3em] uppercase flex items-center justify-center gap-3 transition-all shadow-glow-blue clip-path-slant"
            >
              <Network size={16} /> EXPLORER_MARKETS
            </Link>
          </div>

          {/* HUD Tech Readout */}
          <div className="mt-12 flex items-center justify-center gap-8 border-t border-white/5 pt-8 w-full opacity-60 font-mono">
            <div className="flex flex-col items-center">
              <span className="text-[7px] text-slate-600 uppercase font-black tracking-widest mb-1">Module</span>
              <span className="text-[9px] font-black text-white uppercase tracking-widest">S05_CREATE</span>
            </div>
            <div className="w-px h-6 bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="text-[7px] text-slate-600 uppercase font-black tracking-widest mb-1">Handshake</span>
              <span className="text-[9px] font-black text-intuition-secondary uppercase tracking-widest">PENDING_SYNC</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 text-slate-700 text-[8px] font-black uppercase tracking-[0.4em] opacity-40">
          <Terminal size={10} />
          SYSTEM_VERSION_1.3.0_STABLE // SECTOR_04_ARES
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
