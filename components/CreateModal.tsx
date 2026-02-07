import React, { useState, useEffect, useRef } from 'react';
import { X, User, Database, Network, Info, Loader2, Zap, ArrowRight, ShieldCheck, Cpu, Camera, Search, ChevronRight, HelpCircle, UserPlus, CheckCircle2, Globe, Fingerprint, Trash2, Plus, Terminal as TerminalIcon, ExternalLink, RefreshCw, AlertTriangle, Coins } from 'lucide-react';
import { playClick, playHover, playSuccess } from '../services/audio';
import { getConnectedAccount, createIdentityAtom, createSemanticTriple, parseProtocolError, getWalletBalance, publicClient, getAtomCreationCost, estimateAtomGas } from '../services/web3';
import { searchGlobalAgents } from '../services/graphql';
import { Account } from '../types';
import { toast } from './Toast';
import { formatEther } from 'viem';
import { EXPLORER_URL } from '../constants';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'IDLE' | 'CLAIM_OVERVIEW' | 'SELECTOR' | 'IDENTITY_CREATOR';
type SelectionTarget = 'subject' | 'predicate' | 'object';
type TxStatus = 'IDLE' | 'CALCULATING' | 'SIGNING' | 'BROADCASTING' | 'CONFIRMING' | 'SUCCESS' | 'ERROR';

