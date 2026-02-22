import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Wallet, Mail, Copy, Loader2, UserCircle, ChevronRight, BarChart2, ExternalLink, Trash2 } from 'lucide-react';
import { getConnectedAccount, connectWallet } from '../services/web3';
import { getEmailSubscription, removeEmailSubscription } from '../services/emailNotifications';
import { useEmailNotify } from '../contexts/EmailNotifyContext';
import { playClick, playHover } from '../services/audio';
import { toast } from '../components/Toast';

const Account: React.FC = () => {
  const { address: wagmiAddress } = useAccount();
  const [wallet, setWallet] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{ email: string; nickname?: string; subscribedAt?: number } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const { openEmailNotify, isEmailNotifyOpen } = useEmailNotify();

  const refresh = useCallback((addr: string | null) => {
    setWallet(addr || null);
    if (addr) {
      const sub = getEmailSubscription(addr);
      setSubscription(sub ? { email: sub.email, nickname: sub.nickname, subscribedAt: sub.subscribedAt } : null);
    } else {
      setSubscription(null);
    }
  }, []);

  // Sync from wagmi so we show connected state when user connects in header
  useEffect(() => {
    if (wagmiAddress) refresh(wagmiAddress);
    else refresh(null);
  }, [wagmiAddress, refresh]);

  // Also refresh from getConnectedAccount on mount (in case wagmi not yet synced)
  useEffect(() => {
    getConnectedAccount().then((addr) => {
      if (addr && !wallet) refresh(addr);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After email modal closes, refresh email for current wallet
  useEffect(() => {
    if (!isEmailNotifyOpen && wallet) refresh(wallet);
  }, [isEmailNotifyOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    playClick();
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setWallet(addr || null);
      if (addr) {
        const sub = getEmailSubscription(addr);
        setSubscription(sub ? { email: sub.email, nickname: sub.nickname, subscribedAt: sub.subscribedAt } : null);
      } else {
        toast.error('Connect your wallet first');
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleCopyAddress = () => {
    if (!wallet) return;
    playClick();
    navigator.clipboard.writeText(wallet);
    toast.success('Address copied');
  };

  if (wallet === null && !connecting) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-black/60 border-2 border-intuition-primary/30 p-8 clip-path-slant text-center">
          <UserCircle className="w-16 h-16 text-slate-600 mx-auto mb-6" />
          <h1 className="text-xl font-black font-mono tracking-widest text-white uppercase mb-2">Account</h1>
          <p className="text-slate-400 text-sm font-mono mb-8">Connect your wallet to manage your profile and email alerts.</p>
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
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-black font-mono tracking-widest text-white uppercase mb-2 flex items-center gap-3">
        <UserCircle size={28} className="text-intuition-primary" />
        Profile
      </h1>
      <p className="text-slate-500 text-[10px] font-mono tracking-widest uppercase mb-10">Manage your account and email alerts</p>

      {/* Ident hash */}
      <section className="bg-black/60 border-2 border-slate-800 p-6 clip-path-slant mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={14} className="text-intuition-primary" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Ident hash</span>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="font-mono text-sm text-slate-300 break-all">
            {wallet ? `${wallet.slice(0, 10)}...${wallet.slice(-8)}` : '—'}
          </span>
          {wallet && (
            <button
              onClick={handleCopyAddress}
              onMouseEnter={playHover}
              className="flex items-center gap-2 px-4 py-2 border-2 border-slate-700 text-slate-400 font-mono text-[10px] font-black tracking-widest hover:border-intuition-primary hover:text-intuition-primary transition-colors"
            >
              <Copy size={12} /> Copy
            </button>
          )}
        </div>
      </section>

      {/* Email alerts */}
      <section className="bg-black/60 border-2 border-slate-800 p-6 clip-path-slant mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={14} className="text-intuition-primary" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Email alerts</span>
        </div>
        {subscription?.email ? (
          <div className="space-y-4">
            <p className="text-slate-300 font-mono text-sm">Linked: <span className="text-white">{subscription.email}</span></p>
            {subscription.nickname && (
              <p className="text-slate-500 text-xs font-mono">Nickname: {subscription.nickname}</p>
            )}
            {subscription.subscribedAt && (
              <p className="text-slate-500 text-[10px] font-mono">Alerts since {new Date(subscription.subscribedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            )}
            <p className="text-slate-500 text-[10px]">We send activity on your holdings, app updates, and TRUST (₸) campaigns to this address.</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { playClick(); openEmailNotify(); }}
                onMouseEnter={playHover}
                className="flex items-center gap-2 px-4 py-3 border-2 border-intuition-primary/50 text-intuition-primary font-mono text-[10px] font-black tracking-widest hover:bg-intuition-primary hover:text-black transition-colors"
              >
                Change email
              </button>
              <button
                onClick={() => {
                  playClick();
                  if (!wallet) return;
                  removeEmailSubscription(wallet);
                  setSubscription(null);
                  toast.success('Email unlinked. You won’t receive alerts until you add one again.');
                }}
                onMouseEnter={playHover}
                className="flex items-center gap-2 px-4 py-3 border-2 border-slate-600 text-slate-400 font-mono text-[10px] font-black tracking-widest hover:border-intuition-danger hover:text-intuition-danger transition-colors"
              >
                <Trash2 size={14} /> Delete email
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-500 text-sm font-mono">No email linked. Add one to get alerts and confirmations.</p>
            <button
              onClick={() => { playClick(); openEmailNotify(); }}
              onMouseEnter={playHover}
              className="flex items-center gap-2 px-4 py-3 bg-intuition-primary text-black font-mono text-[10px] font-black tracking-widest border-2 border-intuition-primary hover:bg-white transition-colors"
            >
              <Mail size={14} /> Add email
            </button>
          </div>
        )}
      </section>

      <Link
        to="/portfolio"
        onClick={playClick}
        onMouseEnter={playHover}
        className="flex items-center justify-between w-full py-4 px-4 border-2 border-slate-800 text-slate-400 font-mono text-[10px] font-black tracking-widest hover:border-intuition-primary hover:text-intuition-primary transition-colors mb-4"
      >
        <span>View portfolio</span>
        <ChevronRight size={16} />
      </Link>

      <Link
        to={wallet ? `/profile/${wallet}` : '#'}
        onClick={playClick}
        onMouseEnter={playHover}
        className="flex items-center justify-between w-full py-4 px-4 border-2 border-slate-800 text-slate-400 font-mono text-[10px] font-black tracking-widest hover:border-intuition-primary hover:text-intuition-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          <BarChart2 size={14} /> Public reputation
        </span>
        <ExternalLink size={12} />
      </Link>

      <p className="text-slate-600 text-[9px] font-mono tracking-widest uppercase mt-8 text-center">You're in the trust layer. gTrust.</p>
    </div>
  );
};

export default Account;
