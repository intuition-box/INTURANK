import React, { useState, useEffect } from 'react';
import { Wallet, Shield, X, Zap, Loader2, ArrowRight, Monitor, Smartphone, Globe, Cpu, Network, Fingerprint } from 'lucide-react';
import { playHover, playClick } from '../services/audio';
import { CHAIN_ID } from '../constants';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => Promise<void>;
}

const WalletOption = ({ name, description, icon: Icon, onClick, isConnecting, disabled = false, color = "primary" }: any) => {
    const isRed = color === "secondary";
    const accentClass = isRed ? 'text-intuition-secondary border-intuition-secondary/30 group-hover:border-intuition-secondary' : 'text-intuition-primary border-intuition-primary/30 group-hover:border-intuition-primary';
    const bgGlow = isRed ? 'bg-intuition-secondary/10' : 'bg-intuition-primary/10';

    return (
        <button 
            onClick={onClick}
            onMouseEnter={playHover}
            disabled={disabled || isConnecting}
            className={`w-full group relative overflow-hidden bg-black border-2 ${accentClass} p-5 transition-all duration-300 clip-path-slant disabled:opacity-40 disabled:cursor-not-allowed`}
        >
            <div className={`absolute inset-0 ${bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
            <div className="absolute top-0 right-0 w-8 h-8 opacity-10 group-hover:opacity-30 transition-opacity">
                <Icon size={32} />
            </div>

            <div className="flex items-center gap-5 relative z-10">
                <div className={`w-14 h-14 bg-black border-2 ${accentClass} flex items-center justify-center rounded-none clip-path-slant transition-all duration-500 group-hover:scale-110 shadow-lg`}>
                    {isConnecting ? <Loader2 className="animate-spin" size={24} /> : <Icon size={24} />}
                </div>
                <div className="text-left min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-black text-white font-display text-lg tracking-tight uppercase group-hover:text-white">
                            {isConnecting ? 'ESTABLISHING...' : name}
                        </h4>
                        {!disabled && !isConnecting && <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all text-white" />}
                    </div>
                    <div className="text-[9px] font-black font-mono text-slate-500 uppercase tracking-widest group-hover:text-slate-300">
                        {description}
                    </div>
                </div>
            </div>
            
            {/* Animated Scanline Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent h-1/2 -translate-y-full group-hover:animate-[scanline_2s_linear_infinite] pointer-events-none"></div>
        </button>
    );
};

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    playClick();
    setIsConnecting(true);
    try {
      await onConnect();
      onClose();
    } catch (e) {
      console.error("Connection cancelled or failed", e);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
      {/* Biometric Background Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] opacity-10"></div>
      
      <div className="relative w-full max-w-lg bg-[#02040a] border-2 border-intuition-secondary shadow-[0_0_80px_rgba(255,0,85,0.2)] clip-path-slant overflow-hidden flex flex-col">
        
        {/* Scanline Effect */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between p-8 border-b-2 border-intuition-secondary/20 bg-black/40">
          <div className="flex items-center gap-5">
            <div className="relative">
                <div className="absolute inset-0 bg-intuition-secondary blur-xl opacity-30 animate-pulse"></div>
                <div className="w-14 h-14 bg-black border-2 border-intuition-secondary flex items-center justify-center text-intuition-secondary clip-path-slant shadow-[0_0_20px_rgba(255,0,85,0.3)]">
                    <Zap className="fill-current animate-pulse" size={24} />
                </div>
            </div>
            <div>
                <h2 className="text-2xl font-black font-display text-white tracking-[0.2em] uppercase text-glow-red">
                    Establish_Uplink
                </h2>
                <div className="text-[9px] font-mono text-intuition-secondary/60 tracking-[0.4em] uppercase font-black flex items-center gap-2">
                    <Network size={10} /> Neural_Interface_Selection
                </div>
            </div>
          </div>
          <button 
            onClick={() => { playClick(); onClose(); }} 
            onMouseEnter={playHover}
            className="w-12 h-12 flex items-center justify-center border-2 border-slate-800 text-slate-500 hover:text-white hover:border-white transition-all clip-path-slant"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-4 relative bg-[#080a12]/50">
            <div className="text-[10px] font-black font-mono text-slate-500 uppercase tracking-[0.5em] mb-6 flex items-center gap-3">
                <Fingerprint size={14} className="text-intuition-primary" /> Select_Auth_Protocol
            </div>

            <div className="grid grid-cols-1 gap-4">
                <WalletOption 
                    name="Injected_Node" 
                    description="MetaMask // Rabby // Brave" 
                    icon={Cpu} 
                    onClick={handleConnect}
                    isConnecting={isConnecting}
                    color="primary"
                />
                
                <WalletOption 
                    name="Mobile_Relay" 
                    description="WalletConnect // QR Access" 
                    icon={Smartphone} 
                    onClick={() => {}}
                    disabled={true}
                    color="primary"
                />

                <WalletOption 
                    name="Global_Sync" 
                    description="Coinbase // Web3_Interface" 
                    icon={Globe} 
                    onClick={() => {}}
                    disabled={true}
                    color="primary"
                />
            </div>
            
            <div className="mt-8 p-6 bg-black border border-white/5 border-dashed clip-path-slant opacity-60">
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed uppercase tracking-widest text-center">
                    {" >> "} Warning: Unauthorized access attempts will be logged to the primary chain ledger. Ensure your session credentials are valid before establishing link.
                </p>
            </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-black border-t-2 border-intuition-secondary/20 flex items-center justify-between px-8">
          <div className="flex items-center gap-3 text-[10px] font-black font-mono text-slate-500 uppercase tracking-widest">
            <div className="w-2.5 h-2.5 rounded-full bg-intuition-success animate-pulse shadow-[0_0_10px_#00ff9d]"></div>
            Mainnet_Handshake_Ready
          </div>
          <div className="text-[10px] font-black font-mono text-slate-700 uppercase tracking-widest">
            Chain_ID: <span className="text-intuition-primary">{CHAIN_ID}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default WalletModal;