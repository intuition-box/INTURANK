import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Share2, Layers, ArrowUpRight, CheckCircle, User, AlertCircle, RefreshCw } from 'lucide-react';
import { getAgentById, getAgentTriples } from '../services/graphql';
import { depositToVault, connectWallet, getProtocolConfig, getWalletBalance } from '../services/web3';
import { Account, Triple } from '../types';
import TransactionModal from '../components/TransactionModal';
import { playClick, playSuccess } from '../services/audio';
import { CURRENCY_SYMBOL } from '../constants';

const AgentProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Account | null>(null);
  const [triples, setTriples] = useState<Triple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [minDeposit, setMinDeposit] = useState('0.001');
  
  // Modal State
  const [txModal, setTxModal] = useState<{ isOpen: boolean; status: 'idle' | 'processing' | 'success' | 'error'; title: string; message: string; hash?: string }>({
    isOpen: false,
    status: 'idle',
    title: '',
    message: ''
  });

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      // Create a timeout promise to prevent infinite hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Network Timeout")), 10000)
      );

      try {
        const dataPromise = Promise.all([
          getAgentById(id),
          getAgentTriples(id),
          getProtocolConfig()
        ]);

        const [agentData, triplesData, config] = await Promise.race([dataPromise, timeoutPromise]) as any;
        
        if (!agentData) throw new Error("Agent Not Found");
        
        setAgent(agentData);
        setTriples(triplesData || []);
        setMinDeposit(config?.minDeposit || '0.001');
      } catch (err: any) {
        console.error("Profile Fetch Error:", err);
        setError("Unable to retrieve agent data. The network may be congested or the ID is invalid.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleStake = async () => {
    if (!stakeAmount || !id) return;

    if (parseFloat(stakeAmount) < parseFloat(minDeposit)) {
        setTxModal({ isOpen: true, status: 'error', title: 'INVALID AMOUNT', message: `The protocol requires a minimum deposit of ${minDeposit} ${CURRENCY_SYMBOL}.` });
        return;
    }
    
    playClick();
    setTxModal({ isOpen: true, status: 'processing', title: 'PROCESSING PURCHASE', message: 'Please confirm the transaction in your wallet...' });

    try {
      const wallet = await connectWallet();
      if (!wallet) {
        setTxModal({ isOpen: true, status: 'error', title: 'WALLET ERROR', message: 'Please connect your wallet first.' });
        return;
      }

      // Pre-check balance
      const balance = await getWalletBalance(wallet);
      if (parseFloat(stakeAmount) >= parseFloat(balance)) {
         setTxModal({ isOpen: true, status: 'error', title: 'INSUFFICIENT FUNDS', message: `You do not have enough ${CURRENCY_SYMBOL} to cover the deposit plus gas fees.` });
         return;
      }
      
      const curveId = agent?.curveId ? Number(agent.curveId) : 0;
      const { hash } = await depositToVault(stakeAmount, id, wallet, curveId);
      playSuccess();
      
      setTxModal({ 
        isOpen: true, 
        status: 'success', 
        title: 'PURCHASE SUCCESSFUL', 
        message: 'You have successfully acquired shares.',
        hash: hash
      });
      setStakeAmount('');
    } catch (e: any) {
      console.error(e);
      let msg = 'Transaction failed.';
      if (e.message?.includes('MultiVault_DepositBelowMinimumDeposit')) msg = `Deposit amount too low. Minimum is ${minDeposit} ${CURRENCY_SYMBOL}.`;
      else if (e.message?.includes('MultiVault_InsufficientBalance') || e.message?.includes('InsufficientBalance')) msg = `Insufficient balance to cover trade + gas.`;
      
      setTxModal({ isOpen: true, status: 'error', title: 'TRANSACTION FAILED', message: msg });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="text-intuition-primary animate-spin" size={32} />
        <div className="text-intuition-primary animate-pulse font-mono tracking-widest">LOADING GRAPH DATA...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <AlertCircle className="text-intuition-danger" size={48} />
        <div>
          <h2 className="text-xl font-bold text-white mb-2 font-display">CONNECTION INTERRUPTED</h2>
          <p className="text-slate-400 font-mono text-sm max-w-md">{error || "Agent not found."}</p>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2 border border-intuition-primary text-intuition-primary font-mono text-xs hover:bg-intuition-primary hover:text-black transition-colors"
        >
          RETRY UPLINK
        </button>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-10 pb-20">
      <TransactionModal 
         isOpen={txModal.isOpen} 
         status={txModal.status} 
         title={txModal.title} 
         message={txModal.message} 
         hash={txModal.hash} 
         onClose={() => setTxModal(prev => ({ ...prev, isOpen: false }))} 
      />

      {/* Header Profile */}
      <div className="glass-panel rounded-2xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <Shield size={200} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-slate-800 to-black border-2 border-intuition-primary flex items-center justify-center text-4xl font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] overflow-hidden">
            {agent.image ? (
                <img src={agent.image} alt={agent.label} className="w-full h-full rounded-full object-cover" />
            ) : (
                <User size={48} className="text-slate-400"/>
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl font-bold text-white mb-2">{agent.label || 'Anonymous Atom'}</h1>
            <div className="flex flex-col md:flex-row gap-4 text-sm text-slate-400 font-mono mb-6">
              <span className="bg-black/30 px-3 py-1 rounded border border-slate-800 break-all">ID: {agent.id}</span>
              {agent.block_number && (
                <span className="bg-black/30 px-3 py-1 rounded border border-slate-800">Block: {agent.block_number}</span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
               <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 flex items-center gap-2">
                 <CheckCircle size={16} /> {agent.type || 'Atom'}
               </div>
               <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 flex items-center gap-2">
                 <Layers size={16} /> {triples.length} Triples
               </div>
            </div>
          </div>

          {/* Betting Card */}
          <div className="w-full md:w-80 bg-black/40 rounded-xl p-6 border border-intuition-border backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Buy Shares</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Current Price</span>
                <span className="text-white">1.2 {CURRENCY_SYMBOL}</span>
              </div>
              <input 
                type="number" 
                placeholder={`Min: ${minDeposit}`}
                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-intuition-primary outline-none"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
              <button 
                onClick={handleStake}
                disabled={txModal.status === 'processing'}
                className="w-full py-3 bg-intuition-primary text-intuition-dark font-bold rounded hover:bg-cyan-400 transition-colors disabled:opacity-50"
              >
                {txModal.status === 'processing' ? 'Processing...' : 'Purchase Support'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Triples / Claims Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Share2 className="text-intuition-primary" />
            Semantic Claims (Triples)
          </h2>
          
          <div className="space-y-4">
            {triples.length === 0 ? (
              <div className="p-8 rounded-xl glass-panel text-center text-slate-500">
                No triples found for this agent.
              </div>
            ) : (
              triples.map((triple, index) => (
                <div key={index} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-intuition-border transition-all flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-3 text-sm font-mono">
                    <span className="px-3 py-1.5 rounded bg-slate-800/80 text-blue-300 border border-slate-700/50">
                      {triple.subject?.label || triple.subject?.term_id?.slice(0,6) || 'Unknown'}
                    </span>
                    <ArrowUpRight size={14} className="text-slate-600" />
                    <span className="px-3 py-1.5 rounded bg-slate-800/80 text-purple-300 border border-slate-700/50">
                      {triple.predicate?.label || triple.predicate?.term_id?.slice(0,6) || 'Unknown'}
                    </span>
                    <ArrowUpRight size={14} className="text-slate-600" />
                    <span className="px-3 py-1.5 rounded bg-slate-800/80 text-emerald-300 border border-slate-700/50">
                      {triple.object?.label || triple.object?.term_id?.slice(0,6) || 'Unknown'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 hidden sm:block">
                    Block {triple.block_number || '-'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stats Sidebar */}
        <div>
           <h2 className="text-2xl font-bold text-white mb-6">Market Stats</h2>
           <div className="glass-panel rounded-xl p-6 space-y-6">
              <div>
                <div className="text-sm text-slate-500 mb-1">Total Staked</div>
                <div className="text-2xl font-mono text-white">-- {CURRENCY_SYMBOL}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Stakers</div>
                <div className="text-2xl font-mono text-white">--</div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Market Cap</div>
                <div className="text-2xl font-mono text-white">--</div>
              </div>
              <p className="text-xs text-slate-500 italic">
                * Market data integration pending Indexer V2 updates.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AgentProfile;