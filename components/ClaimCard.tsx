
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Shield, CheckCircle, AlertTriangle, MessageSquare, Activity, Tag, Binary, Fingerprint, ChevronsRight, Share2, ChevronDown } from 'lucide-react';
import { Claim } from '../types';
import { playClick, playHover } from '../services/audio';
import { toast } from './Toast';

const HUMAN_PREDICATES: Record<string, { label: string; verb: string; icon: any; color: string; glow: string }> = {
    'TRUST': { label: 'TRUST_SIGNAL', verb: 'validating', icon: CheckCircle, color: 'text-intuition-success', glow: 'bg-intuition-success' },
    'DISTRUST': { label: 'DISTRUST_SIGNAL', verb: 'opposing', icon: AlertTriangle, color: 'text-intuition-danger', glow: 'bg-intuition-danger' },
    'SIGNALED': { label: 'LINK_ESTABLISHED', verb: 'linked to', icon: Activity, color: 'text-intuition-primary', glow: 'bg-intuition-primary' },
    'HAS_TAG': { label: 'SEMANTIC_TAG', verb: 'categorizing', icon: Tag, color: 'text-intuition-primary', glow: 'bg-intuition-primary' },
    'HAS TAG': { label: 'SEMANTIC_TAG', verb: 'categorizing', icon: Tag, color: 'text-intuition-primary', glow: 'bg-intuition-primary' },
    'HAS_OPINION': { label: 'AGENT_OPINION', verb: 'believes in', icon: MessageSquare, color: 'text-intuition-primary', glow: 'bg-intuition-primary' },
    'OPINION': { label: 'AGENT_OPINION', verb: 'believes in', icon: MessageSquare, color: 'text-intuition-primary', glow: 'bg-intuition-primary' }
};

