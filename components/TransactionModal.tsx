
import React from 'react';
import { Loader2, CheckCircle, XCircle, ExternalLink, X, ArrowRight, AlertTriangle, Terminal, ShieldAlert } from 'lucide-react';
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

  const themeColor = isSuccess ? '#00ff9d' : isError ? '#ff0055' : '#00f3ff';
  const shadowColor = isSuccess ? 'rgba(0,255,157,0.2)' : isError ? 'rgba(255,0,85,0.3)' : 'rgba(0,243,255,0.2)';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative w-full max-w-md bg-black border shadow-[0_0_80px_rgba(0,0,0,1)] clip-path-slant overflow-hidden transition-all duration-500"
           style={{
             borderColor: themeColor,
             boxShadow: `0 0 50px ${shadowColor}`
           }}
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent pointer-events-none opacity-20"></div>
        
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
                 <div className="w-20 h-20 border-2 border-intuition-primary/20 border-t-intuition-primary rounded-full animate-spin"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Terminal className="text-intuition-primary animate-pulse" size={24} />
                 </div>
               </div>
             )}
             {isSuccess && (
               <div className="relative animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-intuition-success/5 rounded-none flex items-center justify-center border-2 border-intuition-success shadow-[0_0_30px_rgba(0,255,157,0.3)] clip-path-slant">
                    <CheckCircle className="text-intuition-success" size={48} />
                  </div>
               </div>
             )}
             {isError && (
               <div className="relative animate-in shake duration-500">
                  <div className="w-24 h-24 bg-intuition-danger/10 rounded-none flex items-center justify-center border-2 border-intuition-danger shadow-[0_0_30px_rgba(255,0,85,0.4)] clip-path-slant">
                    <ShieldAlert className="text-intuition-danger" size={48} />
                  </div>
               </div>
             )}
          </div>

          <h2 className={`text-2xl font-black font-display uppercase tracking-widest mb-6 ${isSuccess ? 'text-intuition-success' : isError ? 'text-intuition-danger' : 'text-intuition-primary'}`} style={{ textShadow: `0 0 15px ${themeColor}88` }}>
            {isError ? 'ACCESS_DENIED' : title}
          </h2>
          
          <div className="mb-10 min-h-[50px] flex items-center justify-center bg-white/5 border-y border-white/5 py-4 px-4 w-full">
              <p className="text-[10px] font-black font-mono text-slate-400 leading-relaxed uppercase tracking-wider max-w-full">
                {message}
              </p>
          </div>

          {hash && (
             <a 
                href={`${explorerBase}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playClick()}
                className="w-full relative z-20 bg-black border border-white/10 p-4 mb-8 flex items-center justify-between group hover:border-intuition-primary transition-all no-underline clip-path-slant"
             >
                <div className="text-left">
                   <div className="text-[8px] text-slate-500 uppercase font-black font-mono mb-1 tracking-widest">Protocol_Hash</div>
                   <div className="text-[9px] text-white font-black font-mono break-all tracking-tighter">
                      {hash.slice(0, 32)}...
                   </div>
                </div>
                <div className="h-8 w-8 border border-white/10 flex items-center justify-center group-hover:bg-intuition-primary group-hover:text-black transition-all">
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
