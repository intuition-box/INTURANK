import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Shield, CheckCircle, AlertTriangle, MessageSquare, Activity, Tag, Binary, Fingerprint, ChevronsRight, Share2 } from 'lucide-react';
import { Claim } from '../types';
import { playClick, playHover } from '../services/audio';
import { toast } from './Toast';

const HUMAN_PREDICATES: Record<string, { label: string; verb: string; icon: any; color: string; glow: string }> = {
    'TRUST': { label: 'TRUST_SIGNAL', verb: 'validating', icon: CheckCircle, color: 'text-intuition-success', glow: 'bg-intuition-success' },
    'DISTRUST': { label: 'DISTRUST_SIGNAL', verb: 'opposing', icon: AlertTriangle, color: 'text-intuition-danger', glow: 'bg-intuition-danger' },
    'SIGNALED': { label: 'LINK_ESTABLISHED', verb: 'linked to', icon: Activity, color: 'text-intuition-primary', glow: 'bg-intuition-primary' },
    'HAS TAG': { label: 'SEMANTIC_TAG', verb: 'categorizing', icon: Tag, color: 'text-intuition-primary', glow: 'bg-intuition-primary' },
    'HAS_OPINION': { label: 'AGENT_OPINION', verb: 'believes in', icon: MessageSquare, color: 'text-intuition-primary', glow: 'bg-intuition-primary' }
};

const ClaimCard: React.FC<{ claim: Claim }> = ({ claim }) => {
  const [expanded, setExpanded] = useState(false);
  const predKey = claim.predicate.toUpperCase();
  const info = HUMAN_PREDICATES[predKey] || { 
      label: 'GENERIC_SIGNAL', 
      verb: 'linking', 
      icon: Activity, 
      color: 'text-slate-400', 
      glow: 'bg-slate-400'
  };
  const Icon = info.icon;

  return (
    <div 
      className={`relative group border transition-all duration-300 bg-[#05080f]/80 backdrop-blur-md clip-path-slant overflow-hidden mb-1.5 ${expanded ? 'border-intuition-primary/40 shadow-[0_0_20px_rgba(0,243,255,0.05)]' : 'border-white/5 hover:border-white/10 hover:bg-white/5'}`}
    >
      <div 
        className="p-1.5 md:p-2.5 flex flex-col md:flex-row items-center gap-3 cursor-pointer relative z-10"
        onClick={() => { playClick(); setExpanded(!expanded); }}
        onMouseEnter={playHover}
      >
        {/* Origin Node (Left Side) */}
        <div className="flex items-center gap-2.5 w-full md:w-[32%] shrink-0">
          <div className="relative">
            <div className="w-9 h-9 bg-black border border-white/10 flex items-center justify-center overflow-hidden relative z-10 clip-path-slant group-hover:border-intuition-primary/40 transition-colors">
                {claim.subject.image ? (
                    <img src={claim.subject.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                ) : (
                    <User size={14} className="text-slate-600" />
                )}
            </div>
          </div>
          <div className="flex flex-col min-w-0">
             <div className="flex items-center gap-1 opacity-40">
                 <Fingerprint size={8} className="text-slate-500" />
                 <span className="text-[5px] font-black font-mono text-slate-500 uppercase tracking-widest">Origin</span>
             </div>
             <span className="text-xs font-black text-white truncate group-hover:text-intuition-primary transition-colors font-display uppercase tracking-tight">
                 {claim.subject.label || claim.subject.id.slice(0,8)}
             </span>
             <span className="text-[6px] font-mono text-slate-700 uppercase leading-none">H: {claim.subject.id.slice(0, 8)}</span>
          </div>
        </div>

        {/* Semantic Bridge (Center) */}
        <div className="flex flex-col items-center justify-center flex-1 w-full px-2 relative min-h-[28px]">
           <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-white/5 -translate-y-1/2"></div>
           
           <div className={`relative z-10 flex items-center gap-1.5 bg-[#05080f] px-3 py-0.5 border border-white/5 rounded-full group-hover:border-intuition-primary/20 transition-all`}>
              <Icon size={10} className={`animate-pulse ${info.color}`} />
              <span className={`text-[6px] md:text-[7px] font-black font-display uppercase tracking-[0.2em] ${info.color}`}>{info.label}</span>
           </div>

           <div className="mt-0.5 flex items-center gap-1.5">
                <div className="w-8 h-0.5 bg-slate-900 rounded-full overflow-hidden">
                    <div style={{ width: `${claim.confidence}%` }} className={`h-full ${info.glow} opacity-40`}></div>
                </div>
                <span className="text-[5px] font-mono text-slate-700 uppercase">Mag_{claim.confidence}%</span>
           </div>
        </div>

        {/* Target Node (Right Side) */}
        <div className="flex items-center justify-end gap-2.5 w-full md:w-[32%] shrink-0 text-right">
          <div className="flex flex-col min-w-0 items-end">
             <div className="flex items-center gap-1 opacity-40">
                 <span className="text-[5px] font-black font-mono text-slate-500 uppercase tracking-widest">Target</span>
                 <Binary size={8} className="text-slate-500" />
             </div>
             <Link 
                to={`/markets/${claim.object.id}`} 
                onClick={(e) => e.stopPropagation()} 
                className="text-xs font-black text-white hover:text-intuition-primary transition-all truncate font-display uppercase tracking-tight"
             >
                {claim.object.label || claim.object.id.slice(0,8)}
             </Link>
             <span className="text-[6px] font-mono text-slate-700 uppercase leading-none">T: {claim.object.type || 'ATOM'}</span>
          </div>
          <div className="w-9 h-9 bg-black border border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative z-10 clip-path-slant group-hover:border-intuition-primary/40 transition-colors">
                {claim.object.image ? (
                    <img src={claim.object.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                ) : (
                    <Shield size={14} className="text-slate-700" />
                )}
          </div>
        </div>
      </div>

      {/* Extended Context Panel (Details on Demand) */}
      {expanded && (
        <div className="bg-black/90 border-t border-white/5 p-3 animate-in slide-in-from-top-1 duration-300 relative">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 relative z-10">
               <div className="lg:col-span-9">
                   <div className="p-2.5 bg-white/5 border border-white/5 clip-path-slant italic font-mono text-[9px] text-slate-400 leading-relaxed">
                        {" > "} DECRYPTED_SIGNAL: "{claim.reason || 'Semantic link established via consensus staking. No descriptive payload detected in this packet.'}"
                   </div>
               </div>
               
               <div className="lg:col-span-3 flex items-center gap-1.5">
                   <Link 
                      to={`/markets/${claim.object.id}`}
                      onClick={playClick}
                      className="flex-1 btn-cyber btn-cyber-cyan py-1.5 text-[7px] font-black h-7"
                   >
                       INSPECT_MARKET <ChevronsRight size={10} className="ml-1" />
                   </Link>
                   <button 
                      onClick={() => { toast.info("Linked Shared"); playClick(); }}
                      className="w-8 h-7 border border-white/10 hover:bg-white/5 text-slate-500 hover:text-white transition-all clip-path-slant flex items-center justify-center"
                   >
                       <Share2 size={12} />
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ClaimCard;