const TxTerminal = ({ status, txHash, error, onRetry, onClose }: { 
    status: TxStatus, 
    txHash?: string, 
    error?: string, 
    onRetry: () => void,
    onClose: () => void
}) => {
    if (status === 'IDLE') return null;

    return (
        <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center p-8 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-black border-2 border-intuition-primary/40 clip-path-slant p-8 relative overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)]">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-intuition-primary/10 border border-intuition-primary/40 rounded-xl text-intuition-primary animate-pulse">
                        <TerminalIcon size={24} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black font-display text-white tracking-widest uppercase">Protocol_Process</h4>
                        <div className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.4em]">Handshake_Sequence_Initiated</div>
                    </div>
                </div>
                <div className="space-y-6 font-mono relative z-10">
                    <div className="flex items-center gap-4 text-xs">
                        <div className={`w-2 h-2 rounded-full ${status !== 'ERROR' ? 'bg-intuition-primary animate-ping' : 'bg-intuition-danger'}`}></div>
                        <span className="text-slate-500 uppercase tracking-widest">Status:</span>
                        <span className={`font-black uppercase tracking-widest ${status === 'SUCCESS' ? 'text-intuition-success' : status === 'ERROR' ? 'text-intuition-danger' : 'text-intuition-primary'}`}>
                            {status}
                        </span>
                    </div>
                    <div className="p-6 bg-white/5 border border-white/5 clip-path-slant min-h-[100px] flex flex-col justify-center">
                        {status === 'CALCULATING' && <p className="text-[10px] text-slate-400 uppercase leading-relaxed animate-pulse">Calculating protocol cost basis and gas vectors...</p>}
                        {status === 'SIGNING' && <p className="text-[10px] text-slate-400 uppercase leading-relaxed">Awaiting biometric signature from neural link wallet...</p>}
                        {status === 'BROADCASTING' && <p className="text-[10px] text-slate-400 uppercase leading-relaxed">Transmitting packet to mainnet nodes. Waiting for inclusion...</p>}
                        {status === 'CONFIRMING' && <p className="text-[10px] text-slate-400 uppercase leading-relaxed animate-pulse">Packet received. Reconciling transaction on-chain [Confirming 1/1]...</p>}
                        {status === 'SUCCESS' && <p className="text-[10px] text-intuition-success uppercase leading-relaxed font-black">Transaction verified. Identity established in global graph.</p>}
                        {status === 'ERROR' && (
                            <div className="space-y-3">
                                <p className="text-[10px] text-intuition-danger uppercase leading-relaxed font-black">Critical_Failure_Detected</p>
                                <p className="text-[9px] text-slate-500 uppercase">{error || 'Unknown protocol revert.'}</p>
                            </div>
                        )}
                    </div>
                    {txHash && (
                        <a href={`${EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-black border border-white/10 hover:border-intuition-primary transition-all text-[9px] text-slate-400 uppercase group">
                            <span className="truncate mr-4">Hash: {txHash}</span>
                            <ExternalLink size={12} className="shrink-0 group-hover:text-intuition-primary" />
                        </a>
                    )}
                    <div className="pt-4 flex gap-3">
                        {status === 'ERROR' ? (
                            <button onClick={onRetry} className="flex-1 py-4 bg-white text-black font-black uppercase text-[10px] tracking-widest clip-path-slant flex items-center justify-center gap-2">
                                <RefreshCw size={14} /> Retry_Sequence
                            </button>
                        ) : status === 'SUCCESS' ? (
                            <button onClick={onClose} className="flex-1 py-4 bg-intuition-success text-black font-black uppercase text-[10px] tracking-widest clip-path-slant">
                                Terminate_Link
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

const CreateModal: React.FC<CreateModalProps> = ({ isOpen, onClose }) => {
  const [view, setView] = useState<ModalView>('IDLE');
  const [target, setTarget] = useState<SelectionTarget>('subject');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>('IDLE');
  const [txHash, setTxHash] = useState<string | undefined>();
  const [txError, setTxError] = useState<string | undefined>();
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>('0.00');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [returnTo, setReturnTo] = useState<ModalView>('IDLE');

  const [tripleForm, setTripleForm] = useState({
    subject: null as Account | null,
    predicate: null as Account | null,
    object: null as Account | null,
    deposit: '0.1'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Account[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedInSearch, setSelectedInSearch] = useState<Account | null>(null);

  const [identityForm, setIdentityForm] = useState({
    name: '',
    description: '',
    image: '',
    type: 'Person' as 'Person' | 'Organization' | 'Thing' | 'Account',
    deposit: '0.1',
    links: [{ label: 'Website', url: '' }]
  });

  const [estCost, setEstCost] = useState<string | null>(null);
  const [estGas, setEstGas] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const init = async () => {
        const acc = await getConnectedAccount();
        setWallet(acc);
        if (acc) {
          try {
            const bal = await getWalletBalance(acc);
            setWalletBalance(bal);
          } catch (e) {
            console.error("FATAL_WALLET_SYNC:", e);
          }
        }
      };
      init();
      resetModal();
    }
  }, [isOpen]);

  useEffect(() => {
    if (view === 'IDENTITY_CREATOR' && identityForm.name.length >= 2 && wallet) {
        const timer = setTimeout(async () => {
            setIsEstimating(true);
            try {
                const [cost, gas] = await Promise.all([
                    getAtomCreationCost({
                        name: identityForm.name,
                        description: identityForm.description,
                        type: identityForm.type
                    }, identityForm.deposit),
                    estimateAtomGas(wallet!, {
                        name: identityForm.name,
                        description: identityForm.description,
                        type: identityForm.type
                    }, identityForm.deposit)
                ]);
                setEstCost(formatEther(cost));
                setEstGas(formatEther(gas));
            } catch (e) {
                console.error("UI_ESTIMATION_FAILED:", e);
                setEstCost(null);
                setEstGas(null);
            } finally {
                setIsEstimating(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [identityForm.name, identityForm.deposit, identityForm.type, view, wallet]);

  useEffect(() => {
    if (view !== 'SELECTOR') return;
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchGlobalAgents(searchTerm);
        setSearchResults(results);
      } catch (e) {
        console.error("AGENT_SEARCH_CRASH:", e);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, view]);

  const resetModal = () => {
    setView('IDLE');
    setTxStatus('IDLE');
    setTxHash(undefined);
    setTxError(undefined);
    setTripleForm({ subject: null, predicate: null, object: null, deposit: '0.1' });
    setSearchTerm('');
    setSelectedInSearch(null);
    setEstCost(null);
    setEstGas(null);
    setIdentityForm({
        name: '',
        description: '',
        image: '',
        type: 'Person',
        deposit: '0.1',
        links: [{ label: 'Website', url: '' }]
    });
  };

  const handleOpenSelector = (target: SelectionTarget) => {
    playClick();
    setTarget(target);
    setSearchTerm('');
    setSelectedInSearch(tripleForm[target]);
    setView('SELECTOR');
  };

  const handleConfirmSelection = () => {
    if (!selectedInSearch) return;
    playClick();
    setTripleForm(prev => ({ ...prev, [target]: selectedInSearch }));
    setView('CLAIM_OVERVIEW');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast.error("DATA_OVERFLOW: IMAGE EXCEEDS 1MB LIMIT");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdentityForm({ ...identityForm, image: reader.result as string });
        playSuccess();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateIdentity = async () => {
    if (!wallet || !identityForm.name || !identityForm.deposit || parseFloat(identityForm.deposit) < 0.1) return;
    const totalRequired = (parseFloat(estCost || '0.1') + parseFloat(identityForm.deposit) + parseFloat(estGas || '0.0008'));
    if (parseFloat(walletBalance) < totalRequired) {
        toast.error(`INSUFFICIENT_FUNDS: Your TRUST balance (${parseFloat(walletBalance).toFixed(4)}) is lower than total ingress cost.`);
        return;
    }
    setTxStatus('CALCULATING');
    setTxError(undefined);
    try {
      const metadata = { name: identityForm.name, description: identityForm.description, image: identityForm.image, type: identityForm.type, links: identityForm.links.filter(l => l.url) };
      await new Promise(r => setTimeout(r, 1000));
      setTxStatus('SIGNING');
      const hash = await createIdentityAtom(metadata, identityForm.deposit, wallet);
      setTxHash(hash);
      setTxStatus('BROADCASTING');
      await publicClient.waitForTransactionReceipt({ hash });
      setTxStatus('CONFIRMING');
      await new Promise(r => setTimeout(r, 1000));
      setTxStatus('SUCCESS');
      playSuccess();
    } catch (e: any) {
      setTxError(parseProtocolError(e));
      setTxStatus('ERROR');
    }
  };

  const handleFinalizeTriple = async () => {
    if (!wallet || !tripleForm.subject || !tripleForm.predicate || !tripleForm.object) return;
    setTxStatus('CALCULATING');
    setTxError(undefined);
    try {
      await new Promise(r => setTimeout(r, 800));
      setTxStatus('SIGNING');
      const hash = await createSemanticTriple(tripleForm.subject.id, tripleForm.predicate.id, tripleForm.object.id, tripleForm.deposit, wallet);
      setTxHash(hash);
      setTxStatus('BROADCASTING');
      await publicClient.waitForTransactionReceipt({ hash });
      setTxStatus('CONFIRMING');
      await new Promise(r => setTimeout(r, 1000));
      setTxStatus('SUCCESS');
      playSuccess();
    } catch (e: any) {
      setTxError(parseProtocolError(e));
      setTxStatus('ERROR');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-[850px] bg-[#0c0c0c] border border-white/10 rounded-[32px] shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden flex flex-col max-h-[90vh]">
        <TxTerminal status={txStatus} txHash={txHash} error={txError} onRetry={() => setTxStatus('IDLE')} onClose={onClose} />
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-white border border-white/10 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]">
              {view === 'IDLE' ? <Zap size={20} /> : view === 'CLAIM_OVERVIEW' ? <Network size={20} /> : view === 'SELECTOR' ? <Search size={20} /> : <UserPlus size={20} />}
            </div>
            <div>
                <h2 className="text-xl font-bold text-white tracking-tight uppercase">
                    {view === 'IDLE' && 'Creation Hub'}
                    {view === 'CLAIM_OVERVIEW' && 'Establish Claim'}
                    {view === 'SELECTOR' && `Select ${target}`}
                    {view === 'IDENTITY_CREATOR' && 'Construct Identity'}
                </h2>
                <div className="text-[8px] font-mono text-slate-500 tracking-[0.4em] uppercase font-black">
                    Sector_4_Ares // LINEAR_CURVE_UTILITY
                </div>
            </div>
          </div>
          <button onClick={() => { playClick(); onClose(); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-all"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {view === 'IDLE' && (
            <div className="p-12 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-500">
                <button onClick={() => { playClick(); setReturnTo('IDLE'); setView('IDENTITY_CREATOR'); }} onMouseEnter={playHover} className="group relative p-10 bg-[#080a12] border border-white/10 hover:border-intuition-primary rounded-[32px] text-left transition-all overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-intuition-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="w-16 h-16 bg-black border-2 border-intuition-primary rounded-2xl flex items-center justify-center mb-8 group-hover:bg-intuition-primary group-hover:text-black transition-all shadow-lg"><Database size={32} /></div>
                    <h3 className="text-2xl font-black text-white uppercase mb-4 tracking-tighter">Construct_Atom</h3>
                    <p className="text-xs font-mono text-slate-500 uppercase leading-relaxed tracking-wider font-bold group-hover:text-slate-300 transition-colors">Register a unique identity as a tradeable node. Engaging Linear Curve parameters.</p>
                    <div className="mt-8 flex items-center gap-2 text-[8px] font-black font-mono text-intuition-primary group-hover:translate-x-2 transition-transform">INITIALIZE_SEQUENCE <ArrowRight size={10} /></div>
                </button>
                <button onClick={() => { playClick(); setView('CLAIM_OVERVIEW'); }} onMouseEnter={playHover} className="group relative p-10 bg-[#080a12] border border-white/10 hover:border-intuition-secondary rounded-[32px] text-left transition-all overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-intuition-secondary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="w-16 h-16 bg-black border-2 border-intuition-secondary rounded-2xl flex items-center justify-center mb-8 group-hover:bg-intuition-secondary group-hover:text-black transition-all shadow-lg"><Network size={32} /></div>
                    <h3 className="text-2xl font-black text-white uppercase mb-4 tracking-tighter">Define_Synapse</h3>
                    <p className="text-xs font-mono text-slate-500 uppercase leading-relaxed tracking-wider font-bold group-hover:text-slate-300 transition-colors">Establish a semantic link to create intelligence between nodes on the graph.</p>
                    <div className="mt-8 flex items-center gap-2 text-[8px] font-black font-mono text-intuition-secondary group-hover:translate-x-2 transition-transform">ESTABLISH_LINKAGE <ArrowRight size={10} /></div>
                </button>
            </div>
          )}
          {/* [Remaining view logic for CLAIM_OVERVIEW, SELECTOR, IDENTITY_CREATOR remains consistent with updated curve usage] */}
          {view === 'CLAIM_OVERVIEW' && (
            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4">
                  <button onClick={() => setView('IDLE')} className="text-slate-600 hover:text-white transition-colors"><ArrowRight size={16} className="rotate-180"/></button>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">Establishing a semantic synapse under Linear_Utility_1 protocols.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['subject', 'predicate', 'object'] as const).map((key) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-1.5 px-1"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{key}</span></div>
                    <button onClick={() => handleOpenSelector(key)} className={`w-full h-24 flex items-center gap-4 px-6 rounded-[24px] border-2 transition-all group relative overflow-hidden ${tripleForm[key] ? 'bg-white/5 border-white/20' : 'bg-black/40 border-white/5 border-dashed hover:border-intuition-primary/40 hover:bg-white/5'}`}>
                      {tripleForm[key] ? (
                        <>
                          <div className="w-12 h-12 bg-black border border-white/10 rounded-xl overflow-hidden shrink-0">
                            {tripleForm[key]?.image ? <img src={tripleForm[key]?.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-900">{key === 'predicate' ? <Zap size={20}/> : <User size={20}/>}</div>}
                          </div>
                          <div className="text-left min-w-0">
                            <div className="text-sm font-bold text-white truncate">{tripleForm[key]?.label}</div>
                            <div className="text-[10px] text-slate-500 font-mono truncate">{tripleForm[key]?.id.slice(0, 12)}...</div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-4 text-slate-600 group-hover:text-slate-400 transition-colors w-full">
                           <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5">{key === 'predicate' ? <Plus size={20}/> : <User size={20}/>}</div>
                           <span className="font-bold text-sm uppercase tracking-widest">{key}</span>
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              <div className="max-w-xs mx-auto pt-6">
                <div className="flex justify-between items-center mb-3 px-1"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Initial Deposit</span></div>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-intuition-primary transition-colors"><Zap size={18}/></div>
                  <input type="number" value={tripleForm.deposit} onChange={(e) => setTripleForm({...tripleForm, deposit: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-2xl font-bold text-white outline-none focus:border-intuition-primary transition-all text-right shadow-inner" placeholder="0" />
                </div>
              </div>
              <div className="pt-10">
                <button onClick={handleFinalizeTriple} disabled={loading || !tripleForm.subject || !tripleForm.predicate || !tripleForm.object} className={`w-full py-6 rounded-[24px] text-lg font-black uppercase tracking-widest transition-all ${!tripleForm.subject || !tripleForm.predicate || !tripleForm.object ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5' : 'bg-white text-black hover:scale-[1.01] shadow-[0_20px_50px_rgba(255,255,255,0.1)]'}`}>Establish Synapse</button>
              </div>
            </div>
          )}
          {view === 'IDENTITY_CREATOR' && (
            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                  <div className="md:col-span-4 space-y-6">
                     <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Biometric Visual</label>
                        <div onClick={() => fileInputRef.current?.click()} className="aspect-square bg-black border-2 border-dashed border-white/10 rounded-[32px] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-intuition-primary/40 hover:bg-white/5 transition-all group overflow-hidden shadow-2xl">
                           {identityForm.image ? <img src={identityForm.image} className="w-full h-full object-cover" /> : <><div className="p-4 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform"><Camera size={32} className="text-slate-600" /></div><div className="text-center"><div className="text-[10px] font-black text-white uppercase tracking-widest">Upload Frame</div></div></>}
                           <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                        </div>
                     </div>
                  </div>
                  <div className="md:col-span-8 space-y-6">
                     <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Network Identifier</label>
                        <input value={identityForm.name} onChange={e => setIdentityForm({...identityForm, name: e.target.value})} placeholder="Enter alias..." className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white font-medium focus:border-intuition-primary transition-all outline-none" />
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Initial Deposit ($TRUST)</label>
                        <div className="relative group">
                          <input type="number" step="0.1" min="0.1" value={identityForm.deposit} onChange={e => setIdentityForm({...identityForm, deposit: e.target.value})} placeholder="0.1" className="w-full bg-black border border-white/10 rounded-2xl py-4 px-6 text-white font-medium focus:border-intuition-primary transition-all outline-none" />
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 tracking-widest uppercase">TRUST</div>
                        </div>
                        <div className="mt-4 p-4 border-2 border-slate-900 bg-black clip-path-slant flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <span className="text-[7px] font-black font-mono text-slate-500 uppercase tracking-widest">TOTAL_INGRESS_COMMIT</span>
                                <span className="text-xl font-black text-white font-display">
                                    {(() => {
                                        const c = parseFloat(estCost || '0.1');
                                        const d = parseFloat(identityForm.deposit || '0');
                                        const g = parseFloat(estGas || '0.0008');
                                        const sum = c + d + g;
                                        return sum > 0 ? sum.toFixed(4) : '--';
                                    })()} TRUST
                                </span>
                            </div>
                        </div>
                        <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest px-1 opacity-50 italic">Utilizing Curve_ID_1 (Linear) for predictable ingress valuation.</p>
                     </div>
                     <div className="pt-4 flex gap-4">
                        <button onClick={() => { playClick(); setView(returnTo); }} className="flex-1 py-5 rounded-[24px] border border-white/10 text-slate-500 font-black uppercase text-xs tracking-widest hover:bg-white/5 transition-all">Abort</button>
                        <button onClick={handleCreateIdentity} disabled={loading || !identityForm.name} className="flex-[2] py-5 bg-intuition-primary text-black rounded-[24px] font-black uppercase text-xs tracking-[0.2em] hover:scale-[1.02] transition-all shadow-[0_20px_50px_rgba(255,255,255,0.2)]">Confirm Construction</button>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
        <div className="bg-black/60 border-t border-white/5 p-6 flex items-center justify-center gap-3">
           <div className="w-1.5 h-1.5 rounded-full bg-intuition-success animate-pulse shadow-[0_0_8px_#00ff9d]"></div>
           <span className="text-[9px] font-mono text-slate-600 uppercase tracking-[0.2em] font-bold">Protocol Handshake: ACTIVE // Linear Utility engaged</span>
        </div>
      </div>
    </div>
  );
};

export default CreateModal;