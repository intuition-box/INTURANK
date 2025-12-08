import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Share2, Layers, ArrowUpRight, CheckCircle, User } from 'lucide-react';
import { getAgentById, getAgentTriples } from '../services/graphql';
import { depositToVault, connectWallet } from '../services/web3';
import { Account, Triple } from '../types';

const AgentProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Account | null>(null);
  const [triples, setTriples] = useState<Triple[]>([]);
  const [loading, setLoading] = useState(true);
  const [stakeAmount, setStakeAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        // Fetch in parallel
        const [agentData, triplesData] = await Promise.all([
          getAgentById(id),
          getAgentTriples(id)
        ]);
        setAgent(agentData);
        setTriples(triplesData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleStake = async () => {
    if (!stakeAmount || !id) return;
    setProcessing(true);
    try {
      const wallet = await connectWallet();
      if (!wallet) {
        alert("Please connect wallet first");
        return;
      }
      
      // termId is simply the ID for atoms
      // Updated to handle object return type
      const { hash } = await depositToVault(stakeAmount, id, wallet);
      alert(`Deposit submitted! TX: ${hash}`);
      setStakeAmount('');
    } catch (e) {
      console.error(e);
      alert("Transaction failed. See console.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="pt-20 text-center text-intuition-primary animate-pulse">Loading Graph Data...</div>;
  if (!agent) return <div className="pt-20 text-center text-red-500">Agent not found on network.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
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
                <span className="text-white">1.2 tTRUST</span>
              </div>
              <input 
                type="number" 
                placeholder="Amount (tTRUST)" 
                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-intuition-primary outline-none"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
              <button 
                onClick={handleStake}
                disabled={processing}
                className="w-full py-3 bg-intuition-primary text-intuition-dark font-bold rounded hover:bg-cyan-400 transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Purchase Support'}
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
                <div className="text-2xl font-mono text-white">-- tTRUST</div>
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