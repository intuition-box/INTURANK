import React from 'react';
import { Loader2, CheckCircle, XCircle, ExternalLink, X, ArrowRight } from 'lucide-react';
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#05080f] border-2 shadow-[0_0_40px_rgba(0,0,0,0.5)] clip-path-slant overflow-hidden transition-all duration-300 transform scale-100"
           style={{
             borderColor: isSuccess ? '#00ff9d' : isError ? '#ff0055' : '#00f3ff',
             boxShadow: isSuccess ? '0 0 30px rgba(0,255,157,0.2)' : isError ? '0 0 30px rgba(255,0,85,0.2)' : '0 0 30px rgba(0,243,255,0.2)'
           }}
      >
        {/* Background Noise/Grid */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

        {/* Close Button */}
        {!isProcessing && (
          <button 
            onClick={() => { playClick(); onClose(); }}
            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-20"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8 flex flex-col items-center text-center relative z-10">
          
          {/* Icon Stage */}
          <div className="mb-6 relative">
             {isProcessing && (
               <div className="relative">
                 <div className="w-20 h-20 border-4 border-intuition-primary/30 border-t-intuition-primary rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="text-intuition-primary animate-pulse" size={32} />
                 </div>
               </div>
             )}
             {isSuccess && (
               <div className="relative animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-intuition-success/10 rounded-full flex items-center justify-center border border-intuition-success shadow-[0_0_20px_rgba(0,255,157,0.4)]">
                    <CheckCircle className="text-intuition-success" size={48} />
                  </div>
                  <div className="absolute -inset-2 border border-intuition-success/30 rounded-full animate-ping opacity-20"></div>
               </div>
             )}
             {isError && (
               <div className="relative animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-intuition-danger/10 rounded-full flex items-center justify-center border border-intuition-danger shadow-[0_0_20px_rgba(255,0,85,0.4)]">
                    <XCircle className="text-intuition-danger" size={48} />
                  </div>
               </div>
             )}
          </div>

          {/* Text Content */}
          <h2 className={`text-2xl font-black font-display tracking-wider mb-2 ${isSuccess ? 'text-intuition-success' : isError ? 'text-intuition-danger' : 'text-intuition-primary'}`}>
            {title}
          </h2>
          <p className="text-sm font-mono text-slate-400 mb-8 leading-relaxed max-w-[80%]">
            {message}
          </p>

          {/* Hash / Actions */}
          {hash && (
             <a 
                href={`${explorerBase}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                    // Prevent navigation blocking if any
                    // e.preventDefault() should NOT be called
                    playClick();
                }}
                className="w-full relative z-20 bg-black/40 border border-white/10 p-4 rounded mb-6 flex items-center justify-between group cursor-pointer hover:border-intuition-primary/50 hover:bg-white/5 transition-all text-decoration-none"
             >
                <div className="text-left">
                   <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">View on Explorer</div>
                   <div className="text-xs text-white font-mono bg-black/50 px-2 py-1 rounded border border-white/5 group-hover:border-intuition-primary/30 transition-colors">
                      {hash.slice(0, 16)}...{hash.slice(-12)}
                   </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-intuition-primary group-hover:text-black transition-all">
                   <ExternalLink size={14} />
                </div>
             </a>
          )}

          {/* Button */}
          {!isProcessing && (
            <button
              onClick={() => { playClick(); onClose(); }}
              className={`w-full py-4 font-bold font-display tracking-widest clip-path-slant hover-glow transition-all flex items-center justify-center gap-2 relative z-20 ${
                isSuccess 
                  ? 'bg-intuition-success text-black hover:bg-white' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {isSuccess ? 'CONTINUE_OPERATIONS' : 'CLOSE_TERMINAL'} <ArrowRight size={16} />
            </button>
          )}
        </div>
        
        {/* Status Bar */}
        <div className={`h-1 w-full ${isProcessing ? 'bg-intuition-primary animate-pulse' : isSuccess ? 'bg-intuition-success' : 'bg-intuition-danger'}`}></div>
      </div>
    </div>
  );
};

export default TransactionModal;