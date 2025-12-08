import React, { useRef, useState } from 'react';
import { Download, Share2, Award, Copy, Twitter, Loader2, CheckCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { toast } from './Toast';
import Logo from './Logo';

interface ShareCardProps {
  username: string;
  pnl: string;
  entryPrice: string;
  currentPrice: string;
  assetName: string;
  side: 'TRUST' | 'DISTRUST';
}

const ShareCard: React.FC<ShareCardProps> = ({
  username,
  pnl,
  entryPrice,
  currentPrice,
  assetName,
  side
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const isPositive = parseFloat(pnl) >= 0;

  const handleShareToX = () => {
    const text = `🚀 I just realized ${pnl}% PnL on ${assetName} using IntuRank!\n\n📈 Entry: ${entryPrice}\n📉 Exit: ${currentPrice}\n\nTrade Reputation on @IntuitionSys.`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSave = async () => {
     if (!cardRef.current) return;
     setIsCapturing(true);
     try {
        const canvas = await html2canvas(cardRef.current, {
            backgroundColor: '#02040a',
            scale: 2, // High resolution
            useCORS: true
        });
        const image = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.href = image;
        link.download = `inturank-pnl-${assetName}-${Date.now()}.png`;
        link.click();
        toast.success("CARD SAVED TO DEVICE");
     } catch (err) {
        console.error(err);
        toast.error("IMAGE GENERATION FAILED");
     } finally {
        setIsCapturing(false);
     }
  };

  return (
    <div className="flex flex-col gap-4 items-center">
        {/* THE CARD ITSELF */}
        <div className="w-full max-w-sm mx-auto perspective-1000 group">
        <div ref={cardRef} className="relative bg-[#05080f] border-2 border-intuition-primary p-6 rounded-none clip-path-slant shadow-[0_0_50px_rgba(0,243,255,0.2)] overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
            <div className={`absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-bl ${isPositive ? 'from-emerald-500/30' : 'from-rose-500/30'} to-transparent rounded-full blur-3xl pointer-events-none`} />
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-intuition-primary to-transparent opacity-50"></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-black border border-intuition-primary rounded flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.3)]">
                        <Logo className="w-8 h-8 text-intuition-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-white font-black font-display tracking-widest text-lg">INTU<span className="text-intuition-primary">RANK</span></h3>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Reputation Market</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Trader</div>
                    <div className="text-white font-bold font-mono text-xs bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        {username.slice(0, 6)}...{username.slice(-4)}
                    </div>
                </div>
            </div>

            {/* Main PnL Section */}
            <div className="text-center py-6 border-y border-white/10 mb-8 bg-white/5 backdrop-blur-sm relative z-10">
                <div className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-[0.2em]">Realized PnL</div>
                <div className={`text-6xl font-black font-display tracking-tighter ${isPositive ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.6)]' : 'text-rose-400 drop-shadow-[0_0_20px_rgba(251,113,133,0.6)]'}`}>
                    {isPositive ? '+' : ''}{pnl}%
                </div>
                <div className={`inline-block mt-2 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${side === 'TRUST' ? 'bg-intuition-success/10 border-intuition-success text-intuition-success' : 'bg-intuition-danger/10 border-intuition-danger text-intuition-danger'}`}>
                    {side} POSITION
                </div>
            </div>

            {/* Trade Details */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 mb-6 text-sm font-mono relative z-10">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Asset</span>
                    <span className="text-white font-bold truncate border-b border-slate-800 pb-1">{assetName}</span>
                </div>
                <div className="flex flex-col text-right">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Result</span>
                    <span className={`font-bold pb-1 border-b border-slate-800 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{isPositive ? 'WIN' : 'LOSS'}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Entry</span>
                    <span className="text-slate-300">{entryPrice}</span>
                </div>
                <div className="flex flex-col text-right">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Exit</span>
                    <span className="text-white font-bold">{currentPrice}</span>
                </div>
            </div>

            {/* Footer Watermark */}
            <div className="flex justify-between items-center pt-4 border-t border-intuition-primary/20 relative z-10">
                <div className="text-[8px] font-mono text-intuition-primary/60">
                    VERIFIED ON INTUITION PROTOCOL
                </div>
                <div className="text-[8px] font-mono text-slate-600">
                    {new Date().toLocaleDateString()}
                </div>
            </div>
        </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 w-full max-w-sm">
            <button 
                onClick={handleShareToX} 
                className="flex-1 py-3 bg-black border border-slate-700 text-white font-bold font-mono text-xs hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 clip-path-slant"
            >
                <Twitter size={14} /> SHARE
            </button>
            <button 
                onClick={handleSave} 
                disabled={isCapturing}
                className="flex-1 py-3 bg-intuition-primary text-black font-bold font-mono text-xs clip-path-slant hover:bg-white transition-colors flex items-center justify-center gap-2"
            >
                {isCapturing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                {isCapturing ? 'SAVING...' : 'SAVE IMAGE'}
            </button>
        </div>
    </div>
  );
};

export default ShareCard;