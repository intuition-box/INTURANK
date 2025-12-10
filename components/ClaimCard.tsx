import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Shield, CheckCircle, AlertTriangle, ExternalLink, ChevronDown, Activity, MessageSquare, Clock } from 'lucide-react';
import { Claim } from '../types';
import { EXPLORER_URL } from '../constants';
import { playClick, playHover } from '../services/audio';

const ClaimCard: React.FC<{ claim: Claim }> = ({ claim }) => {
  const [expanded, setExpanded] = useState(false);

  // Styling logic based on Predicate
  let colorClass = 'text-intuition-primary';
  let borderClass = 'border-intuition-primary';
  let bgClass = 'bg-intuition-primary/10';
  let shadowClass = 'group-hover:shadow-[0_0_20px_rgba(0,243,255,0.2)]';
  let Icon = MessageSquare; 

  if (claim.predicate === 'TRUST') {
      colorClass = 'text-intuition-success';
      borderClass = 'border-intuition-success';
      bgClass = 'bg-intuition-success/10';
      shadowClass = 'group-hover:shadow-[0_0_20px_rgba(0,255,157,0.3)]';
      Icon = CheckCircle;
  } else if (claim.predicate === 'DISTRUST') {
      colorClass = 'text-intuition-danger';
      borderClass = 'border-intuition-danger';
      bgClass = 'bg-intuition-danger/10';
      shadowClass = 'group-hover:shadow-[0_0_20px_rgba(255,0,85,0.3)]';
      Icon = AlertTriangle;
  }

  return (
    <div 
      className={`relative border border-intuition-border bg-[#0a0f1a] transition-all duration-300 overflow-hidden clip-path-slant group ${expanded ? `border-intuition-primary shadow-[0_0_30px_rgba(0,243,255,0.15)]` : `hover:border-intuition-border/80 ${shadowClass}`}`}
    >
      {/* Connector Line (Decorative) */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${bgClass} transition-all duration-500`}></div>

      <div 
        className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 cursor-pointer"
        onClick={() => { playClick(); setExpanded(!expanded); }}
        onMouseEnter={playHover}
      >
        {/* Subject */}
        <div className="flex items-center gap-3 min-w-[140px]">
          <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
             {claim.subject.image ? (
                 <img src={claim.subject.image} className="w-full h-full object-cover" />
             ) : (
                 <User size={18} className="text-slate-500" />
             )}
          </div>
          <div className="flex flex-col">
             <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Claimant</span>
             <span className="text-sm font-bold text-white truncate max-w-[100px] group-hover:text-glow">{claim.subject.label}</span>
          </div>
        </div>

        {/* Predicate Action */}
        <div className="flex-1 flex flex-col items-center justify-center relative px-4">
           <div className={`flex items-center gap-2 text-xs font-black font-display uppercase tracking-widest ${colorClass} drop-shadow-md`}>
              <Icon size={14} />
              {/* Display actual predicate */}
              {claim.predicate}
           </div>
           <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-1"></div>
           <div className="text-[10px] text-slate-500 font-mono">CONFIDENCE: <span className="text-white">{claim.confidence}%</span></div>
        </div>

        {/* Object */}
        <div className="flex items-center gap-3 justify-end min-w-[140px]">
          <div className="flex flex-col text-right">
             <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Target</span>
             <Link 
                to={`/markets/${claim.object.id}`} 
                onClick={(e) => e.stopPropagation()} 
                className="text-sm font-bold text-white hover:text-intuition-primary transition-colors truncate max-w-[100px] hover:text-glow"
             >
                {claim.object.label}
             </Link>
          </div>
          <div className="w-10 h-10 rounded bg-black border border-intuition-primary/30 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(0,243,255,0.15)] group-hover:shadow-[0_0_25px_rgba(0,243,255,0.4)] transition-shadow">
             {claim.object.image ? (
                 <img src={claim.object.image} className="w-full h-full object-cover" />
             ) : (
                 <Shield size={18} className="text-intuition-primary" />
             )}
          </div>
        </div>

        {/* Date & Expand Arrow */}
        <div className="absolute right-2 top-2 sm:static sm:ml-4 flex flex-col items-end gap-1">
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-slate-500">
               <Clock size={10} />
               {new Date(claim.timestamp).toLocaleDateString()}
            </div>
            <ChevronDown size={14} className={`text-slate-600 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="bg-black/50 border-t border-white/5 p-4 animate-in slide-in-from-top-2">
           {claim.reason && (
               <div className="mb-4 p-3 bg-intuition-card border border-slate-800 rounded relative box-glow">
                   <MessageSquare size={14} className="absolute top-3 left-3 text-slate-600" />
                   <p className="pl-6 text-sm font-mono text-slate-300 italic">"{claim.reason}"</p>
               </div>
           )}
           
           <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase">
               <div className="flex gap-4 items-center">
                   {claim.txHash && (
                       <a 
                         href={`${EXPLORER_URL}/tx/${claim.txHash}`} 
                         target="_blank" 
                         rel="noreferrer"
                         className="flex items-center gap-1 hover:text-intuition-primary transition-colors"
                         onClick={(e) => e.stopPropagation()}
                       >
                           <ExternalLink size={10} /> TX: {claim.txHash.slice(0,8)}...
                       </a>
                   )}
                   {claim.block && <span>Block: {claim.block}</span>}
                   {/* Mobile Date Fallback */}
                   <span className="sm:hidden flex items-center gap-1">
                      <Clock size={10} /> {new Date(claim.timestamp).toLocaleString()}
                   </span>
               </div>
               <div className="flex items-center gap-1 text-intuition-secondary">
                   <Activity size={10} /> Verifiable Claim
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ClaimCard;