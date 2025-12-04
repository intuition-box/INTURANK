import React, { useRef } from 'react';
import { Download, Share2, Award, Copy } from 'lucide-react';
import { toast } from './Toast';

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
  const isPositive = parseFloat(pnl) >= 0;

  const handleShare = async () => {
    const text = `🚀 I just realized ${pnl}% PnL on ${assetName} using IntuRank!\n\n📈 Entry: ${entryPrice}\n📉 Exit: ${currentPrice}\n\nTrade Reputation on Intuition Network.`;
    try {
        await navigator.clipboard.writeText(text);
        toast.success("STATS COPIED TO CLIPBOARD");
    } catch (err) {
        toast.error("FAILED TO COPY");
    }
  };

  const handleSave = () => {
     toast.info("PRESS WIN+SHIFT+S TO SNAPSHOT");
  };

  return (
    <div className="w-full max-w-sm mx-auto perspective-1000 group">
      <div ref={cardRef} className="relative bg-black border-2 border-intuition-primary p-6 rounded-xl shadow-[0_0_30px_rgba(0,243,255,0.15)] overflow-hidden clip-path-slant transform transition-transform hover:rotate-y-3 hover:rotate-x-3 duration-500">
        <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl ${isPositive ? 'from-emerald-500/20' : 'from-rose-500/20'} to-transparent rounded-bl-full blur-xl pointer-events-none`} />
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 border border-slate-700 rounded flex items-center justify-center">
              <Award className="text-intuition-primary" size={20} />
            </div>
            <div>
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">PLAYER_ID</h3>
              <div className="text-white font-bold font-display tracking-wide text-glow">{username.slice(0, 6)}...{username.slice(-4)}</div>
            </div>
          </div>
          <div className="px-3 py-1 bg-intuition-dark border border-intuition-border rounded text-[10px] font-mono text-intuition-primary">INTURANK // ALPHA</div>
        </div>
        <div className="text-center py-4 border-y border-white/10 mb-6 bg-white/5 backdrop-blur-sm relative z-10">
          <div className="text-[10px] font-mono text-slate-400 mb-1 uppercase tracking-widest">REALIZED PNL</div>
          <div className={`text-5xl font-black font-display tracking-tight ${isPositive ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.5)]'}`}>{pnl}%</div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm font-mono relative z-10">
          <div><div className="text-[10px] text-slate-500 uppercase">Asset</div><div className="text-white font-bold truncate">{assetName}</div></div>
          <div className="text-right"><div className="text-[10px] text-slate-500 uppercase">Side</div><div className={`font-bold ${side === 'TRUST' ? 'text-intuition-success' : 'text-intuition-danger'}`}>{side}</div></div>
          <div><div className="text-[10px] text-slate-500 uppercase">Entry</div><div className="text-white">{entryPrice}</div></div>
          <div className="text-right"><div className="text-[10px] text-slate-500 uppercase">Exit</div><div className="text-white">{currentPrice}</div></div>
        </div>
        <div className="flex gap-2 relative z-10">
          <button onClick={handleShare} className="flex-1 py-2 bg-intuition-primary text-black font-bold font-mono text-xs clip-path-slant hover:bg-white transition-colors flex items-center justify-center gap-2"><Share2 size={14} /> COPY TEXT</button>
          <button onClick={handleSave} className="flex-1 py-2 border border-intuition-primary text-intuition-primary font-bold font-mono text-xs clip-path-slant hover:bg-intuition-primary/10 transition-colors flex items-center justify-center gap-2"><Download size={14} /> SNAPSHOT</button>
        </div>
      </div>
    </div>
  );
};

export default ShareCard;