import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Wallet, Loader2, UserCircle } from 'lucide-react';
import { connectWallet } from '../services/web3';
import { playClick, playHover } from '../services/audio';

/**
 * Account entry — when connected, redirects to profile. When not, shows connect prompt.
 */
const Account: React.FC = () => {
  const { address } = useAccount();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (address) navigate(`/profile/${address}`, { replace: true });
  }, [address, navigate]);

  if (address) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-intuition-primary animate-spin" />
      </div>
    );
  }

  const handleConnect = async () => {
    playClick();
    setConnecting(true);
    try {
      const addr = await connectWallet();
      if (addr) navigate(`/profile/${addr}`, { replace: true });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-black/60 border-2 border-intuition-primary/30 p-8 clip-path-slant text-center">
        <UserCircle className="w-16 h-16 text-slate-600 mx-auto mb-6" />
        <h1 className="text-xl font-black font-mono tracking-widest text-white uppercase mb-2">Profile</h1>
        <p className="text-slate-400 text-sm font-mono mb-8">Connect your wallet to view your profile and manage settings.</p>
        <button
          onClick={handleConnect}
          onMouseEnter={playHover}
          disabled={connecting}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-intuition-primary text-black font-black font-mono text-[10px] tracking-widest clip-path-slant border-2 border-intuition-primary hover:bg-white disabled:opacity-50 transition-all"
        >
          {connecting ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
          {connecting ? 'Connecting...' : 'Connect wallet'}
        </button>
      </div>
    </div>
  );
};

export default Account;
