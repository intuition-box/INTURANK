import React, { useState } from 'react';
import { Wallet, Shield, X, Zap, Loader2 } from 'lucide-react';
import { playHover, playClick } from '../services/audio';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => Promise<void>; // Changed to return Promise
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const handleInjectedConnect = async () => {
    playClick();
    setIsConnecting(true);
    try {
      await onConnect();
      onClose(); // Only close after successful connection or rejection handled
    } catch (e) {
      console.error("Connection cancelled or failed", e);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#05080f] border border-intuition-primary shadow-[0_0_40px_rgba(0,243,255,0.15)] clip-path-slant overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-intuition-primary/30 bg-intuition-primary/5">
          <h2 className="text-xl font-black font-display text-white flex items-center gap-2 tracking-wider">
            <Zap className="text-intuition-warning fill-intuition-warning" size={20} />
            ESTABLISH_UPLINK
          </h2>
          <button 
            onClick={() => { playClick(); onClose(); }} 
            onMouseEnter={playHover}
            className="text-slate-500 hover:text-intuition-primary transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6 relative">
          {/* Background Grid */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
          
          <div className="text-xs font-mono text-intuition-primary/70 uppercase tracking-widest mb-4">
            &gt;&gt; SELECT INTERFACE PROTOCOL
          </div>

          {/* Option 1: Injected (Metamask) */}
          <button 
            onClick={handleInjectedConnect}
            onMouseEnter={playHover}
            disabled={isConnecting}
            className="w-full group relative overflow-hidden border border-slate-700 hover:border-intuition-primary bg-slate-900/50 hover:bg-intuition-primary/10 transition-all duration-300 p-0 clip-path-slant text-left disabled:opacity-50 disabled:cursor-wait"
          >
            <div className="p-5 flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 border border-slate-600 rounded-lg flex items-center justify-center bg-black group-hover:border-intuition-primary group-hover:text-intuition-primary text-white transition-colors">
                {isConnecting ? <Loader2 className="animate-spin" size={24}/> : <Wallet size={24} />}
              </div>
              <div>
                <div className="font-bold text-white font-display tracking-wide text-lg group-hover:text-intuition-primary transition-colors">
                    {isConnecting ? "INITIALIZING..." : "INJECTED_NODE"}
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase group-hover:text-slate-400">METAMASK / RABBY / BRAVE</div>
              </div>
            </div>
            {/* Hover Scanline */}
            {!isConnecting && <div className="absolute top-0 left-0 w-1 h-full bg-intuition-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-center"></div>}
          </button>

          {/* Option 2: WalletConnect (Disabled/Mock) */}
          <button 
            disabled
            className="w-full group relative overflow-hidden border border-slate-800 bg-black/50 p-0 clip-path-slant text-left opacity-60 cursor-not-allowed"
          >
            <div className="p-5 flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 border border-slate-800 rounded-lg flex items-center justify-center text-slate-600">
                <Shield size={24} />
              </div>
              <div>
                <div className="font-bold text-slate-500 font-display tracking-wide text-lg">SECURE_LINK</div>
                <div className="text-[10px] font-mono text-slate-700 uppercase">WALLETCONNECT [OFFLINE]</div>
              </div>
            </div>
          </button>

        </div>

        {/* Footer */}
        <div className="p-4 bg-black border-t border-intuition-primary/30 text-center">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono text-slate-500 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-intuition-success animate-pulse"></span>
            SECURE CONNECTION // CHAIN_ID: 13579
          </div>
        </div>

      </div>
    </div>
  );
};

export default WalletModal;