const ClaimCard: React.FC<{ claim: Claim }> = ({ claim }) => {
  const [expanded, setExpanded] = useState(false);
  
  const predKey = claim.predicate.toUpperCase().replace(/\s+/g, '_');
  const info = HUMAN_PREDICATES[predKey] || HUMAN_PREDICATES[claim.predicate.toUpperCase()] || { 
      label: 'GENERIC_SIGNAL', 
      verb: 'linking', 
      icon: Activity, 
      color: 'text-slate-400', 
      glow: 'bg-slate-400'
  };
  const Icon = info.icon;

  const handleToggle = (e: React.MouseEvent) => {
    // Prevent expansion toggle if user clicks a link inside the card
    if ((e.target as HTMLElement).closest('a')) {
        return;
    }
    playClick();
    setExpanded(!expanded);
  };

  return (
    <div 
      className={`relative group border transition-all duration-300 bg-[#05080f] clip-path-slant overflow-hidden mb-1.5 cursor-pointer select-none ${
        expanded 
          ? 'border-intuition-primary shadow-[0_0_30px_rgba(0,243,255,0.1)] bg-slate-900/40' 
          : 'border-white/5 hover:border-white/20 hover:bg-white/5'
      }`}
      onClick={handleToggle}
      onMouseEnter={playHover}
    >
      {/* Background Hover Accent */}
      <div className={`absolute inset-0 bg-gradient-to-r from-intuition-primary/5 to-transparent transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>

      <div className="p-2 md:p-3 flex flex-col md:flex-row items-center gap-4 relative z-10">
        
        {/* Origin Node */}
        <div className="flex items-center gap-3 w-full md:w-[30%] shrink-0">
          <div className="w-10 h-10 bg-black border border-white/10 flex items-center justify-center overflow-hidden shrink-0 clip-path-slant group-hover:border-intuition-primary/40 transition-colors">
              {claim.subject.image ? (
                  <img src={claim.subject.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
              ) : (
                  <User size={16} className="text-slate-600" />
              )}
          </div>
          <div className="flex flex-col min-w-0">
             <div className="flex items-center gap-1 opacity-40">
                 <Fingerprint size={8} className="text-slate-500" />
                 <span className="text-[6px] font-black font-mono text-slate-500 uppercase tracking-widest leading-none">Origin</span>
             </div>
             <span className="text-xs font-black text-white truncate font-display uppercase tracking-tight leading-tight">
                 {claim.subject.label || claim.subject.id.slice(0,8)}
             </span>
          </div>
        </div>

        {/* Semantic Bridge */}
        <div className="flex flex-col items-center justify-center flex-1 w-full relative min-h-[32px]">
           <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-white/5 -translate-y-1/2 opacity-50"></div>
           
           <div className={`relative z-10 flex items-center gap-1.5 bg-[#05080f] px-4 py-1 border rounded-full transition-all duration-300 ${expanded ? 'border-intuition-primary' : 'border-white/10 group-hover:border-white/30'}`}>
              <Icon size={12} className={`animate-pulse ${info.color}`} />
              <span className={`text-[7px] md:text-[8px] font-black font-display uppercase tracking-[0.2em] ${info.color}`}>{info.label}</span>
           </div>
        </div>

        {/* Target Node */}
        <div className="flex items-center justify-end gap-3 w-full md:w-[30%] shrink-0 text-right">
          <div className="flex flex-col min-w-0 items-end">
             <div className="flex items-center gap-1 opacity-40">
                 <span className="text-[6px] font-black font-mono text-slate-500 uppercase tracking-widest leading-none">Target</span>
                 <Binary size={8} className="text-slate-500" />
             </div>
             <Link 
                to={`/markets/${claim.object.id}`} 
                onClick={(e) => e.stopPropagation()} 
                className="text-xs font-black text-white hover:text-intuition-primary transition-all truncate font-display uppercase tracking-tight leading-tight border-b border-transparent hover:border-intuition-primary"
             >
                {claim.object.label || claim.object.id.slice(0,8)}
             </Link>
          </div>
          <div className="w-10 h-10 bg-black border border-white/10 flex items-center justify-center overflow-hidden shrink-0 clip-path-slant group-hover:border-intuition-primary/40 transition-colors relative">
                {claim.object.image ? (
                    <img src={claim.object.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                ) : (
                    <Shield size={16} className="text-slate-700" />
                )}
          </div>
          <div className="ml-2 pl-2 border-l border-white/5 hidden md:flex items-center justify-center text-slate-700 group-hover:text-slate-400 transition-colors">
              <ChevronDown size={14} className={`transition-transform duration-500 ${expanded ? 'rotate-180 text-intuition-primary' : ''}`} />
          </div>
        </div>
      </div>

      {/* Expanded Context Panel */}
      {expanded && (
        <div className="bg-black/80 border-t border-white/10 p-4 animate-in slide-in-from-top-2 duration-300 relative z-10">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
               <div className="lg:col-span-9">
                   <div className="p-3 bg-white/5 border border-white/10 clip-path-slant relative overflow-hidden group/text">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-intuition-primary opacity-40"></div>
                        <p className="font-mono text-[10px] text-slate-300 leading-relaxed uppercase tracking-tight">
                             {" > "} DECRYPTED_SIGNAL_PAYLOAD: "{claim.reason || 'Semantic linkage established via protocol consensus. This signal represents an active market vector on the Intuition Network.'}"
                        </p>
                   </div>
               </div>
               
               <div className="lg:col-span-3 flex items-center gap-2">
                   <Link 
                      to={`/markets/${claim.object.id}`}
                      onClick={(e) => { playClick(); e.stopPropagation(); }}
                      className="flex-1 btn-cyber btn-cyber-primary py-2 text-[8px] font-black h-9 shadow-glow-blue"
                   >
                       INSPECT_TARGET <ChevronsRight size={12} className="ml-1" />
                   </Link>
                   <button 
                      onClick={(e) => { e.stopPropagation(); playClick(); toast.success("UPLINK_SHARED"); }}
                      className="w-10 h-9 border border-white/10 bg-black hover:bg-white/5 text-slate-500 hover:text-white transition-all clip-path-slant flex items-center justify-center"
                   >
                       <Share2 size={14} />
                   </button>
               </div>
           </div>
           
           <div className="mt-4 flex items-center justify-between text-[7px] font-mono font-black text-slate-700 uppercase tracking-widest opacity-60">
                <div>HASH: {claim.id}</div>
                <div>TIMESTAMP: {new Date(claim.timestamp).toLocaleString()}</div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ClaimCard;
