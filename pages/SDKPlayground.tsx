import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ArrowRight, Loader2, Cpu, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Hex } from 'viem';
import { createStringAtom, fetchAtomDetails, searchIntuition } from '../services/intuitionSdk';
import { searchGlobalAgents } from '../services/graphql';
import { getConnectedAccount, connectWallet } from '../services/web3';
import { toast } from '../components/Toast';
import { playClick, playHover } from '../services/audio';

interface AtomDetails {
  id?: string;
  term_id?: string;
  label?: string;
  data?: string;
  type?: string;
  [key: string]: any;
}

const SDKPlayground: React.FC = () => {
  const { address: wagmiAddress } = useAccount();
  const [wallet, setWallet] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [deposit, setDeposit] = useState('0.01');
  const [creating, setCreating] = useState(false);
  const [lastAtomId, setLastAtomId] = useState<Hex | null>(null);
  const [lastAtomDetails, setLastAtomDetails] = useState<AtomDetails | null>(null);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  // Sync from wagmi so we show connected state when user connects in header
  useEffect(() => {
    setWallet(wagmiAddress ?? null);
  }, [wagmiAddress]);

  // Fallback: poll getConnectedAccount once on mount (e.g. wagmi not yet synced)
  useEffect(() => {
    if (wagmiAddress) return;
    getConnectedAccount().then(setWallet).catch(() => setWallet(null));
  }, [wagmiAddress]);

  const ensureWallet = async () => {
    if (wallet) return wallet;
    connectWallet(); // opens RainbowKit modal
    const addr = await getConnectedAccount();
    if (!addr) throw new Error('Wallet connection required');
    setWallet(addr);
    return addr;
  };

  const handleCreateAtom = async () => {
    playClick();
    if (!text.trim()) {
      toast.error('ENTER_VALID_STRING_PAYLOAD');
      return;
    }
    try {
      await ensureWallet();
      setCreating(true);
      setLastAtomDetails(null);

      const atom = await createStringAtom(text.trim(), deposit || undefined);
      const termId = atom.state.termId as Hex;

      setLastAtomId(termId);
      toast.success('SDK_ATOM_CREATED');

      try {
        const details = await fetchAtomDetails(termId);
        setLastAtomDetails(details as AtomDetails);
      } catch {
        // Details are optional; ignore failures here
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      toast.error(msg.slice(0, 160));
    } finally {
      setCreating(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchResults(null);
    try {
      let res = await searchIntuition(q, {
        atomsLimit: 10,
        accountsLimit: 6,
        triplesLimit: 6,
        collectionsLimit: 4,
      });
      if (res && typeof res === 'object') {
        setSearchResults([res]);
      } else {
        const fallback = await searchGlobalAgents(q);
        if (fallback.length > 0) {
          setSearchResults([{ atoms: fallback.map((a: any) => ({ term_id: a.id, label: a.label, id: a.id })), accounts: [], triples: [], collections: [] }]);
        } else {
          setSearchResults([]);
        }
      }
    } catch (err: any) {
      try {
        const fallback = await searchGlobalAgents(q);
        if (fallback.length > 0) {
          setSearchResults([{ atoms: fallback.map((a: any) => ({ term_id: a.id, label: a.label, id: a.id })), accounts: [], triples: [], collections: [] }]);
        } else {
          setSearchResults([]);
        }
      } catch {
        toast.error((err?.message || 'SEARCH_FAILED').slice(0, 120));
        setSearchResults([]);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-12 pb-24">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-black border-2 border-intuition-primary flex items-center justify-center clip-path-slant shadow-[0_0_25px_rgba(0,243,255,0.4)]">
            <Cpu size={22} className="text-intuition-primary" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-intuition-primary/70">
              SDK_LAB // INTUITION_STACK
            </div>
            <h1 className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight uppercase">
              Intuition SDK Playground
            </h1>
          </div>
        </div>

        {!wallet && (
          <div
            className="flex items-center gap-4 p-4 border border-yellow-500/40 bg-yellow-500/5 clip-path-slant text-yellow-200 text-[11px] font-mono uppercase tracking-[0.16em]"
          >
            <AlertTriangle size={16} />
            <span>Connect your wallet from the top nav before sending on‑chain SDK transactions.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div
            className="bg-black border border-white/10 p-6 clip-path-slant shadow-2xl"
            onMouseEnter={playHover}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em]">
                createAtomFromString
              </div>
              <CheckCircle2
                size={16}
                className="text-intuition-primary/70"
              />
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-1 block">
                  String Payload
                </label>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-none py-3 px-3 text-sm text-white font-mono focus:border-intuition-primary outline-none"
                  placeholder='"TypeScript", "Vitalik Buterin", "DeFi"...'
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-1 block">
                  Optional Deposit (₸)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="w-40 bg-black border border-white/10 rounded-none py-2 px-3 text-sm text-white font-mono focus:border-intuition-primary outline-none"
                />
              </div>

              <button
                onClick={handleCreateAtom}
                disabled={creating}
                className="mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 bg-intuition-primary text-black text-[11px] font-mono font-black uppercase tracking-[0.2em] clip-path-slant shadow-[0_0_40px_rgba(0,243,255,0.5)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Broadcasting...
                  </>
                ) : (
                  <>
                    Create Atom (SDK)
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              {lastAtomId && (
                <div className="mt-6 space-y-2 text-[11px] font-mono">
                  <div className="text-slate-500 uppercase tracking-[0.2em]">
                    Last Atom TermId
                  </div>
                  <div className="break-all text-intuition-primary">
                    {lastAtomId}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-black border border-white/10 p-6 clip-path-slant h-[230px] overflow-auto custom-scrollbar">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-3">
                Atom Details (getAtomDetails)
              </div>
              {lastAtomDetails ? (
                <pre className="text-[10px] text-slate-200 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(lastAtomDetails, null, 2)}
                </pre>
              ) : (
                <div className="text-[11px] text-slate-600 font-mono">
                  Create an atom to inspect its resolved metadata here.
                </div>
              )}
            </div>

            <div
              className="bg-black border border-white/10 p-6 clip-path-slant"
              onMouseEnter={playHover}
            >
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Search size={16} className="text-intuition-primary" />
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em]">
                    globalSearch
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 bg-black border border-white/10 rounded-none py-2 px-3 text-sm text-white font-mono focus:border-intuition-primary outline-none"
                    placeholder="Search atoms, accounts, triples..."
                  />
                  <button
                    type="submit"
                    disabled={searching}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-black text-[11px] font-mono font-black uppercase tracking-[0.2em] clip-path-slant disabled:opacity-60"
                  >
                    {searching ? <Loader2 size={14} className="animate-spin" /> : 'Query'}
                  </button>
                </div>
              </form>

              <div className="mt-4 max-h-56 overflow-auto custom-scrollbar text-[10px] font-mono text-slate-200 space-y-3">
                {searchResults === null && !searching && (
                  <div className="text-slate-600">
                    Results will appear here using the Intuition SDK’s unified search.
                  </div>
                )}
                {Array.isArray(searchResults) && searchResults.length === 0 && !searching && (
                  <div className="text-slate-600">No matches.</div>
                )}
                {Array.isArray(searchResults) &&
                  searchResults.map((block, i) => {
                    const atoms = block?.atoms ?? [];
                    const accounts = block?.accounts ?? [];
                    const triples = block?.triples ?? [];
                    const hasAny = atoms.length > 0 || accounts.length > 0 || triples.length > 0;
                    if (!hasAny) return <div key={i} className="text-slate-600">No matches.</div>;
                    return (
                      <div key={i} className="space-y-3">
                        {atoms.length > 0 && (
                          <div>
                            <div className="text-[9px] text-intuition-primary uppercase tracking-[0.25em] mb-1">Atoms</div>
                            {atoms.slice(0, 6).map((a: any) => (
                              <div key={a.term_id || a.id} className="flex justify-between gap-2 py-0.5">
                                <span className="truncate max-w-[65%]">{a.label ?? a.data ?? (a.term_id || a.id || '').slice(0, 12) + '...'}</span>
                                <Link to={`/markets/${a.term_id || a.id}`} className="truncate text-intuition-primary hover:underline max-w-[35%]" title={a.term_id || a.id}>{(a.term_id || a.id || '').slice(0, 10)}...</Link>
                              </div>
                            ))}
                          </div>
                        )}
                        {accounts.length > 0 && (
                          <div>
                            <div className="text-[9px] text-amber-400 uppercase tracking-[0.25em] mb-1">Accounts</div>
                            {accounts.slice(0, 4).map((acc: any) => (
                              <div key={acc.id} className="flex justify-between gap-2 py-0.5">
                                <span className="truncate max-w-[65%]">{acc.label || acc.id}</span>
                                <Link to={`/profile/${acc.id}`} className="truncate text-amber-400 hover:underline max-w-[35%]">{acc.id.slice(0, 10)}...</Link>
                              </div>
                            ))}
                          </div>
                        )}
                        {triples.length > 0 && (
                          <div>
                            <div className="text-[9px] text-purple-400 uppercase tracking-[0.25em] mb-1">Triples</div>
                            {triples.slice(0, 3).map((t: any, idx: number) => (
                              <div key={t.term_id || idx} className="py-0.5 truncate text-slate-400">
                                {[t.subject?.label, t.predicate?.label, t.object?.label].filter(Boolean).join(' → ') || t.term_id?.slice(0, 14) + '...'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SDKPlayground;

