
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, MessageSquare, FileText, Shield, DollarSign, Zap, RefreshCw, Info, Download } from 'lucide-react';
import { getAgentById, getAgentTriples, getMarketActivity, getAgentOpinions } from '../services/graphql';
import { depositToVault, redeemFromVault, connectWallet, getConnectedAccount, getWalletBalance, getShareBalance, saveLocalTransaction, publishOpinion, getLocalTransactions } from '../services/web3';
import { Account, Triple, Transaction } from '../types';
import { parseEther, formatEther } from 'viem';
import { toast } from '../components/Toast';
import ShareCard from '../components/ShareCard';

const calculateTrustScore = (assetsWei: string, sharesWei: string) => {
  try {
    const assets = parseFloat(formatEther(BigInt(assetsWei || '0')));
    if (assets <= 0) return 15.0; 
    // Consistent balanced scale for reputation distribution
    const score = 15 + (Math.log10(assets + 1) / 5.8) * 85;
    return Math.min(99.0, Math.max(1.0, score));
  } catch {
    return 50.0;
  }
};

const generateHistory = (currentScore: number) => {
  const data: any[] = [];
  const now = new Date();
  let walker = isNaN(currentScore) ? 50 : currentScore;
  for (let i = 40; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 30 * 60 * 1000);
    if (i > 0 && Math.random() > 0.7) {
      const change = (Math.random() * 5) * (Math.random() > 0.5 ? 1 : -1);
      walker = Math.max(1, Math.min(99, walker + change));
    }
    if (i === 0) walker = currentScore;
    const trustVal = parseFloat(walker.toFixed(1));
    const priceVal = (trustVal / 100).toFixed(3);
    data.push({
      timestamp: time.getTime(),
      timeLabel: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateLabel: time.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      trust: trustVal,
      distrust: parseFloat((100 - trustVal).toFixed(1)),
      price: priceVal,
    });
  }
  return data;
};

const MarketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Account | null>(null);
  const [triples, setTriples] = useState<Triple[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeMode, setTradeMode] = useState<'Buy' | 'Sell'>('Buy');
  const [inputAmount, setInputAmount] = useState('');
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState('0.00');
  const [shareBalance, setShareBalance] = useState('0.00');
  const [activityLog, setActivityLog] = useState<Transaction[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'opinions' | 'activity' | 'rules'>('opinions');
  const [selectedSide, setSelectedSide] = useState<'TRUST' | 'DISTRUST'>('TRUST');
  const [userPosition, setUserPosition] = useState<{ shares: string; value: string; pnl: string; entry: string; exit: string } | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [hoverData, setHoverData] = useState<any>(null);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [agentData, triplesData, opinionsData, activityData] = await Promise.all([
        getAgentById(id),
        getAgentTriples(id),
        getAgentOpinions(id),
        getMarketActivity(id),
      ]);

      setAgent(agentData);
      setTriples(triplesData || []);
      setComments(opinionsData || []);
      setActivityLog(activityData || []);

      if (agentData) {
        const score = calculateTrustScore(agentData.totalAssets || '0', agentData.totalShares || '0');
        setChartData(generateHistory(score));
      }

      const acc = await getConnectedAccount();
      setWallet(acc);
      if (acc) await refreshBalances(acc);
    } catch (e) {
      console.error('MarketDetail fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshBalances = async (account: string) => {
    if (!id) return;
    try {
      const bal = await getWalletBalance(account);
      setWalletBalance(bal);
      const shares = await getShareBalance(account, id);
      setShareBalance(shares || '0');

      const sharesNum = parseFloat(shares || '0');
      
      // Calculate Entry Price (Weighted Average Cost Basis)
      let avgEntry = 0;
      let currentPrice = 0;
      
      if (agent) {
          const totalAgentAssets = parseFloat(formatEther(BigInt(agent.totalAssets || '0')));
          const totalAgentShares = parseFloat(formatEther(BigInt(agent.totalShares || '0')));
          currentPrice = totalAgentShares > 0 ? totalAgentAssets / totalAgentShares : 0;
      }

      if (sharesNum > 0 && currentPrice > 0) {
        const localHistory = getLocalTransactions(account);
        const deposits = localHistory.filter(tx => tx.type === 'DEPOSIT' && tx.vaultId?.toLowerCase() === id.toLowerCase());
        
        let totalCost = 0;
        let totalSharesBought = 0;
        
        deposits.forEach(d => {
            try {
                const cost = parseFloat(formatEther(BigInt(d.assets || '0')));
                const sh = parseFloat(formatEther(BigInt(d.shares || '0')));
                
                if (cost > 0 && sh > 0) {
                    totalCost += cost;
                    totalSharesBought += sh;
                }
            } catch {}
        });

        if (totalCost > 0 && totalSharesBought > 0) {
            avgEntry = totalCost / totalSharesBought;
        } else {
            // Fallback if no valid history: assume current price (0% PnL)
            avgEntry = currentPrice; 
        }

        const pnlPercent = avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;
        const currentValue = sharesNum * currentPrice;

        setUserPosition({
          shares: sharesNum.toFixed(4),
          value: currentValue.toFixed(4),
          pnl: pnlPercent.toFixed(2),
          entry: avgEntry.toFixed(4),
          exit: currentPrice.toFixed(4),
        });
      } else {
        setUserPosition(null);
      }
    } catch (e) {
      console.error('refreshBalances error:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleTrade = async () => {
    if (!wallet || !id || !inputAmount) {
      toast.error('MISSING_INPUT_OR_WALLET');
      return;
    }
    try {
      if (tradeMode === 'Buy') {
        const { hash, shares } = await depositToVault(inputAmount, id, wallet);
        saveLocalTransaction({
          id: hash,
          type: 'DEPOSIT',
          assets: parseEther(inputAmount).toString(),
          shares: shares.toString(),
          timestamp: Date.now(),
          vaultId: id,
          assetLabel: agent?.label,
        }, wallet);
        toast.success('ACQUIRED POSITION SUCCESSFULLY');
      } else {
        const { hash, assets } = await redeemFromVault(inputAmount, id, wallet);
        saveLocalTransaction({
          id: hash,
          type: 'REDEEM',
          assets: assets.toString(),
          shares: parseEther(inputAmount).toString(),
          timestamp: Date.now(),
          vaultId: id,
          assetLabel: agent?.label,
        }, wallet);
        toast.success('POSITION LIQUIDATED');
        setTimeout(async () => { await refreshBalances(wallet); setShowShareCard(true); }, 2000);
        return;
      }
      setInputAmount('');
      setTimeout(() => refreshBalances(wallet), 2000);
    } catch (e: any) {
      console.error('trade failed:', e);
      toast.error('TRANSACTION FAILED');
    }
  };

  const handleTransmit = async () => {
    if (!wallet || !id || !newComment) return;
    setIsTransmitting(true);
    try {
      toast.info("PREPARING ON-CHAIN OPINION...");
      const hash = await publishOpinion(newComment, id, selectedSide, wallet);
      if (hash) {
          toast.success(`OPINION ON-CHAIN: ${hash.slice(0, 10)}...`);
          setNewComment('');
          setTimeout(fetchData, 8000);
      }
    } catch (e) {
      console.error('transmit failed', e);
      toast.error('TRANSMISSION FAILED');
    } finally {
      setIsTransmitting(false);
    }
  };

  if (loading) return <div className="pt-40 text-center text-intuition-primary animate-pulse font-mono">DECODING SIGNAL...</div>;
  if (!agent) return <div className="pt-40 text-center text-intuition-danger font-mono">SIGNAL LOST.</div>;

  const currentData = chartData.length ? chartData[chartData.length - 1] : { trust: 50, distrust: 50, price: '0.000' };
  const displayTrust = hoverData ? hoverData.trust : currentData.trust;
  const displayDistrust = hoverData ? hoverData.distrust : currentData.distrust;
  const displayPrice = hoverData ? hoverData.price : currentData.price;
  const displayDate = hoverData ? `${hoverData.dateLabel}, ${hoverData.timeLabel}` : 'LIVE';

  const currentScore = calculateTrustScore(agent.totalAssets || '0', agent.totalShares || '0');
  const trustPct = currentScore.toFixed(1);
  const distrustPct = (100 - currentScore).toFixed(1);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center gap-4 p-6 bg-intuition-card border border-intuition-primary/30 clip-path-slant hover-glow relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-intuition-primary/5 to-transparent pointer-events-none"></div>
            <div className="w-16 h-16 bg-black border border-intuition-primary flex items-center justify-center font-bold text-3xl text-intuition-primary shrink-0">
              {agent.image ? <img src={agent.image} className="w-full h-full object-cover" alt="" /> : agent.label?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-white font-display tracking-wide">{agent.label}</h1>
                <span className="px-2 py-0.5 bg-intuition-primary/10 border border-intuition-primary/30 text-[10px] font-mono text-intuition-primary rounded uppercase">{agent.type || 'ATOM'}</span>
              </div>
              <div className="text-xs font-mono text-slate-400">ID: {agent.id}</div>
            </div>
          </div>

          <div className="bg-black border border-intuition-border h-[500px] relative clip-path-slant group flex flex-col">
            <div className="p-6 border-b border-white/5 flex justify-between items-end">
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-black text-white font-display tracking-tight">{displayPrice} <span className="text-lg text-slate-500 font-mono">tTRUST</span></span>
                  <span className={`text-sm font-mono font-bold ${displayTrust > 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {displayTrust > 50 ? `+${(displayTrust - 50).toFixed(1)}%` : `-${(50 - displayTrust).toFixed(1)}%`}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-500 mt-1">{displayDate}</div>
              </div>

              <div className="flex gap-8 text-right">
                <div>
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-2 h-2 rounded-full bg-intuition-primary"></div>
                    <span className="text-intuition-primary font-bold font-display text-xl">{displayTrust}%</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">TRUST PROBABILITY</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-2 h-2 rounded-full bg-intuition-danger"></div>
                    <span className="text-intuition-danger font-bold font-display text-xl">{displayDistrust}%</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">DISTRUST PROBABILITY</div>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full relative">
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    onMouseMove={(e: any) => { if (e?.activePayload) setHoverData(e.activePayload[0].payload); }}
                    onMouseLeave={() => setHoverData(null)}
                    margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradTrust" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00f3ff" stopOpacity={0.2} /><stop offset="95%" stopColor="#00f3ff" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gradDistrust" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff0055" stopOpacity={0.2} /><stop offset="95%" stopColor="#ff0055" stopOpacity={0} /></linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="timeLabel" hide />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Fira Code' }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip cursor={{ stroke: '#fff', strokeWidth: 1, strokeDasharray: '5 5' }} content={() => null} />
                    <ReferenceLine yAxisId="right" y={50} stroke="#334155" strokeDasharray="3 3" />
                    <Area yAxisId="right" type="stepAfter" dataKey="trust" stroke="#00f3ff" strokeWidth={3} fill="url(#gradTrust)" activeDot={{ r: 6, fill: '#00f3ff', stroke: '#fff', strokeWidth: 2 }} />
                    <Area yAxisId="right" type="stepAfter" dataKey="distrust" stroke="#ff0055" strokeWidth={3} fill="url(#gradDistrust)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              <div className="absolute bottom-4 left-6 opacity-20 pointer-events-none select-none">
                <div className="text-4xl font-black text-white font-display tracking-tighter">INTURANK</div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex border-b border-intuition-border mb-4">
              {['opinions', 'activity', 'rules'].map(t => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`px-6 py-3 font-mono text-xs font-bold uppercase border-b-2 transition-colors ${activeTab === t ? 'border-intuition-primary text-intuition-primary' : 'border-transparent text-slate-500'}`}>{t}</button>
              ))}
            </div>

            {activeTab === 'opinions' && (
              <div className="space-y-4">
                <div className="p-4 bg-intuition-card border border-intuition-border clip-path-slant">
                  <textarea value={newComment} onChange={e => setNewComment(e.target.value)} className="w-full bg-black border border-slate-800 p-3 text-white text-sm font-mono focus:border-intuition-primary outline-none" placeholder="TRANSMIT_OPINION..." />
                  <div className="flex justify-between mt-2">
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedSide('TRUST')} className={`px-3 py-1 text-[10px] border font-bold ${selectedSide === 'TRUST' ? 'bg-intuition-success/20 border-intuition-success text-intuition-success' : 'border-slate-700 text-slate-500'}`}>BULLISH</button>
                      <button onClick={() => setSelectedSide('DISTRUST')} className={`px-3 py-1 text-[10px] border font-bold ${selectedSide === 'DISTRUST' ? 'bg-intuition-danger/20 border-intuition-danger text-intuition-danger' : 'border-slate-700 text-slate-500'}`}>BEARISH</button>
                    </div>
                    <button onClick={handleTransmit} disabled={isTransmitting} className="px-4 py-1 bg-intuition-primary text-black font-bold text-xs font-mono clip-path-slant hover-glow">{isTransmitting ? 'SIGNING...' : 'TRANSMIT (ON-CHAIN)'}</button>
                  </div>
                </div>

                {comments.length === 0 ? <div className="text-center text-slate-600 py-8 font-mono text-xs">NO_TRANSMISSIONS_FOUND</div> : comments.map((c, i) => (
                  <div key={c.id || i} className="flex gap-3 p-3 border-b border-white/5">
                    <div className={`w-1 self-stretch ${c.isBullish ? 'bg-intuition-success' : 'bg-intuition-danger'}`}></div>
                    <div>
                      <div className="flex gap-2 items-center">
                        <span className="text-white font-bold text-sm">0x...</span>
                        <span className={`text-[10px] px-1 border ${c.isBullish ? 'text-intuition-success border-intuition-success' : 'text-intuition-danger border-intuition-danger'}`}>{c.isBullish ? 'TRUST' : 'DISTRUST'}</span>
                      </div>
                      <p className="text-slate-400 text-sm font-mono mt-1">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-2 font-mono text-xs max-h-96 overflow-y-auto custom-scrollbar">
                {activityLog.length === 0 ? <div className="text-center py-10 text-slate-600">NO_ON_CHAIN_ACTIVITY</div> : activityLog.map((tx, i) => (
                  <div key={tx.id + '-' + i} className="flex justify-between p-3 border-b border-white/5 hover:bg-white/5">
                    <span className={tx.type === 'DEPOSIT' ? 'text-intuition-success' : 'text-intuition-danger'}>{tx.type === 'DEPOSIT' ? 'ACQUIRED' : 'LIQUIDATED'} SHARES</span>
                    <span className="text-white">{Number(tx.shares || 0).toFixed(6)} UNITS</span>
                    <span className="text-slate-500">{tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : 'Block #'}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'rules' && (
              <div className="p-6 border border-intuition-primary/20 bg-black/50 font-mono text-sm text-slate-400">
                <h3 className="text-white font-bold mb-2">PROTOCOL_RULES_v1</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Positions are tokenized via <strong>ERC-1155</strong> MultiVault.</li>
                  <li>Pricing follows a <strong>Progressive Bonding Curve</strong>.</li>
                  <li>Opinions are stored as <strong>Semantic Triples</strong> on-chain.</li>
                  <li>0.1% Protocol Fee applies to all trades.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-24 border border-intuition-primary bg-black p-1 clip-path-slant hover-glow">
            <div className="border border-intuition-primary/30 p-6">
              <div className="flex justify-between items-center mb-6 border-b border-intuition-border pb-2">
                <h2 className="font-bold text-intuition-primary font-display tracking-widest">EXECUTION_DECK</h2>
                <div className="w-2 h-2 bg-intuition-primary animate-pulse"></div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => { setTradeMode('Buy'); setInputAmount(''); }} className={`py-2 font-mono text-xs font-bold border clip-path-slant transition-all ${tradeMode === 'Buy' ? 'bg-intuition-primary text-black border-intuition-primary' : 'text-slate-500 border-slate-800'}`}>ACQUIRE</button>
                <button onClick={() => { setTradeMode('Sell'); setInputAmount(''); }} className={`py-2 font-mono text-xs font-bold border clip-path-slant transition-all ${tradeMode === 'Sell' ? 'bg-intuition-danger text-black border-intuition-danger' : 'text-slate-500 border-slate-800'}`}>LIQUIDATE</button>
              </div>

              <div className="mb-4">
                <div className="text-[10px] text-slate-500 font-mono mb-2 uppercase">Target Position</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setSelectedSide('TRUST')} className={`p-3 border clip-path-slant text-left transition-all ${selectedSide === 'TRUST' ? 'bg-intuition-success/10 border-intuition-success' : 'border-slate-800 bg-black hover:border-intuition-success/50'}`}>
                    <div className={`font-black font-display ${selectedSide === 'TRUST' ? 'text-intuition-success' : 'text-slate-600'}`}>TRUST</div>
                    <div className="text-[10px] font-mono text-slate-500">{trustPct}% PROB</div>
                  </button>
                  <button onClick={() => setSelectedSide('DISTRUST')} className={`p-3 border clip-path-slant text-left transition-all ${selectedSide === 'DISTRUST' ? 'bg-intuition-danger/10 border-intuition-danger' : 'border-slate-800 bg-black hover:border-intuition-danger/50'}`}>
                    <div className={`font-black font-display ${selectedSide === 'DISTRUST' ? 'text-intuition-danger' : 'text-slate-600'}`}>DISTRUST</div>
                    <div className="text-[10px] font-mono text-slate-500">{distrustPct}% PROB</div>
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-[10px] font-mono text-intuition-primary/70">
                  <span>{tradeMode === 'Buy' ? 'INPUT (tTRUST)' : 'INPUT (SHARES)'}</span>
                  <span>BAL: {tradeMode === 'Buy' ? walletBalance : shareBalance}</span>
                </div>
                <div className="relative">
                  <input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} className={`w-full bg-black border p-3 text-right text-white font-mono text-lg focus:outline-none clip-path-slant ${tradeMode === 'Buy' ? 'border-intuition-primary' : 'border-intuition-danger'}`} placeholder="0.00" />
                  <button onClick={() => setInputAmount(tradeMode === 'Buy' ? walletBalance : shareBalance)} className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] bg-slate-800 text-white px-2 py-1 rounded hover:bg-white hover:text-black font-bold">MAX</button>
                </div>
              </div>

              <button onClick={handleTrade} className={`w-full py-3 font-bold font-display text-sm tracking-widest clip-path-slant hover-glow ${tradeMode === 'Buy' ? 'bg-intuition-success text-black' : 'bg-intuition-danger text-black'}`}>{tradeMode === 'Buy' ? 'CONFIRM_ACQUISITION' : 'CONFIRM_LIQUIDATION'}</button>
            </div>
          </div>

          {userPosition && (
            <div className="border border-intuition-secondary bg-black p-1 clip-path-slant hover-glow animate-in fade-in slide-in-from-bottom-4">
              <div className="p-4 border border-intuition-secondary/30 bg-intuition-secondary/5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-intuition-secondary font-display text-sm">ACTIVE_POSITION</h3>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${parseFloat(userPosition.pnl) >= 0 ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' : 'text-rose-400 border-rose-500/50 bg-rose-500/10'}`}>{parseFloat(userPosition.pnl) >= 0 ? '+' : ''}{userPosition.pnl}% PNL</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-4">
                  <div className="text-slate-500">SHARES: <span className="text-white">{userPosition.shares}</span></div>
                  <div className="text-slate-500 text-right">VALUE: <span className="text-intuition-primary">{userPosition.value}</span></div>
                </div>

                <button onClick={() => setShowShareCard(true)} className="w-full py-2 border border-intuition-secondary text-intuition-secondary font-bold text-xs font-mono hover:bg-intuition-secondary hover:text-black transition-colors clip-path-slant">GENERATE_PNL_CARD</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showShareCard && userPosition && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowShareCard(false)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowShareCard(false)} className="absolute -top-12 right-0 text-white hover:text-intuition-danger"><Info /></button>
            <ShareCard username={wallet || '0xUser'} pnl={userPosition.pnl} entryPrice={userPosition.entry} currentPrice={userPosition.exit} assetName={agent?.label || 'Unknown'} side={selectedSide} />
            <div className="text-center mt-4 text-slate-500 text-xs font-mono">CLICK_OUTSIDE_TO_CLOSE</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketDetail;
