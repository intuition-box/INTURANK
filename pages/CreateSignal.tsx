import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ArrowLeft, Terminal, Zap, Loader2, Database, GitBranch, Search, Camera, CheckCircle, ExternalLink, UserPlus, FileText, Sparkles, Info } from 'lucide-react';
import { Hex, pad } from 'viem';
import { createStringAtom, createThingAtom, createSingleTriple } from '../services/intuitionSdk';
import { getConnectedAccount, connectWallet, getWalletBalance, createSemanticTriple, checkProxyApproval, grantProxyApproval, parseProtocolError } from '../services/web3';
import { searchGlobalAgents } from '../services/graphql';
import { playClick, playHover } from '../services/audio';
import { toast } from '../components/Toast';
import { CURRENCY_SYMBOL } from '../constants';
import { CurrencySymbol } from '../components/CurrencySymbol';

type View = 'root' | 'identity_choice' | 'identity_manual' | 'identity_review' | 'claim' | 'claim_review' | 'construct_atom' | 'sdk' | 'manual_pathway' | 'establish_synapse';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const CreateSignal: React.FC = () => {
  const { address: wagmiAddress } = useAccount();
  const [view, setView] = useState<View>('root');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>('');
  const [identitySchemaType, setIdentitySchemaType] = useState<'Thing' | 'Person' | 'Organization' | 'Account'>('Thing');
  const [identityUrl, setIdentityUrl] = useState('');
  const [accountAddress, setAccountAddress] = useState('');
  const [accountChain, setAccountChain] = useState('Intuition Mainnet');

  // SDK form
  const [payload, setPayload] = useState('');
  const [deposit, setDeposit] = useState('0.01');
  const [creating, setCreating] = useState(false);
  const [lastTermId, setLastTermId] = useState<Hex | null>(null);
  const [successModal, setSuccessModal] = useState<{ termId: Hex | null; type: 'signal' | 'atom' | 'synapse' } | null>(null);

  // Manual CONSTRUCT_ATOM
  const [nodeAlias, setNodeAlias] = useState('');
  const [descriptionPayload, setDescriptionPayload] = useState('');
  const [atomDeposit, setAtomDeposit] = useState('0.1');
  const [imageUrl, setImageUrl] = useState('');
  const [creatingAtom, setCreatingAtom] = useState(false);

  // Manual ESTABLISH_SYNAPSE
  const [subjectId, setSubjectId] = useState('');
  const [subjectLabel, setSubjectLabel] = useState('');
  const [predicateId, setPredicateId] = useState('');
  const [predicateLabel, setPredicateLabel] = useState('');
  const [objectId, setObjectId] = useState('');
  const [objectLabel, setObjectLabel] = useState('');
  const [synapseDeposit, setSynapseDeposit] = useState('0.1');
  const [creatingSynapse, setCreatingSynapse] = useState(false);
  const [nodeSearchOpen, setNodeSearchOpen] = useState<'subject' | 'predicate' | 'object' | null>(null);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [nodeSearchResults, setNodeSearchResults] = useState<any[]>([]);
  const [nodeSearching, setNodeSearching] = useState(false);
  const [nodeSearchError, setNodeSearchError] = useState<string | null>(null);
  const [returnToSynapseSlot, setReturnToSynapseSlot] = useState<'subject' | 'predicate' | 'object' | null>(null);
  const [claimReviewApproved, setClaimReviewApproved] = useState<boolean | null>(null);
  const [enablingProtocol, setEnablingProtocol] = useState(false);
  const nodeSearchInputRef = useRef<HTMLInputElement>(null);
  const prevNodeSearchingRef = useRef(false);

  const ensureWallet = async () => {
    // Prefer wagmi address so we're in sync with header
    let account = wagmiAddress ?? (await getConnectedAccount());
    if (!account) {
      connectWallet(); // opens RainbowKit modal
      account = await getConnectedAccount();
    }
    if (!account) throw new Error('Connect wallet to continue');
    return account;
  };

  const handleBroadcastSdk = async () => {
    playClick();
    if (!payload.trim()) {
      toast.error('Enter claim payload');
      return;
    }
    try {
      await ensureWallet();
      setCreating(true);
      setLastTermId(null);
      const result = await createStringAtom(payload.trim(), deposit || undefined);
      const termId = result.state.termId as Hex;
      setLastTermId(termId);
      setSuccessModal({ termId, type: 'signal' });
      toast.success('Claim created successfully');
    } catch (err: any) {
      toast.error((err?.message || 'BROADCAST_FAILED').slice(0, 120));
    } finally {
      setCreating(false);
    }
  };

  const handleConstructAtom = async () => {
    playClick();
    if (!nodeAlias.trim()) {
      toast.error('ENTER_ENTITY_NAME');
      return;
    }
    try {
      await ensureWallet();
      setCreatingAtom(true);
      const thing: Record<string, unknown> = {
        name: nodeAlias.trim(),
        description: descriptionPayload.trim() || undefined,
        ...(imageUrl.trim() && { image: imageUrl.trim() }),
        ...(identityUrl.trim() && { url: identityUrl.trim() }),
      };
      const result = await createThingAtom(thing, atomDeposit || '0.1');
      setImageFile(null);
      const termId = (result as any).state?.termId ?? (result as any).termId ?? null;
      if (termId) setLastTermId(termId as Hex);
      if (returnToSynapseSlot) {
        const id = termId as string;
        const label = nodeAlias.trim() || 'New atom';
        if (returnToSynapseSlot === 'subject') { setSubjectId(id); setSubjectLabel(label); }
        else if (returnToSynapseSlot === 'predicate') { setPredicateId(id); setPredicateLabel(label); }
        else { setObjectId(id); setObjectLabel(label); }
        setView('claim');
        setReturnToSynapseSlot(null);
      }
      setSuccessModal({ termId: termId as Hex | null, type: 'atom' });
      toast.success('ATOM_ESTABLISHED');
    } catch (err: any) {
      toast.error((err?.message || 'GENESIS_FAILED').slice(0, 120));
    } finally {
      setCreatingAtom(false);
    }
  };

  const handleEstablishSynapse = async () => {
    playClick();
    if (!subjectId || !predicateId || !objectId) {
      toast.error('CONNECT_ALL_NODES');
      return;
    }
    try {
      await ensureWallet();
      setCreatingSynapse(true);
      const result = await createSingleTriple(
        subjectId as Hex,
        predicateId as Hex,
        objectId as Hex,
        synapseDeposit || '0.1',
      );
      const tripleTermId = (result as any)?.state?.termId ?? (result as any)?.termId ?? null;
      setSuccessModal({ termId: tripleTermId as Hex | null, type: 'synapse' });
      toast.success('SYNAPSE_ESTABLISHED');
      setSubjectId('');
      setSubjectLabel('');
      setPredicateId('');
      setPredicateLabel('');
      setObjectId('');
      setObjectLabel('');
    } catch (err: any) {
      toast.error((err?.message || 'LINKAGE_FAILED').slice(0, 120));
    } finally {
      setCreatingSynapse(false);
    }
  };

  const runNodeSearch = async () => {
    const q = nodeSearchQuery.trim();
    if (!q) {
      setNodeSearchResults([]);
      setNodeSearchError(null);
      return;
    }
    setNodeSearchError(null);
    setNodeSearching(true);
    try {
      const res = await searchGlobalAgents(q);
      setNodeSearchResults(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setNodeSearchResults([]);
      setNodeSearchError(e?.message || 'Search failed');
    } finally {
      setNodeSearching(false);
    }
  };

  // Real-time debounced search when query changes (no Enter needed)
  useEffect(() => {
    if (!nodeSearchOpen) return;
    const q = nodeSearchQuery.trim();
    if (!q) {
      setNodeSearchResults([]);
      setNodeSearchError(null);
      return;
    }
    const t = setTimeout(() => { runNodeSearch(); }, 320);
    return () => clearTimeout(t);
  }, [nodeSearchQuery, nodeSearchOpen]);

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
      setImageFile(file);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const pickNode = (role: 'subject' | 'predicate' | 'object', id: string, label: string) => {
    if (role === 'subject') {
      setSubjectId(id);
      setSubjectLabel(label);
    } else if (role === 'predicate') {
      setPredicateId(id);
      setPredicateLabel(label);
    } else {
      setObjectId(id);
      setObjectLabel(label);
    }
    setNodeSearchOpen(null);
    setNodeSearchQuery('');
    setNodeSearchResults([]);
  };

  // Load wallet balance when entering review or identity-manual (Account) screens; use wagmi address so we stay in sync
  useEffect(() => {
    if (view !== 'identity_review' && view !== 'claim_review' && view !== 'identity_manual') return;
    const acc = wagmiAddress ?? null;
    if (!acc) {
      setWalletBalance('0');
      return;
    }
    let cancelled = false;
    getWalletBalance(acc).then((b) => {
      if (!cancelled) setWalletBalance(b || '0');
    });
    return () => { cancelled = true; };
  }, [view, wagmiAddress]);

  // Keep focus in search input: focus when panel opens, restore when search finishes
  useEffect(() => {
    if (nodeSearchOpen) {
      const t = requestAnimationFrame(() => {
        nodeSearchInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(t);
    }
  }, [nodeSearchOpen]);

  useEffect(() => {
    if (prevNodeSearchingRef.current && !nodeSearching) {
      nodeSearchInputRef.current?.focus();
    }
    prevNodeSearchingRef.current = nodeSearching;
  }, [nodeSearching]);

  // Clear stale error toasts when opening Review & Confirm so user doesn't see a previous failure
  useEffect(() => {
    if (view === 'claim_review') toast.dismissAll();
  }, [view]);

  // Check protocol approval when on claim review; use wagmi address to stay in sync
  useEffect(() => {
    if (view !== 'claim_review') return;
    const acc = wagmiAddress ?? null;
    if (!acc) {
      setClaimReviewApproved(null);
      return;
    }
    let cancelled = false;
    checkProxyApproval(acc).then((v) => {
      if (!cancelled) setClaimReviewApproved(v);
    });
    return () => { cancelled = true; };
  }, [view, wagmiAddress]);

  const handleSubmitIdentityFromReview = async () => {
    playClick();
    const isAccount = identitySchemaType === 'Account';
    if (isAccount && !accountAddress.trim()) {
      toast.error('Enter an address for Account');
      return;
    }
    if (!isAccount && !nodeAlias.trim()) return;
    try {
      await ensureWallet();
      setCreatingAtom(true);
      const deposit = atomDeposit || '0.1';
      const thing: Record<string, unknown> = isAccount
        ? { type: 'Account', address: accountAddress.trim(), chain: accountChain }
        : {
            name: nodeAlias.trim(),
            description: descriptionPayload.trim() || undefined,
            ...(imageUrl.trim() && { image: imageUrl.trim() }),
            ...(identityUrl.trim() && { url: identityUrl.trim() }),
          };
      const result = await createThingAtom(thing, deposit);
      setImageFile(null);
      const termId = (result as any).state?.termId ?? (result as any).termId ?? null;
      if (termId) setLastTermId(termId as Hex);
      setSuccessModal({ termId: termId as Hex | null, type: 'atom' });
      toast.success('ATOM_ESTABLISHED');
      setView('root');
    } catch (err: any) {
      toast.error((err?.message || 'GENESIS_FAILED').slice(0, 120));
    } finally {
      setCreatingAtom(false);
    }
  };

  const handleSubmitClaimFromReview = async () => {
    playClick();
    if (!subjectId || !predicateId || !objectId) return;
    const depositAmount = synapseDeposit || '0.1';
    try {
      const account = await ensureWallet();
      setCreatingSynapse(true);
      const approved = await checkProxyApproval(account);
      if (!approved) {
        await grantProxyApproval(account);
      }
      try {
        await createSemanticTriple(subjectId, predicateId, objectId, depositAmount, account);
      } catch (feeProxyErr: any) {
        // Try SDK path on any FeeProxy failure (revert, custom error, etc.)
        const toHex32 = (id: string): Hex =>
          pad((id.startsWith('0x') ? id : `0x${id}`) as Hex, { size: 32 });
        try {
          await createSingleTriple(
            toHex32(subjectId),
            toHex32(predicateId),
            toHex32(objectId),
            depositAmount,
          );
        } catch (sdkErr: any) {
          const fallbackMsg = sdkErr?.message || sdkErr?.toString?.() || '';
          if (fallbackMsg) console.warn('Triple creation SDK fallback failed:', fallbackMsg);
          throw new Error('Triple creation failed. Check: all 3 atoms exist on-chain and enough TRUST.');
        }
      }
      setSuccessModal({ termId: null, type: 'synapse' });
      toast.success('SYNAPSE_ESTABLISHED');
      setSubjectId('');
      setSubjectLabel('');
      setPredicateId('');
      setPredicateLabel('');
      setObjectId('');
      setObjectLabel('');
      setView('root');
    } catch (err: any) {
      const msg = parseProtocolError(err) || err?.message || 'LINKAGE_FAILED';
      toast.error(msg.length > 100 ? msg.slice(0, 97) + '…' : msg);
    } finally {
      setCreatingSynapse(false);
    }
  };

  const frameHeader = (
    <>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-intuition-success/10 border border-intuition-success px-6 py-1 text-[9px] font-black text-intuition-success tracking-[0.4em] uppercase clip-path-slant">
        ACTIVE
      </div>
      <div className="relative mb-6 mt-4">
        <div className="absolute -inset-8 bg-intuition-primary/20 blur-3xl rounded-full animate-pulse"></div>
        <div className="w-20 h-20 bg-black border-2 border-intuition-primary flex items-center justify-center text-intuition-primary shadow-glow-blue clip-path-slant">
          <Zap size={40} className="animate-pulse" />
        </div>
      </div>
    </>
  );

  const footer = (
    <div className="mt-10 flex items-center justify-center gap-10 border-t border-white/10 pt-8 w-full font-mono">
      <div className="flex flex-col items-center">
        <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">Module</span>
        <span className="text-[10px] font-black text-white uppercase tracking-widest">S05_CREATE</span>
      </div>
      <div className="w-px h-6 bg-intuition-primary/30"></div>
      <div className="flex flex-col items-center">
        <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">Handshake</span>
        <span className="text-[10px] font-black text-intuition-success uppercase tracking-widest text-glow-success">SYNC_ACTIVE</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden font-mono bg-[#020308]">
      <div className="fixed inset-0 pointer-events-none z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      <div className="absolute inset-0 pointer-events-none opacity-[0.06] retro-grid" aria-hidden />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-intuition-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Success modal — shown when transaction is confirmed */}
      {successModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setSuccessModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-modal-title"
        >
          <div
            className="relative w-full max-w-md bg-[#0a0a0a] border-2 border-intuition-success/60 shadow-neon-gold shadow-[0_0_60px_rgba(34,197,94,0.15)] p-8 clip-path-slant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-full bg-intuition-success/20 flex items-center justify-center">
                <CheckCircle size={36} className="text-intuition-success" />
              </div>
              <div>
                <h2 id="success-modal-title" className="text-lg font-black text-white uppercase tracking-widest mb-1">Transaction confirmed</h2>
                <p className="text-[10px] font-black text-intuition-success uppercase tracking-[0.2em]">
                  {successModal.type === 'signal' && 'Claim created'}
                  {successModal.type === 'atom' && 'ATOM_ESTABLISHED'}
                  {successModal.type === 'synapse' && 'SYNAPSE_LINKED'}
                </p>
              </div>
              {successModal.termId && (
                <Link
                  to={`/markets/${successModal.termId}`}
                  onClick={() => { playClick(); setSuccessModal(null); }}
                  className="flex items-center gap-2 px-6 py-3 bg-intuition-primary hover:bg-white text-black font-black text-xs uppercase tracking-widest transition-colors clip-path-slant"
                >
                  <ExternalLink size={14} /> Open claim
                </Link>
              )}
              <button
                type="button"
                onClick={() => { playClick(); setSuccessModal(null); }}
                className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-3xl mx-auto px-2 sm:px-4">
        <div className="bg-[#02040a] border-2 border-intuition-primary/20 p-6 sm:p-8 md:p-12 flex flex-col items-center clip-path-slant shadow-2xl shadow-intuition-primary/5 relative overflow-hidden group min-h-[420px]">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,243,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,30,109,0.01)_1px,transparent_1px)] bg-[size:32px_32px] opacity-60" aria-hidden />

          {/* ----- ROOT: Create identity or claim ----- */}
          {view === 'root' && (
            <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-left-4 duration-300 fill-mode-both">
            <>
              <div className="flex items-center justify-between w-full mb-8">
                <Link
                  to="/markets"
                  onClick={playClick}
                  onMouseEnter={playHover}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-slate-600 text-slate-300 hover:border-intuition-primary hover:text-intuition-primary font-black text-[10px] uppercase tracking-widest clip-path-slant transition-all duration-200"
                >
                  <ArrowLeft size={16} /> Back to claims
                </Link>
                <span className="text-[9px] text-intuition-primary uppercase tracking-[0.4em] font-black">CREATE</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white font-display tracking-tighter uppercase text-center mb-3">Create identity or claim</h1>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-center mb-10 max-w-lg mx-auto">
                Anchor a new identity on the graph or attest a semantic claim (triple).
              </p>
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={() => { playClick(); setView('identity_choice'); }}
                  onMouseEnter={playHover}
                  className="p-8 bg-white/[0.06] border-2 border-intuition-primary/50 hover:border-intuition-primary hover:bg-intuition-primary/10 hover:shadow-[0_0_30px_rgba(0,243,255,0.25)] clip-path-slant text-left transition-all group"
                >
                  <UserPlus size={32} className="text-intuition-primary mb-4 group-hover:scale-110 transition-transform text-glow-blue" />
                  <div className="text-white font-black text-sm uppercase tracking-widest mb-2">Create identity</div>
                  <div className="text-[10px] text-slate-400 leading-relaxed">Generate with AI or create manually. Things, persons, organizations, accounts.</div>
                  <div className="mt-4 text-intuition-primary text-[10px] font-black uppercase tracking-widest text-glow-blue">→</div>
                </button>
                <button
                  onClick={() => { playClick(); setView('claim'); }}
                  onMouseEnter={playHover}
                  className="p-8 bg-white/[0.06] border-2 border-[#a855f7]/50 hover:border-[#a855f7] hover:bg-[#a855f7]/10 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] clip-path-slant text-left transition-all group"
                >
                  <FileText size={32} className="text-[#a855f7] mb-4 group-hover:scale-110 transition-transform text-glow-purple" />
                  <div className="text-white font-black text-sm uppercase tracking-widest mb-2">Create claim</div>
                  <div className="text-[10px] text-slate-400 leading-relaxed">Claim anything about anything. Subject – predicate – object (semantic triple).</div>
                  <div className="mt-4 text-[#a855f7] text-[10px] font-black uppercase tracking-widest text-glow-purple">→</div>
                </button>
              </div>
              {footer}
            </>
            </div>
          )}

          {/* ----- IDENTITY CHOICE: Generate with AI | Create Manually ----- */}
          {view === 'identity_choice' && (
            <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              <div className="flex items-center justify-between w-full mb-8">
                <button type="button" onClick={() => { playClick(); setView('root'); }} onMouseEnter={playHover} className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-slate-600 text-slate-300 hover:border-intuition-primary hover:text-intuition-primary font-black text-[10px] uppercase tracking-widest clip-path-slant transition-all duration-200 z-10">
                  <ArrowLeft size={14} /> Back
                </button>
                <span className="text-[9px] text-slate-400 uppercase tracking-[0.4em] font-black">Create identity</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-white font-display tracking-tighter uppercase text-center mb-8">Choose how to create</h1>
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                <button type="button" disabled className="p-8 bg-white/[0.04] border-2 border-white/10 opacity-60 cursor-not-allowed clip-path-slant text-left">
                  <Sparkles size={32} className="text-slate-500 mb-4" />
                  <div className="text-white font-black text-sm uppercase tracking-widest mb-2">Generate identity with AI</div>
                  <div className="text-[10px] text-slate-500 leading-relaxed">Coming soon.</div>
                </button>
                <button
                  onClick={() => { playClick(); setView('identity_manual'); }}
                  onMouseEnter={playHover}
                  className="p-8 bg-white/[0.06] border-2 border-amber-400/60 hover:border-amber-400 hover:bg-amber-500/10 hover:shadow-[0_0_28px_rgba(251,191,36,0.3)] clip-path-slant text-left transition-all group"
                >
                  <UserPlus size={32} className="text-amber-300 mb-4 group-hover:scale-110 transition-transform text-glow-gold" />
                  <div className="text-white font-black text-sm uppercase tracking-widest mb-2">Create identity manually</div>
                  <div className="text-[10px] text-slate-400 leading-relaxed">Schema type, image, name, description, URL, initial deposit.</div>
                  <div className="mt-4 text-amber-300 text-[10px] font-black uppercase tracking-widest text-glow-gold">→</div>
                </button>
              </div>
              {footer}
            </>
            </div>
          )}

          {/* ----- IDENTITY MANUAL: Create New Identity form ----- */}
          {view === 'identity_manual' && (
            <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              <div className="flex items-center justify-between w-full mb-8">
                <button type="button" onClick={() => { playClick(); setView('identity_choice'); }} onMouseEnter={playHover} className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-slate-600 text-slate-300 hover:border-amber-400 hover:text-amber-300 font-black text-[10px] uppercase tracking-widest clip-path-slant transition-all duration-200 z-10">
                  <ArrowLeft size={14} /> Back
                </button>
                <span className="text-[9px] text-amber-400/90 uppercase tracking-[0.4em] font-black">Create identity</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white font-display tracking-tighter uppercase text-center mb-8">Create new identity</h1>
              <div className="w-full max-w-lg mx-auto space-y-5 text-left">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 block">Schema type</label>
                  <select value={identitySchemaType} onChange={(e) => setIdentitySchemaType(e.target.value as any)} className="w-full bg-black border border-white/10 py-3 px-4 text-sm text-white font-mono focus:border-intuition-primary outline-none">
                    <option value="Thing">Thing</option>
                    <option value="Person">Person</option>
                    <option value="Organization">Organization</option>
                    <option value="Account">Account</option>
                  </select>
                </div>
                {identitySchemaType === 'Account' ? (
                  <>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 block">Address</label>
                      <input value={accountAddress} onChange={(e) => setAccountAddress(e.target.value)} placeholder="0x..." className="w-full bg-black border border-white/10 py-3 px-4 text-sm text-white font-mono focus:border-intuition-primary outline-none placeholder-slate-600" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 block">Chain</label>
                      <select value={accountChain} onChange={(e) => setAccountChain(e.target.value)} className="w-full bg-black border border-white/10 py-3 px-4 text-sm text-white font-mono focus:border-intuition-primary outline-none">
                        <option value="Intuition Mainnet">Intuition Mainnet</option>
                        <option value="Base">Base</option>
                        <option value="Ethereum">Ethereum</option>
                        <option value="Polygon">Polygon</option>
                        <option value="Arbitrum">Arbitrum</option>
                        <option value="Optimism">Optimism</option>
                      </select>
                    </div>
                    <div>
<label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 block">Initial deposit</label>
                    <input type="number" min="0" step="0.01" value={atomDeposit} onChange={(e) => setAtomDeposit(e.target.value)} className="w-28 bg-black border-2 border-white/15 py-2 px-3 text-sm text-white font-mono outline-none focus:border-intuition-primary" />
                    <span className="ml-2"><CurrencySymbol size="md" className="text-intuition-primary/90" /></span>
                    {walletBalance && <span className="block mt-1 text-[10px] text-slate-400 inline-flex items-baseline gap-1">{walletBalance} <CurrencySymbol size="sm" /> available</span>}
                    </div>
                    <button type="button" onClick={() => { playClick(); setView('identity_review'); }} disabled={!accountAddress.trim()} className="w-full py-4 bg-intuition-primary hover:bg-white text-black font-black text-xs uppercase tracking-widest clip-path-slant disabled:opacity-50 disabled:cursor-not-allowed">
                      Continue
                    </button>
                  </>
                ) : (
                  <>
                    <div className="border-2 border-dashed border-white/20 p-6 flex flex-col items-center justify-center gap-2">
                      <Camera size={28} className="text-slate-600" />
                      <span className="text-[9px] font-black text-slate-400 uppercase">Image</span>
                      <span className="text-[8px] text-slate-600">PNG, JPG, GIF up to 5MB</span>
                      <label className="mt-2 px-4 py-2 bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase cursor-pointer hover:bg-white/20 transition-colors">
                        <input type="file" accept="image/png,image/jpeg,image/jpg,image/gif" onChange={handleImageFileChange} className="sr-only" />
                        Choose file
                      </label>
                      {imageFile && <span className="text-[9px] text-intuition-primary truncate max-w-full">{imageFile.name}</span>}
                      <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Or paste image URL" className="mt-2 w-full bg-black border border-white/10 py-2 px-3 text-[10px] text-white font-mono outline-none placeholder-slate-600" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 block">Name</label>
                      <input value={nodeAlias} onChange={(e) => setNodeAlias(e.target.value)} placeholder="Enter name" className="w-full bg-black border border-white/10 py-3 px-4 text-sm text-white font-mono focus:border-intuition-primary outline-none placeholder-slate-600" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 block">Description</label>
                      <textarea value={descriptionPayload} onChange={(e) => setDescriptionPayload(e.target.value)} placeholder="Enter description" rows={3} className="w-full bg-black border border-white/10 py-3 px-4 text-sm text-white font-mono focus:border-intuition-primary outline-none placeholder-slate-600 resize-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 block">URL</label>
                      <input type="url" value={identityUrl} onChange={(e) => setIdentityUrl(e.target.value)} placeholder="Enter website URL" className="w-full bg-black border border-white/10 py-3 px-4 text-sm text-white font-mono focus:border-intuition-primary outline-none placeholder-slate-600" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 block">Initial deposit</label>
                      <input type="number" min="0" step="0.01" value={atomDeposit} onChange={(e) => setAtomDeposit(e.target.value)} className="w-28 bg-black border-2 border-white/15 py-2 px-3 text-sm text-white font-mono outline-none focus:border-intuition-primary" />
                      <span className="ml-2"><CurrencySymbol size="md" className="text-intuition-primary/90" /></span>
                    </div>
                    <button type="button" onClick={() => { playClick(); setView('identity_review'); }} disabled={!nodeAlias.trim()} className="w-full py-4 bg-intuition-primary hover:bg-white text-black font-black text-xs uppercase tracking-widest clip-path-slant disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_24px_rgba(0,243,255,0.35)] transition-all">
                      Continue
                    </button>
                  </>
                )}
              </div>
              {footer}
            </>
            </div>
          )}

          {/* ----- IDENTITY REVIEW & CONFIRM ----- */}
          {view === 'identity_review' && (
            <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              <div className="flex items-center justify-between w-full mb-8">
                <button type="button" onClick={() => { playClick(); setView('identity_manual'); }} onMouseEnter={playHover} className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-slate-600 text-slate-300 hover:border-intuition-primary hover:text-intuition-primary font-black text-[10px] uppercase tracking-widest clip-path-slant transition-all duration-200 z-10">
                  <ArrowLeft size={14} /> Back
                </button>
                <span className="text-[9px] text-intuition-primary uppercase tracking-[0.4em] font-black">Create identity</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white font-display tracking-tighter uppercase text-center mb-8">Review & confirm</h1>
              <div className="w-full max-w-md space-y-5 text-left">
                <div className="border-2 border-intuition-primary/50 p-4 bg-[#050505] shadow-[0_0_20px_rgba(0,243,255,0.15)]">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Identity</div>
                  <div className="text-white font-mono">
                    {identitySchemaType === 'Account' ? `Account: ${accountAddress.trim().slice(0, 10)}… (${accountChain})` : `Create: ${nodeAlias.trim() || '—'}`}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 inline-flex items-baseline gap-1">Initial deposit: {atomDeposit || '0'} <CurrencySymbol size="sm" /></div>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Total cost</span>
                  <span className="text-white font-mono inline-flex items-baseline gap-1">{atomDeposit || '0'} <CurrencySymbol size="md" className="text-white/90" /></span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Available balance</span>
                  <span className="text-white font-mono inline-flex items-baseline gap-1">{walletBalance || '—'} <CurrencySymbol size="md" className="text-white/90" /></span>
                </div>
                <div className="flex items-start gap-2 p-3 bg-white/5 border border-white/10">
                  <Info size={14} className="text-intuition-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400">You will be prompted to approve the transaction in your wallet.</p>
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setView('identity_manual')} className="flex-1 py-3 border border-intuition-primary/50 text-intuition-primary font-black text-[10px] uppercase tracking-widest clip-path-slant hover:shadow-neon-blue transition-all">
                    Back
                  </button>
                  <button type="button" onClick={handleSubmitIdentityFromReview} disabled={creatingAtom} className="flex-1 py-3 bg-intuition-primary border-2 border-intuition-primary text-black font-black text-[10px] uppercase tracking-widest clip-path-slant disabled:opacity-60 hover:bg-white hover:text-intuition-primary hover:shadow-[0_0_28px_rgba(0,243,255,0.4)] transition-all shadow-[0_0_18px_rgba(0,243,255,0.25)]">
                    {creatingAtom ? <><Loader2 size={14} className="animate-spin inline mr-2" /> Submitting…</> : 'Submit transactions'}
                  </button>
                </div>
              </div>
              {footer}
            </>
            </div>
          )}

          {/* ----- INGRESS: Choose SDK vs Manual ----- */}
          {view === 'ingress' && (
            <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              {frameHeader}
              <h1 className="text-3xl md:text-5xl font-black text-white font-display tracking-tighter uppercase text-center mb-2">Create claim</h1>
              <h1 className="text-3xl md:text-5xl font-black text-intuition-primary font-display tracking-tighter uppercase text-center mb-8">ACTIVE</h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center mb-10">
                Choose how to create a new claim on the Intuition trust graph.
              </p>
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                <button
                  onClick={() => { playClick(); setView('sdk'); }}
                  onMouseEnter={playHover}
                  className="p-8 bg-white/5 border-2 border-intuition-primary/40 hover:border-intuition-primary hover:bg-intuition-primary/10 clip-path-slant text-left transition-all group"
                >
                  <Terminal size={32} className="text-intuition-primary mb-4 group-hover:scale-110 transition-transform" />
                  <div className="text-white font-black text-sm uppercase tracking-widest mb-2">USE_SDK</div>
                  <div className="text-[10px] text-slate-500 leading-relaxed">Quick broadcast. Payload + deposit; SDK handles creation on-chain.</div>
                  <div className="mt-4 text-intuition-primary text-[10px] font-black uppercase tracking-widest">Create claim →</div>
                </button>
                <button
                  onClick={() => { playClick(); setView('manual_pathway'); }}
                  onMouseEnter={playHover}
                  className="p-8 bg-white/5 border-2 border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 clip-path-slant text-left transition-all group"
                >
                  <Database size={32} className="text-amber-400 mb-4 group-hover:scale-110 transition-transform" />
                  <div className="text-white font-black text-sm uppercase tracking-widest mb-2">MANUAL</div>
                  <div className="text-[10px] text-slate-500 leading-relaxed">Full control. Construct an atom or define a synapse (triple) step by step.</div>
                  <div className="mt-4 text-amber-400 text-[10px] font-black uppercase tracking-widest">CHOOSE_PATHWAY →</div>
                </button>
              </div>
              {footer}
            </>
            </div>
          )}

          {/* ----- SDK: Simple form ----- */}
          {view === 'sdk' && (
            <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              {frameHeader}
              <h1 className="text-3xl md:text-5xl font-black text-white font-display tracking-tighter uppercase text-center mb-2">SIGNAL_INGRESS</h1>
              <h1 className="text-3xl md:text-5xl font-black text-intuition-primary font-display tracking-tighter uppercase text-center mb-6">ACTIVE</h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center mb-8">
                On-chain creation via SDK. Broadcast a new signal below.
              </p>
              <div className="w-full max-w-md space-y-4 mb-8 text-left">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 block">Claim payload</label>
                  <input
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    placeholder="e.g. IntuRank, Prediction Markets, DeFi"
                    className="w-full bg-black border border-white/10 py-3 px-4 text-sm text-white font-mono focus:border-intuition-primary outline-none placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 block">OPTIONAL_DEPOSIT (TRUST)</label>
                  <input type="number" min="0" step="0.001" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="w-32 bg-black border border-white/10 py-2 px-3 text-sm text-white font-mono focus:border-intuition-primary outline-none" />
                </div>
                <button onClick={handleBroadcastSdk} disabled={creating} className="w-full py-4 bg-intuition-primary hover:bg-white text-black font-black text-xs tracking-[0.3em] uppercase flex items-center justify-center gap-3 transition-all shadow-glow-blue clip-path-slant disabled:opacity-60">
                  {creating ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <>Create claim</>}
                </button>
                {lastTermId && (
                  <div className="pt-4 border-t border-white/10 space-y-1">
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest">Term ID</div>
                    <Link to={`/markets/${lastTermId}`} className="block text-intuition-primary font-mono text-xs break-all hover:underline">{lastTermId}</Link>
                    <Link to={`/markets/${lastTermId}`} className="inline-block mt-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-intuition-primary">→ Open claim</Link>
                  </div>
                )}
              </div>
              <Link to="/sdk-lab" onClick={playClick} onMouseEnter={playHover} className="mt-6 flex items-center gap-2 text-slate-500 hover:text-intuition-primary text-[10px] font-black uppercase tracking-widest">
                <Terminal size={12} /> ADVANCED_SDK_LAB
              </Link>
              {footer}
            </>
            </div>
          )}

          {/* ----- MANUAL: CHOOSE_PATHWAY ----- */}
          {view === 'manual_pathway' && (
            <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              <div className="text-[9px] text-slate-600 uppercase tracking-[0.4em] mb-2">INGRESS_MODULE // S05_ARES</div>
              <h1 className="text-3xl md:text-5xl font-black text-white font-display tracking-tighter uppercase text-center mb-8">SIGNAL_TERMINAL</h1>
              <div className="w-full mb-8">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-4">CHOOSE_PATHWAY</div>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-8">
                  Select the type of claim to create on the Intuition trust graph. All creations use the linear curve for initial predictable liquidity.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button onClick={() => { playClick(); setView('construct_atom'); }} onMouseEnter={playHover} className="p-8 bg-white/5 border border-intuition-primary/40 hover:border-intuition-primary clip-path-slant text-left transition-all group">
                    <Database size={28} className="text-intuition-primary mb-4" />
                    <div className="text-white font-black text-sm uppercase tracking-widest mb-2">CONSTRUCT_ATOM</div>
                    <div className="text-[10px] text-slate-500 leading-relaxed mb-4">Create a new atom (identity). Add metadata, image, and initial liquidity.</div>
                    <span className="text-intuition-primary text-[10px] font-black uppercase tracking-widest">INITIALIZE_GENESIS →</span>
                  </button>
                  <button onClick={() => { playClick(); setView('establish_synapse'); }} onMouseEnter={playHover} className="p-8 bg-white/5 border border-[#a855f7]/40 hover:border-[#a855f7] clip-path-slant text-left transition-all group">
                    <GitBranch size={28} className="text-[#a855f7] mb-4" />
                    <div className="text-white font-black text-sm uppercase tracking-widest mb-2">DEFINE_SYNAPSE</div>
                    <div className="text-[10px] text-slate-500 leading-relaxed mb-4">Connect atoms via semantic claims. Build intelligence bridges between nodes to establish relational consensus.</div>
                    <span className="text-[#a855f7] text-[10px] font-black uppercase tracking-widest">ESTABLISH_LINKAGE →</span>
                  </button>
                </div>
              </div>
              {footer}
            </>
            </div>
          )}

          {/* ----- CONSTRUCT_ATOM (manual / or from claim "Create atom") ----- */}
          {view === 'construct_atom' && (
            <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              <button
                type="button"
                onClick={() => { playClick(); setReturnToSynapseSlot(null); setView(returnToSynapseSlot ? 'claim' : 'manual_pathway'); }}
                onMouseEnter={playHover}
                className="absolute top-6 left-6 inline-flex items-center gap-2 px-4 py-2.5 border-2 border-slate-700 text-slate-300 hover:border-intuition-primary hover:text-intuition-primary font-black text-[10px] uppercase tracking-widest clip-path-slant transition-all duration-200 z-10"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <div className="text-[9px] text-slate-600 uppercase tracking-[0.4em] mb-2">INGRESS_MODULE // S05_ARES</div>
              <h1 className="text-2xl md:text-4xl font-black text-white font-display tracking-tighter uppercase text-center mb-8">CONSTRUCT_ATOM</h1>
              <div className="w-full max-w-lg space-y-6 text-left">
                <div className="border-2 border-dashed border-white/20 p-8 flex flex-col items-center justify-center gap-2">
                  <Camera size={32} className="text-slate-600" />
                  <span className="text-[9px] font-black text-slate-500 uppercase">UPLOAD_NEURAL_FRAME</span>
                  <span className="text-[8px] text-slate-600">FORMAT: PNG/JPG (MAX 5MB)</span>
                  <label className="mt-2 px-4 py-2 bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase cursor-pointer hover:bg-white/20 transition-colors">
                    <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleImageFileChange} className="sr-only" />
                    Choose file
                  </label>
                  {imageFile && <span className="text-[9px] text-intuition-primary truncate max-w-full">{imageFile.name}</span>}
                  <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Or paste image URL" className="mt-2 w-full bg-black border border-white/10 py-2 px-3 text-[10px] text-white font-mono outline-none placeholder-slate-600" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 block">NODE_ALIAS</label>
                  <input value={nodeAlias} onChange={(e) => setNodeAlias(e.target.value)} placeholder="ENTITY_NAME..." className="w-full bg-black border border-white/10 py-3 px-4 text-sm text-white font-mono focus:border-intuition-primary outline-none placeholder-slate-600" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 block">DESCRIPTION_PAYLOAD</label>
                  <textarea value={descriptionPayload} onChange={(e) => setDescriptionPayload(e.target.value)} placeholder="ESTABLISH_REASONING_VECTOR..." rows={3} className="w-full bg-black border border-white/10 py-3 px-4 text-sm text-white font-mono focus:border-intuition-primary outline-none placeholder-slate-600 resize-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 block">INGRESS_DEPOSIT (TRUST)</label>
                  <input type="number" min="0" step="0.01" value={atomDeposit} onChange={(e) => setAtomDeposit(e.target.value)} className="w-28 bg-black border border-white/10 py-2 px-3 text-sm text-white font-mono outline-none" />
                </div>
                <div className="flex gap-6 text-[9px] text-slate-500">
                  <div><span className="block uppercase tracking-widest mb-1">PROTOCOL_COST</span><span>—</span></div>
                  <div><span className="block uppercase tracking-widest mb-1">EST_GAS_VECTOR</span><span>—</span></div>
                  <div><span className="block uppercase tracking-widest mb-1">NET_REQUIRED</span><span className="text-white inline-flex items-baseline gap-1">{atomDeposit || '0'} <CurrencySymbol size="md" /></span></div>
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => { setReturnToSynapseSlot(null); setView(returnToSynapseSlot ? 'claim' : 'manual_pathway'); }} className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest clip-path-slant">ABORT_GENESIS</button>
                  <button onClick={handleConstructAtom} disabled={creatingAtom} className="flex-1 py-3 bg-intuition-primary text-black font-black text-[10px] uppercase tracking-widest clip-path-slant disabled:opacity-60">
                    {creatingAtom ? <Loader2 size={14} className="animate-spin inline mr-2" /> : null} VERIFY_&_ESTABLISH
                  </button>
                </div>
              </div>
              {footer}
            </>
            </div>
          )}

          {/* ----- CREATE CLAIM (main flow) ----- */}
          {view === 'claim' && (
            <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              <div className="flex items-center justify-between w-full mb-8">
                <button type="button" onClick={() => { playClick(); setView('root'); }} onMouseEnter={playHover} className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-slate-600 text-slate-300 hover:border-intuition-primary hover:text-intuition-primary font-black text-[10px] uppercase tracking-widest clip-path-slant transition-all duration-200 z-10">
                  <ArrowLeft size={14} /> Back
                </button>
                <span className="text-[9px] text-[#a855f7] uppercase tracking-[0.4em] font-black">CREATE CLAIM</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white font-display tracking-tighter uppercase text-center mb-3">Create claim</h1>
              <p className="text-[11px] font-black text-slate-400 text-center mb-8 max-w-lg mx-auto leading-relaxed">
                Claim anything about anything. Claims in Intuition (also called triples) are structured as a semantic triple — like a sentence. For example:{' '}
                <span className="text-intuition-primary font-bold">[Alice]</span>{' '}
                <span className="text-white/90 font-bold">[is]</span>{' '}
                <span className="text-intuition-primary font-bold">[trustworthy]</span>.
              </p>
              <div className="w-full max-w-2xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['subject', 'predicate', 'object'] as const).map((role) => (
                    <div key={role} className="border-2 border-dashed border-intuition-primary/30 p-6 flex flex-col items-center justify-center min-h-[120px] relative bg-white/[0.02] hover:border-intuition-primary/50 transition-colors">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{role === 'subject' ? 'Subject' : role === 'predicate' ? 'Predicate' : 'Object'}</div>
                      {role === 'subject' && subjectId ? (
                        <div className="text-center">
                          <div className="text-intuition-primary font-mono text-[10px] truncate max-w-full" title={subjectId}>{subjectLabel || subjectId.slice(0, 12)}…</div>
                          <button type="button" onClick={() => { setSubjectId(''); setSubjectLabel(''); }} className="text-slate-500 text-[8px] mt-1">clear</button>
                        </div>
                      ) : null}
                      {role === 'predicate' && predicateId ? (
                        <div className="text-center">
                          <div className="text-intuition-primary font-mono text-[10px] truncate max-w-full">{predicateLabel || predicateId.slice(0, 12)}…</div>
                          <button type="button" onClick={() => { setPredicateId(''); setPredicateLabel(''); }} className="text-slate-500 text-[8px] mt-1">clear</button>
                        </div>
                      ) : null}
                      {role === 'object' && objectId ? (
                        <div className="text-center">
                          <div className="text-intuition-primary font-mono text-[10px] truncate max-w-full">{objectLabel || objectId.slice(0, 12)}…</div>
                          <button type="button" onClick={() => { setObjectId(''); setObjectLabel(''); }} className="text-slate-500 text-[8px] mt-1">clear</button>
                        </div>
                      ) : null}
                      {((role === 'subject' && !subjectId) || (role === 'predicate' && !predicateId) || (role === 'object' && !objectId)) && (
                        <button type="button" onClick={() => setNodeSearchOpen(role)} className="flex flex-col items-center gap-2 text-slate-400 hover:text-intuition-primary transition-colors group/btn">
                          <Search size={24} className="group-hover/btn:text-glow-blue" />
                          <span className="text-[9px] font-black uppercase text-intuition-primary/90 group-hover/btn:text-intuition-primary">Connect node</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {nodeSearchOpen && (
                  <div className="border-2 border-intuition-primary/20 bg-black/40 p-4 space-y-3">
                    <div className="flex gap-2">
                      <input
                        ref={nodeSearchInputRef}
                        value={nodeSearchQuery}
                        onChange={(e) => { setNodeSearchQuery(e.target.value); setNodeSearchError(null); }}
                        onKeyDown={(e) => e.key === 'Enter' && runNodeSearch()}
                        placeholder="Search by label or term id..."
                        className="flex-1 bg-black border border-white/10 py-2 px-3 text-sm text-white font-mono focus:border-intuition-primary outline-none placeholder-slate-600"
                        autoComplete="off"
                        aria-label="Search atoms by label or term id"
                      />
                      <button type="button" onClick={runNodeSearch} disabled={nodeSearching} className="px-4 py-2 bg-intuition-primary text-black font-black text-[10px] uppercase disabled:opacity-60">
                        {nodeSearching ? <Loader2 size={14} className="animate-spin inline" /> : 'Search'}
                      </button>
                      <button type="button" onClick={() => { setNodeSearchOpen(null); setNodeSearchResults([]); setNodeSearchError(null); }} className="px-4 py-2 border border-white/20 text-slate-500 text-[10px]">Cancel</button>
                    </div>
                    {nodeSearchError && <p className="text-[10px] text-red-400">{nodeSearchError}</p>}
                    <div className="max-h-40 overflow-auto space-y-1">
                      {nodeSearching && <p className="text-[10px] text-slate-500 py-2">Searching the network…</p>}
                      {!nodeSearching && nodeSearchResults.map((a: any) => (
                        <button key={a.id} type="button" onClick={() => pickNode(nodeSearchOpen!, a.id, a.label)} className="w-full text-left py-2 px-3 bg-white/5 hover:bg-white/10 text-[10px] font-mono flex justify-between">
                          <span className="truncate">{a.label || a.id}</span>
                          <span className="text-slate-500 truncate ml-2 max-w-[80px]">{String(a.id).slice(0, 10)}…</span>
                        </button>
                      ))}
                    </div>
                    {!nodeSearching && nodeSearchResults.length === 0 && nodeSearchQuery.trim() && (
                      <p className="text-[10px] text-slate-500">No atoms found for “{nodeSearchQuery.trim()}”.</p>
                    )}
                    <div className="pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setReturnToSynapseSlot(nodeSearchOpen);
                          setNodeAlias(nodeSearchQuery.trim() || 'New atom');
                          setNodeSearchOpen(null);
                          setNodeSearchQuery('');
                          setNodeSearchResults([]);
                          setNodeSearchError(null);
                          setView('construct_atom');
                        }}
                        className="w-full py-2 px-3 border border-dashed border-intuition-primary/50 text-intuition-primary hover:bg-intuition-primary/10 text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        Create an atom (not on the network?)
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between sm:justify-start gap-4 pt-2 border-t border-white/10">
                  <div className="flex items-baseline gap-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] shrink-0">Initial deposit</label>
                    <input type="number" min="0" step="0.01" value={synapseDeposit} onChange={(e) => setSynapseDeposit(e.target.value)} className="w-24 bg-black border-2 border-white/15 py-2.5 px-3 text-sm text-white font-mono outline-none focus:border-intuition-primary" />
                    <span className="ml-1"><CurrencySymbol size="md" className="text-intuition-primary/90" /></span>
                  </div>
                  <button type="button" onClick={() => { playClick(); setView('claim_review'); }} disabled={!subjectId || !predicateId || !objectId} className="py-3 px-8 bg-[#a855f7] border-2 border-[#a855f7] text-white font-black text-[10px] uppercase tracking-widest clip-path-slant disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white hover:text-[#a855f7] hover:shadow-[0_0_32px_rgba(168,85,247,0.5)] transition-all shadow-[0_0_20px_rgba(168,85,247,0.25)]">
                    Review
                  </button>
                </div>
              </div>
              {footer}
            </>
            </div>
          )}

          {/* ----- CLAIM REVIEW & CONFIRM ----- */}
          {view === 'claim_review' && (
            <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              <div className="flex items-center justify-between w-full mb-8">
                <button type="button" onClick={() => { playClick(); setView('claim'); }} onMouseEnter={playHover} className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-slate-600 text-slate-300 hover:border-[#a855f7] hover:text-[#a855f7] font-black text-[10px] uppercase tracking-widest clip-path-slant transition-all duration-200 z-10">
                  <ArrowLeft size={14} /> Back
                </button>
                <span className="text-[9px] text-[#a855f7] uppercase tracking-[0.4em] font-black">CREATE CLAIM</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white font-display tracking-tighter uppercase text-center mb-8">Review & confirm</h1>
              <div className="w-full max-w-md mx-auto space-y-5 text-left">
                <div className="border-2 border-[#a855f7]/50 p-4 bg-[#050505] shadow-[0_0_24px_rgba(168,85,247,0.2)]">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Claim (triple)</div>
                  <div className="text-white font-mono text-[10px]">[{subjectLabel || subjectId?.slice(0, 10)}…] [{predicateLabel || predicateId?.slice(0, 10)}…] [{objectLabel || objectId?.slice(0, 10)}…]</div>
                  <div className="text-[10px] text-slate-400 mt-1 inline-flex items-baseline gap-1">Initial deposit: {synapseDeposit || '0'} <CurrencySymbol size="sm" /></div>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Total cost</span>
                  <span className="text-white font-mono inline-flex items-baseline gap-1">{synapseDeposit || '0'} <CurrencySymbol size="md" className="text-white/90" /></span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Available balance</span>
                  <span className="text-white font-mono inline-flex items-baseline gap-1">{walletBalance || '—'} <CurrencySymbol size="md" className="text-white/90" /></span>
                </div>
                <div className="flex items-start gap-2 p-3 bg-white/5 border-2 border-white/10">
                  <Info size={14} className="text-[#a855f7] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400">You will be prompted to approve the transaction in your wallet.</p>
                </div>
                {claimReviewApproved === false && (
                  <div className="p-3 border border-amber-500/40 bg-amber-500/10 rounded shadow-neon-gold">
                    <p className="text-[10px] text-slate-300 mb-2">Triple creation requires a one-time protocol approval. Click below, sign in your wallet, then Submit.</p>
                    <button
                      type="button"
                      onClick={async () => {
                        playClick();
                        try {
                          const account = await getConnectedAccount();
                          if (!account) { await connectWallet(); return; }
                          setEnablingProtocol(true);
                          await grantProxyApproval(account);
                          setClaimReviewApproved(true);
                          toast.success('Protocol enabled. You can now Submit.');
                        } catch (e: any) {
                          toast.error(e?.message || 'Enable failed');
                        } finally {
                          setEnablingProtocol(false);
                        }
                      }}
                      disabled={enablingProtocol}
                      className="w-full py-2 px-4 bg-amber-500/20 border border-amber-500/60 text-amber-200 font-black text-[10px] uppercase tracking-widest disabled:opacity-60 hover:shadow-neon-gold transition-all"
                    >
                      {enablingProtocol ? <><Loader2 size={12} className="animate-spin inline mr-2" /> Enabling…</> : 'Enable protocol'}
                    </button>
                  </div>
                )}
                {claimReviewApproved === true && (
                  <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest text-glow-gold">Protocol enabled. You can submit.</p>
                )}
                <div className="flex gap-4">
                  <button type="button" onClick={() => setView('claim')} className="flex-1 py-3 border border-intuition-primary/50 text-intuition-primary font-black text-[10px] uppercase tracking-widest clip-path-slant hover:shadow-neon-blue transition-all">
                    Back
                  </button>
                  <button type="button" onClick={handleSubmitClaimFromReview} disabled={creatingSynapse} className="flex-1 py-3 bg-[#a855f7] border-2 border-[#a855f7] text-white font-black text-[10px] uppercase tracking-widest clip-path-slant disabled:opacity-60 hover:bg-white hover:text-[#a855f7] hover:shadow-[0_0_32px_rgba(168,85,247,0.5)] transition-all shadow-[0_0_20px_rgba(168,85,247,0.25)]">
                    {creatingSynapse ? <><Loader2 size={14} className="animate-spin inline mr-2" /> Submitting…</> : 'Submit transactions'}
                  </button>
                </div>
              </div>
              {footer}
            </>
            </div>
          )}

          {/* ----- ESTABLISH_SYNAPSE (manual / legacy) ----- */}
          {view === 'establish_synapse' && (
            <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300 fill-mode-both">
            <>
              <button onClick={() => setView('manual_pathway')} className="absolute top-6 left-6 inline-flex items-center gap-2 px-4 py-2.5 border-2 border-slate-700 text-slate-300 hover:border-intuition-primary hover:text-intuition-primary font-black text-[10px] uppercase tracking-widest clip-path-slant transition-all duration-200 z-10">
                <ArrowLeft size={14} /> BACK
              </button>
              <div className="text-[9px] text-slate-600 uppercase tracking-[0.4em] mb-2">INGRESS_MODULE // S05_ARES</div>
              <h1 className="text-2xl md:text-4xl font-black text-white font-display tracking-tighter uppercase text-center mb-8">ESTABLISH_SYNAPSE</h1>
              <div className="w-full max-w-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['subject', 'predicate', 'object'] as const).map((role) => (
                    <div key={role} className="border-2 border-dashed border-white/20 p-6 flex flex-col items-center justify-center min-h-[120px] relative">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{role === 'subject' ? 'SUBJECT_NODE' : role === 'predicate' ? 'PREDICATE_NODE' : 'OBJECT_NODE'}</div>
                      {role === 'subject' && subjectId ? (
                        <div className="text-center">
                          <div className="text-intuition-primary font-mono text-[10px] truncate max-w-full" title={subjectId}>{subjectLabel || subjectId.slice(0, 12)}...</div>
                          <button type="button" onClick={() => { setSubjectId(''); setSubjectLabel(''); }} className="text-slate-500 text-[8px] mt-1">clear</button>
                        </div>
                      ) : null}
                      {role === 'predicate' && predicateId ? (
                        <div className="text-center">
                          <div className="text-intuition-primary font-mono text-[10px] truncate max-w-full">{predicateLabel || predicateId.slice(0, 12)}...</div>
                          <button type="button" onClick={() => { setPredicateId(''); setPredicateLabel(''); }} className="text-slate-500 text-[8px] mt-1">clear</button>
                        </div>
                      ) : null}
                      {role === 'object' && objectId ? (
                        <div className="text-center">
                          <div className="text-intuition-primary font-mono text-[10px] truncate max-w-full">{objectLabel || objectId.slice(0, 12)}...</div>
                          <button type="button" onClick={() => { setObjectId(''); setObjectLabel(''); }} className="text-slate-500 text-[8px] mt-1">clear</button>
                        </div>
                      ) : null}
                      {((role === 'subject' && !subjectId) || (role === 'predicate' && !predicateId) || (role === 'object' && !objectId)) && (
                        <button onClick={() => setNodeSearchOpen(role)} className="flex flex-col items-center gap-2 text-slate-500 hover:text-intuition-primary transition-colors">
                          <Search size={24} />
                          <span className="text-[9px] font-black uppercase">CONNECT_NODE</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {nodeSearchOpen && (
                  <div className="border border-white/20 p-4 space-y-3">
                    <div className="flex gap-2">
                      <input
                        ref={nodeSearchInputRef}
                        value={nodeSearchQuery}
                        onChange={(e) => { setNodeSearchQuery(e.target.value); setNodeSearchError(null); }}
                        onKeyDown={(e) => e.key === 'Enter' && runNodeSearch()}
                        placeholder="Search by label or term id..."
                        className="flex-1 bg-black border border-white/10 py-2 px-3 text-sm text-white font-mono focus:border-intuition-primary outline-none placeholder-slate-600"
                        autoComplete="off"
                        aria-label="Search atoms by label or term id"
                      />
                      <button type="button" onClick={runNodeSearch} disabled={nodeSearching} className="px-4 py-2 bg-intuition-primary text-black font-black text-[10px] uppercase disabled:opacity-60">
                        {nodeSearching ? <Loader2 size={14} className="animate-spin inline" /> : 'Search'}
                      </button>
                      <button type="button" onClick={() => { setNodeSearchOpen(null); setNodeSearchResults([]); setNodeSearchError(null); }} className="px-4 py-2 border border-white/20 text-slate-500 text-[10px]">Cancel</button>
                    </div>
                    {nodeSearchError && <p className="text-[10px] text-red-400">{nodeSearchError}</p>}
                    <div className="max-h-40 overflow-auto space-y-1">
                      {nodeSearching && <p className="text-[10px] text-slate-500 py-2">Searching the network…</p>}
                      {!nodeSearching && nodeSearchResults.map((a: any) => (
                        <button key={a.id} type="button" onClick={() => pickNode(nodeSearchOpen!, a.id, a.label)} className="w-full text-left py-2 px-3 bg-white/5 hover:bg-white/10 text-[10px] font-mono flex justify-between">
                          <span className="truncate">{a.label || a.id}</span>
                          <span className="text-slate-500 truncate ml-2 max-w-[80px]">{String(a.id).slice(0, 10)}…</span>
                        </button>
                      ))}
                    </div>
                    {!nodeSearching && nodeSearchResults.length === 0 && nodeSearchQuery.trim() && (
                      <p className="text-[10px] text-slate-500">No atoms found for “{nodeSearchQuery.trim()}”.</p>
                    )}
                    <div className="pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          setReturnToSynapseSlot(nodeSearchOpen);
                          setNodeAlias(nodeSearchQuery.trim() || 'New atom');
                          setNodeSearchOpen(null);
                          setNodeSearchQuery('');
                          setNodeSearchResults([]);
                          setNodeSearchError(null);
                          setView('construct_atom');
                        }}
                        className="w-full py-2 px-3 border border-dashed border-intuition-primary/50 text-intuition-primary hover:bg-intuition-primary/10 text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        Create an atom (not on the network?)
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1 block">INITIAL_LIQUIDITY_INGRESS</label>
                    <input type="number" min="0" step="0.01" value={synapseDeposit} onChange={(e) => setSynapseDeposit(e.target.value)} className="w-28 bg-black border border-white/10 py-2 px-3 text-sm text-white font-mono outline-none" />
                  </div>
                  <div className="text-[10px] text-slate-500 inline-flex items-baseline gap-1">MIN_DEPOSIT: 0.1 <CurrencySymbol size="sm" /></div>
                  <button onClick={handleEstablishSynapse} disabled={creatingSynapse || !subjectId || !predicateId || !objectId} className="py-3 px-8 bg-[#a855f7] hover:bg-white text-white hover:text-black font-black text-[10px] uppercase tracking-widest clip-path-slant disabled:opacity-50 disabled:cursor-not-allowed">
                    {creatingSynapse ? <Loader2 size={14} className="animate-spin inline mr-2" /> : null} ESTABLISH_SYNAPSE_LINK
                  </button>
                </div>
              </div>
              {footer}
            </>
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center justify-center gap-3 text-slate-700 text-[8px] font-black uppercase tracking-[0.4em] opacity-40">
          <Terminal size={10} /> HANDSHAKE_SECURE // V1.5.0 — INTURANK_PROTOCOL_ACTIVE
        </div>
      </div>
    </div>
  );
};

export default CreateSignal;
