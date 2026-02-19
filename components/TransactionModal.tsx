
import React, { useEffect, useRef } from 'react';
/* Added Activity to imports */
import { Loader2, CheckCircle, XCircle, ExternalLink, X, ArrowRight, AlertTriangle, Terminal, ShieldAlert, Activity } from 'lucide-react';
import { playClick } from '../services/audio';
import { EXPLORER_URL } from '../constants';

interface TransactionModalProps {
  isOpen: boolean;
  status: 'idle' | 'processing' | 'success' | 'error';
  title: string;
  message: string;
  hash?: string;
  logs?: string[];
  onClose: () => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, status, title, message, hash, logs = [], onClose }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isProcessing = status === 'processing';
  const explorerBase = EXPLORER_URL || "https://explorer.intuition.systems";

  const themeColor = isSuccess ? '#00ff9d' : isError ? '#ff0055' : '#00f3ff';
  const shadowColor = isSuccess ? 'rgba(0,255,157,0.2)' : isError ? 'rgba(255,0,85,0.3)' : 'rgba(0,243,255,0.2)';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-500 font-mono">
      <div className="relative w-full max-w-lg bg-[#020308] border shadow-[0_0_80px_rgba(0,0,0,1)] clip-path-slant overflow-hidden transition-all duration-500"
           style={{
             borderColor: themeColor,
             boxShadow: `0 0 50px ${shadowColor}`
           }}
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
        
        {!isProcessing && (
          <button 
            onClick={() => { playClick(); onClose(); }}
            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-20 p-2"
          >
            <X size={20} />
          </button>
        )}

        <div className="p-8 flex flex-col items-center relative z-10">
          <div className="mb-6 relative">
             {isProcessing && (
               <div className="relative flex items-center justify-center">
                 <div className="w-16 h-16 border-2 border-intuition-primary/20 border-t-intuition-primary rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Terminal className="text-intuition-primary animate-pulse" size={20} />
                 </div>
               </div>
             )}
             {isSuccess && (
               <div className="relative animate-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-intuition-success/5 rounded-none flex items-center justify-center border-2 border-intuition-success shadow-[0_0_30px_rgba(0,255,157,0.3)] clip-path-slant">
                    <CheckCircle className="text-intuition-success" size={40} />
                  </div>
               </div>
             )}
             {isError && (
               <div className="relative animate-in shake duration-500">
                  <div className="w-20 h-20 bg-intuition-danger/10 rounded-none flex items-center justify-center border-2 border-intuition-danger shadow-[0_0_30px_rgba(255,0,85,0.4)] clip-path-slant">
                    <ShieldAlert className="text-intuition-danger" size={40} />
                  </div>
               </div>
             )}
          </div>

          <h2 className={`text-xl font-black font-display uppercase tracking-widest mb-2 ${isSuccess ? 'text-intuition-success' : isError ? 'text-intuition-danger' : 'text-intuition-primary'}`} style={{ textShadow: `0 0 15px ${themeColor}88` }}>
            {isError ? 'ACCESS_DENIED' : title}
          </h2>
          
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-6">{message}</p>

          {/* VERBOSE HANDSHAKE LOG */}
          <div className="w-full bg-black/60 border border-white/5 p-4 mb-6 min-h-[140px] max-h-[140px] overflow-y-auto custom-scrollbar clip-path-slant flex flex-col">
            <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
              <Activity size={10} className="text-intuition-primary animate-pulse" />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Protocol_Audit_Log</span>
            </div>
            <div className="space-y-1.5">
              {logs.map((log, i) => (
                <div key={i} className="text-[9px] text-slate-400 flex items-start gap-2 animate-in fade-in slide-in-from-left-1">
                  <span className="text-intuition-primary opacity-40">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                  <span className="uppercase font-bold tracking-tighter leading-tight">{log}</span>
                </div>
              ))}
              {isProcessing && (
                <div className="text-[9px] text-intuition-primary flex items-center gap-2 animate-pulse">
                  <span className="opacity-40">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                  <span className="uppercase font-bold tracking-tighter">AWAITING_NEXT_SIGNAL...</span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {hash && (
             <a 
                href={`${explorerBase}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playClick()}
                className="w-full relative z-20 bg-white/5 border border-white/10 p-3 mb-6 flex items-center justify-between group hover:border-intuition-primary transition-all no-underline clip-path-slant"
             >
                <div className="text-left overflow-hidden">
                   <div className="text-[8px] text-slate-500 uppercase font-black mb-1 tracking-widest">Protocol_Hash</div>
                   <div className="text-[9px] text-white font-black truncate max-w-full">
                      {hash}
                   </div>
                </div>
                <div className="h-8 w-8 border border-white/10 flex items-center justify-center group-hover:bg-intuition-primary group-hover:text-black transition-all shrink-0">
                   <ExternalLink size={14} />
                </div>
             </a>
          )}

          {!isProcessing && (
            <button
              onClick={() => { playClick(); onClose(); }}
              className={`w-full py-4 font-black font-display tracking-[0.3em] clip-path-slant transition-all flex items-center justify-center gap-3 relative z-20 text-[10px] shadow-xl ${
                isSuccess 
                  ? 'bg-intuition-success text-black hover:bg-white' 
                  : 'bg-intuition-danger text-white hover:bg-white hover:text-black'
              }`}
            >
              {isSuccess ? 'TRANSFER_COMPLETE' : 'RETRY_HANDSHAKE'} <ArrowRight size={16} />
            </button>
          )}
        </div>
        
        <div className={`h-1.5 w-full ${isProcessing ? 'bg-intuition-primary animate-pulse shadow-[0_0_10px_#00f3ff]' : isSuccess ? 'bg-intuition-success shadow-[0_0_10px_#00ff9d]' : 'bg-intuition-danger shadow-[0_0_10px_#ff0055]'}`}></div>
      </div>
    </div>
  );
};

export default TransactionModal;
