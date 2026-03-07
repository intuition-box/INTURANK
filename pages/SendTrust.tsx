import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useBalance } from 'wagmi';
import { parseEther, formatEther, isAddress } from 'viem';
import { Send, Coins, ArrowLeft, Loader2, AlertTriangle, User, CheckCircle2, ExternalLink, Copy } from 'lucide-react';
import { resolveENS, sendNativeTransfer } from '../services/web3';
import { playClick, playHover } from '../services/audio';
import { toast } from '../components/Toast';
import { CHAIN_ID, EXPLORER_URL } from '../constants';

const SendTrust: React.FC = () => {
  const { address: walletAddress, chainId, isConnected } = useAccount();
  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address: walletAddress,
  });

  const [recipientInput, setRecipientInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [confirmedTxHash, setConfirmedTxHash] = useState<string | null>(null);
  const isPending = isSending; // alias for any legacy reference

  const balance = balanceData?.value ?? 0n;
  const balanceFormatted = balanceData ? formatEther(balance) : '0';

  const resolveRecipient = useCallback(async () => {
    const raw = recipientInput.trim();
    if (!raw) {
      setResolvedAddress(null);
      setResolveError(null);
      return;
    }
    if (raw.startsWith('0x')) {
      if (isAddress(raw)) {
        setResolvedAddress(raw);
        setResolveError(null);
      } else {
        setResolvedAddress(null);
        setResolveError('Invalid address (should be 0x + 40 hex chars)');
      }
      return;
    }
    if (raw.endsWith('.eth')) {
      setResolveError(null);
      try {
        const addr = await resolveENS(raw);
        if (addr) {
          setResolvedAddress(addr);
        } else {
          setResolvedAddress(null);
          setResolveError('ENS name not found');
        }
      } catch {
        setResolvedAddress(null);
        setResolveError('Failed to resolve ENS');
      }
      return;
    }
    setResolvedAddress(null);
    setResolveError('Enter a valid address (0x...) or ENS name (e.g. name.eth)');
  }, [recipientInput]);

  React.useEffect(() => {
    const t = setTimeout(resolveRecipient, 400);
    return () => clearTimeout(t);
  }, [recipientInput, resolveRecipient]);

  const setMaxAmount = () => {
    playClick();
    if (!balanceData) return;
    const reserve = parseEther('0.001');
    const max = balance > reserve ? balance - reserve : 0n;
    setAmountInput(formatEther(max));
  };

  const handleSend = async () => {
    if (!walletAddress || !resolvedAddress) {
      toast.error('Enter a valid recipient address or ENS');
      return;
    }
    if (walletAddress.toLowerCase() === resolvedAddress.toLowerCase()) {
      toast.error('Cannot send to yourself');
      return;
    }
    let value: bigint;
    try {
      value = parseEther(amountInput.trim() || '0');
    } catch {
      toast.error('Enter a valid amount');
      return;
    }
    if (value <= 0n) {
      toast.error('Amount must be greater than 0');
      return;
    }
    if (value > balance) {
      toast.error('Insufficient TRUST balance');
      return;
    }
    playClick();
    setIsSending(true);
    try {
      const hash = await sendNativeTransfer(
        walletAddress,
        resolvedAddress as `0x${string}`,
        value
      );
      setAmountInput('');
      refetchBalance();
      setConfirmedTxHash(hash);
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? 'Transaction failed';
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  const wrongNetwork = isConnected && chainId !== CHAIN_ID;
  let amountWei = 0n;
  try {
    amountWei = parseEther(amountInput.trim() || '0');
  } catch {
    amountWei = 0n;
  }
  const canSend =
    isConnected &&
    !wrongNetwork &&
    resolvedAddress &&
    amountInput &&
    amountWei > 0n &&
    amountWei <= balance &&
    !isSending;

  const copyHash = () => {
    if (!confirmedTxHash) return;
    playClick();
    navigator.clipboard.writeText(confirmedTxHash);
    toast.success('Hash copied');
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-20 bg-[#0a0a0a]">
      {/* Success popup */}
      {confirmedTxHash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border-2 border-[#F0C14B]/40 bg-[#0c0c0c] shadow-[0_0_60px_rgba(240,193,75,0.15)] p-6 sm:p-8 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#F0C14B]/20 border-2 border-[#F0C14B] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-9 h-9 text-[#F0C14B]" strokeWidth={2} />
              </div>
              <h2 className="text-xl font-black font-mono text-white uppercase tracking-wide mb-1">
                Transaction confirmed
              </h2>
              <p className="text-slate-400 font-mono text-sm mb-5">
                Your TRUST transfer was successful
              </p>
              <div className="w-full rounded-xl bg-[#080808] border border-[#F0C14B]/25 px-4 py-3 mb-4 flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-slate-300 truncate">
                  {confirmedTxHash.slice(0, 10)}...{confirmedTxHash.slice(-8)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={copyHash}
                    onMouseEnter={playHover}
                    className="p-2 rounded-lg border border-[#F0C14B]/40 text-[#F0C14B] hover:bg-[#F0C14B]/10 transition-colors"
                    title="Copy hash"
                  >
                    <Copy size={14} />
                  </button>
                  <a
                    href={`${EXPLORER_URL}/tx/${confirmedTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={playClick}
                    onMouseEnter={playHover}
                    className="p-2 rounded-lg border border-[#F0C14B]/40 text-[#F0C14B] hover:bg-[#F0C14B]/10 transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              <a
                href={`${EXPLORER_URL}/tx/${confirmedTxHash}`}
                target="_blank"
                rel="noreferrer"
                onClick={playClick}
                className="text-[#F0C14B] font-mono text-xs hover:underline mb-6"
              >
                View on Intuition Explorer →
              </a>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setConfirmedTxHash(null);
                }}
                onMouseEnter={playHover}
                className="w-full py-3.5 rounded-xl bg-[#F0C14B] text-black font-black font-mono text-sm uppercase tracking-widest hover:bg-[#FFD54F] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg relative">
        {/* Nav */}
        <div className="mb-10">
          <Link
            to="/"
            onMouseEnter={playHover}
            onClick={playClick}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-[#F0C14B] font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-colors"
          >
            <ArrowLeft size={12} /> Back
          </Link>
        </div>

        {/* Section label */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#F0C14B]/50 bg-[#F0C14B]/5 mb-6">
          <Send className="w-4 h-4 text-[#F0C14B]" strokeWidth={2.2} />
          <span className="text-[#F0C14B] font-mono font-black text-[10px] uppercase tracking-[0.2em]">
            Send TRUST
          </span>
        </div>

        {/* Title block */}
        <div className="mb-10">
          <h1 className="text-xl sm:text-2xl font-black font-mono text-[#F0C14B] uppercase leading-tight mb-2 drop-shadow-[0_0_20px_rgba(240,193,75,0.25)]">
            Send TRUST to any address
          </h1>
          <p className="text-[#F0C14B]/90 font-mono text-sm sm:text-base uppercase tracking-wide mb-4">
            via native transfer
          </p>
          <p className="text-white/90 text-sm font-mono leading-relaxed max-w-md">
            Enter a wallet address or ENS name and amount. Your wallet will prompt you to sign. Connect your wallet first if you haven’t.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-xl border border-[#F0C14B]/25 bg-[#0c0c0c] p-6 sm:p-10">
          {!isConnected ? (
            <div className="text-center py-8">
              <User className="w-14 h-14 text-slate-600 mx-auto mb-6" />
              <p className="text-slate-400 font-mono text-sm mb-8">
                Connect your wallet to send TRUST
              </p>
              <Link
                to="/"
                onClick={playClick}
                className="inline-flex items-center gap-2 px-6 py-4 bg-[#F0C14B] text-black font-black font-mono text-xs uppercase tracking-widest rounded-lg hover:bg-[#FFD54F] transition-colors shadow-[0_0_25px_rgba(240,193,75,0.3)]"
              >
                Connect wallet
              </Link>
            </div>
          ) : wrongNetwork ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-14 h-14 text-red-400 mx-auto mb-6" />
              <p className="text-slate-300 font-mono text-sm">
                Switch to Intuition Mainnet to send TRUST
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black font-mono text-[#F0C14B]/90 uppercase tracking-[0.2em] mb-3">
                  Recipient (address or ENS)
                </label>
                <input
                  type="text"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  placeholder="0x... or name.eth"
                  className="w-full px-4 py-4 rounded-lg bg-[#080808] border border-[#F0C14B]/30 text-white font-mono text-sm placeholder:text-slate-600 focus:border-[#F0C14B]/60 focus:outline-none transition-colors"
                />
                {resolveError && (
                  <p className="mt-2 text-xs text-red-400 font-mono">{resolveError}</p>
                )}
                {resolvedAddress && !resolveError && (
                  <p className="mt-2 text-xs text-emerald-400 font-mono truncate">
                    ✓ {resolvedAddress}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black font-mono text-[#F0C14B]/90 uppercase tracking-[0.2em] mb-3">
                  Amount (TRUST)
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-4 py-4 rounded-lg bg-[#080808] border border-[#F0C14B]/30 text-white font-mono text-sm placeholder:text-slate-600 focus:border-[#F0C14B]/60 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={setMaxAmount}
                    onMouseEnter={playHover}
                    className="px-5 py-4 rounded-lg border border-[#F0C14B]/50 text-[#F0C14B] font-mono text-[10px] font-black uppercase hover:bg-[#F0C14B]/10 transition-colors shrink-0"
                  >
                    Max
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500 font-mono flex items-center gap-1.5">
                  <Coins size={12} className="text-[#F0C14B]/80 shrink-0" /> Balance: {balanceFormatted} TRUST
                  <span className="text-[#8B5CF6]/80">· Live</span>
                </p>
              </div>

              <button
                type="button"
                disabled={!canSend}
                onClick={handleSend}
                onMouseEnter={canSend ? playHover : undefined}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-xl font-black font-mono text-sm uppercase tracking-widest bg-[#F0C14B] text-black hover:bg-[#FFD54F] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#F0C14B] transition-all shadow-[0_0_30px_rgba(240,193,75,0.35)] active:scale-[0.99]"
              >
                {isSending ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send size={20} /> Send TRUST
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="mt-12 h-px w-32 bg-gradient-to-r from-[#8B5CF6]/50 to-transparent" />
      </div>
    </div>
  );
};

export default SendTrust;
