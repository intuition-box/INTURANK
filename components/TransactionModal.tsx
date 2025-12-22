
import React from 'react';
import { Loader2, CheckCircle, XCircle, ExternalLink, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { playClick } from '../services/audio';
import { EXPLORER_URL } from '../constants';

interface TransactionModalProps {
  isOpen: boolean;
  status: 'idle' | 'processing' | 'success' | 'error';
  title: string;
  message: string;
  hash?: string;
  onClose: () => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, status, title, message, hash, onClose }) => {
  if (!isOpen) return null;

  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isProcessing = status === 'processing';
  const explorerBase = EXPLORER_URL || "https://explorer.intuition.systems";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-[#05080f] border-2 shadow-[0_0_50px_rgba(0,0,0,0.8)] clip-path-slant overflow-hidden transition-all duration-500"
           style={{
             borderColor: isSuccess ? '#00ff9d' : isError ? '#ff0055' : '#00f3ff',
             boxShadow: isSuccess ? '0 0 40px rgba(0,255,157,0.15)' : isError ? '0 0 40px rgba(255,0,85,0.15)' : '0 0 40px rgba(0,243,255,0.15)'
           }}
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
        
        {!isProcessing && (
          <button 
            onClick={() => { playClick(); onClose(); }}
            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-20 p-2"
          >
            <X size={20} />
          </button>
        )}

        <div className="p-10 flex flex-col items-center text-center relative z-10">
          
          <div className="mb-8 relative">
             {isProcessing && (
               <div className="relative flex items-center justify-center">
                 <div className="w-24 h-24 border-2 border-intuition-primary/20 border-t-intuition-primary rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="text-intuition-primary animate-pulse" size={40} />
                 </div>
               </div>
             )}
             {isSuccess && (
               <div className="relative animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-intuition-success/10 rounded-full flex items-center justify-center border-2 border-intuition-success shadow-[0_0_30px_rgba(0,255,157,0.4)]">
                    <CheckCircle className="text-intuition-success" size={56} />
                  </div>
               </div>
             )}
             {isError && (
               <div className="relative animate-in shake duration-500">
                  <div className="w-24 h-24 bg-intuition-danger/10 rounded-full flex items-center justify-center border-2 border-intuition-danger shadow-[0_0_30px_rgba(255,0,85,0.4)]">
                    <AlertTriangle className="text-intuition-danger" size={56} />
                  </div>
               </div>
             )}
          </div>

          <h2 className={`text-2xl font-black font-display uppercase tracking-[0.1em] mb-3 ${isSuccess ? 'text-intuition-success text-glow-success' : isError ? 'text-intuition-danger text-glow-danger' : 'text-intuition-primary text-glow'}`}>
            {title}
          </h2>
          
          <div className="mb-10 min-h-[60px] flex items-center justify-center">
              <p className="text-sm font-mono text-slate-400 leading-relaxed uppercase tracking-widest max-w-[90%]">
                {message}
              </p>
          </div>

          {hash && (
             <a 
                href={`${explorerBase}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playClick()}
                className="w-full relative z-20 bg-white/5 border border-white/10 p-5 rounded-sm mb-8 flex items-center justify-between group cursor-pointer hover:border-intuition-primary/50 hover:bg-white/10 transition-all no-underline"
             >
                <div className="text-left">
                   <div className="text-[10px] text-slate-500 uppercase font-mono mb-1 tracking-widest">Transaction Hash</div>
                   <div className="text-xs text-white font-mono break-all font-bold">
                      {hash.slice(0, 18)}...{hash.slice(-14)}
                   </div>
                </div>
                <div className="h-10 w-10 rounded bg-white/10 flex items-center justify-center group-hover:bg-intuition-primary group-hover:text-black transition-all shadow-lg">
                   <ExternalLink size={18} />
                </div>
             </a>
          )}

          {!isProcessing && (
            <button
              onClick={() => { playClick(); onClose(); }}
              className={`w-full py-5 font-black font-display tracking-[0.3em] clip-path-slant hover-glow transition-all flex items-center justify-center gap-3 relative z-20 text-sm ${
                isSuccess 
                  ? 'bg-intuition-success text-black hover:bg-white' 
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
              }`}
            >
              {isSuccess ? 'RETURN_TO_TERMINAL' : 'RETRY_OPERATION'} <ArrowRight size={18} />
            </button>
          )}
        </div>
        
        <div className={`h-1.5 w-full ${isProcessing ? 'bg-intuition-primary animate-pulse' : isSuccess ? 'bg-intuition-success' : 'bg-intuition-danger'}`}></div>
      </div>
    </div>
  );
};

export default TransactionModal;
