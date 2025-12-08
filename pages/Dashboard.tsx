import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { connectWallet, getConnectedAccount, getWalletBalance, getLocalTransactions, getShareBalance, getQuoteRedeem } from '../services/web3';
import { getUserPositions, getUserHistory, getVaultsByIds } from '../services/graphql';
import { Wallet, User, Zap, Activity, Clock, AlertTriangle, RefreshCw, Loader2, ExternalLink, UserCircle } from 'lucide-react';
import { formatEther } from 'viem';
import { Transaction } from '../types';
import { toast } from '../components/Toast';
import { playHover, playClick } from '../services/audio';
import { Link } from 'react-router-dom';
import { CURRENCY_SYMBOL } from '../constants';

const Dashboard: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<string>('0.00');
  const [portfolioValue, setPortfolioValue] = useState<string>('0.00');
  const [netPnL, setNetPnL] = useState<number>(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const acc = await getConnectedAccount();
      setAccount(acc);
      if (acc) {
        await fetchUserData(acc);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchUserData = async (address: string) => {
    setLoading(true);
    try {
      const bal = await getWalletBalance(address);
      setBalance(Number(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));

      // 1. Fetch History (Safely)
      const chainHistory = await getUserHistory(address).catch(e => []);
      const localHistory = getLocalTransactions(address);

      const mergedHistory = [...localHistory, ...chainHistory]
        .filter((tx, index, self) => index === self.findIndex((t) => (t.id === tx.id)))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); // Ascending for calc
      
      setHistory(mergedHistory.slice().reverse()); // Descending for display

      // Calculate Running Capital for Chart & PnL
      let runningDeposit = 0;
      let runningRedeem = 0;
      
      const historyPoints = mergedHistory.map(tx => {
          try {
              const val = parseFloat(formatEther(BigInt(tx.assets || '0')));
              if (tx.type === 'DEPOSIT') runningDeposit += val;
              else if (tx.type === 'REDEEM') runningRedeem += val;
          } catch {}
          return {
              name: tx.timestamp,
              val: runningDeposit - runningRedeem
          };
      });
      if (historyPoints.length > 0) historyPoints.unshift({ name: 0, val: 0 });
      setChartData(historyPoints);

      // 2. Identify Vaults to Scan
      const uniqueVaultIds = Array.from(new Set([
          ...localHistory.map(tx => tx.vaultId?.toLowerCase()),
          ...chainHistory.map(tx => tx.vaultId?.toLowerCase()),
          ...(await getUserPositions(address).catch(() => [])).map((p:any) => p.vault?.term_id?.toLowerCase())
      ])).filter(Boolean) as string[];

      // 3. Fetch Metadata
      const metadata = await getVaultsByIds(uniqueVaultIds).catch(e => []);

      // 4. Check Live On-Chain Balances & VALUES
      const livePositionsData = await Promise.all(
        uniqueVaultIds.map(async (id) => {
          try {
            const meta = metadata.find(m => (m.id || '').toLowerCase() === (id || '').toLowerCase());
            const curveId = meta?.curveId ? Number(meta.curveId) : 0; 
            
            // Get Shares
            const sharesStr = await getShareBalance(address, id, curveId);
            const shares = parseFloat(sharesStr || '0');
            
            // Get Value (On-Chain Simulation)
            let valueStr = "0";
            if (shares > 0.000001) {
                valueStr = await getQuoteRedeem(sharesStr, id, address, curveId);
            }

            return { id, shares, meta, sharesStr, valueStr };
          } catch (e) {
            return { id, shares: 0, meta: undefined, sharesStr: '0', valueStr: '0' };
          }
        })
      );

      // 5. Construct Final List
      const activePositions = livePositionsData.filter(p => p.shares > 0.000001);

      const finalPositions = activePositions.map(item => {
          const val = parseFloat(item.valueStr);
          return {
            id: item.id,
            shares: item.sharesStr,
            value: val,
            atom: { 
                label: item.meta?.label || `Agent ${item.id.slice(0, 6)}...`, 
                image: item.meta?.image 
            },
            isPending: false,
          };
      });

      setPositions(finalPositions);

      // 6. Calculate PnL
      const currentVal = finalPositions.reduce((acc, cur) => acc + (cur.value || 0), 0);
      setPortfolioValue(currentVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
      
      // PnL = (Current Value + Total Redeemed) - Total Deposited
      setNetPnL((currentVal + runningRedeem) - runningDeposit);

    } catch (e) {
      console.error('Dashboard Sync Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    playClick();
    const acc = await connectWallet();
    if (acc) {
      setAccount(acc);
      fetchUserData(acc);
    }
  };

  const handleRefresh = () => {
    playClick();
    toast.info('VERIFYING ON-CHAIN...');
    if (account) fetchUserData(account);
  };

  if (!account) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 font-mono">
        <div className="w-24 h-24 border-2 border-dashed border-intuition-border rounded-full flex items-center justify-center mb-8 animate-spin-slow">
          <Wallet size={40} className="text-intuition-primary" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4 font-display uppercase tracking-widest">Authentication Required</h1>
        <button 
          onClick={handleConnect}
          onMouseEnter={playHover}
          className="px-8 py-3 bg-intuition-primary text-black font-bold font-display tracking-wider hover:bg-white transition-colors clip-path-slant hover-glow"
        >
          INITIALIZE_LINK
        </button>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-10 pb-20">
      <div className="mb-12 p-1 bg-gradient-to-r from-intuition-primary via-intuition-secondary to-intuition-primary rounded-none clip-path-slant">
        <div className="bg-black p-8 flex flex-col md:flex-row items-center gap-8 clip-path-slant relative">
          <button 
            onClick={handleRefresh}
            onMouseEnter={playHover}
            className="absolute top-4 right-4 text-intuition-primary hover:text-white transition-colors hover:rotate-180 duration-500 z-20" title="FORCE SYNC">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>

          <div className="w-24 h-24 bg-intuition-dark border-2 border-intuition-primary flex items-center justify-center shadow-[0_0_20px_rgba(0,243,255,0.3)] transition-shadow">
            <User size={48} className="text-intuition-primary" />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                <span className="text-intuition-primary font-mono text-xs">PLAYER_ID</span>
                <Link 
                    to={`/profile/${account}`} 
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white hover:bg-intuition-primary hover:text-black text-[10px] font-bold font-mono rounded transition-colors"
                >
                    <UserCircle size={12} /> VIEW PUBLIC PROFILE
                </Link>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white font-display tracking-wider mb-2 text-glow">{account.slice(0, 6)}...{account.slice(-4)}</h1>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start font-mono text-xs">
              <span className="bg-intuition-success/10 text-intuition-success px-2 py-1 border border-intuition-success/30">LEVEL: {positions.length > 0 ? 'TRADER' : 'NOVICE'}</span>
              <span className="bg-intuition-warning/10 text-intuition-warning px-2 py-1 border border-intuition-warning/30">POSITIONS: {positions.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full md:w-auto">
            <div className="bg-intuition-dark border border-intuition-border p-4 min-w-[140px] hover:border-intuition-primary/50 transition-colors group">
              <div className="text-[10px] text-slate-500 font-mono uppercase group-hover:text-intuition-primary transition-colors">Wallet Balance</div>
              <div className="text-xl font-bold text-white font-display">{balance} <span className="text-xs text-intuition-primary">TRUST</span></div>
            </div>

            <div className="bg-intuition-dark border border-intuition-border p-4 min-w-[140px] hover:border-intuition-success/50 transition-colors group">
              <div className="text-[10px] text-slate-500 font-mono uppercase group-hover:text-intuition-success transition-colors">Portfolio Value</div>
              <div className="text-xl font-bold text-intuition-success font-display">{portfolioValue} <span className="text-xs text-intuition-primary">TRUST</span></div>
            </div>

            <div className="bg-intuition-dark border border-intuition-border p-4 min-w-[140px] hover:border-intuition-secondary/50 transition-colors group hidden md:block">
              <div className="text-[10px] text-slate-500 font-mono uppercase group-hover:text-intuition-secondary transition-colors">Est. PnL</div>
              <div className={`text-xl font-bold font-display ${netPnL >= -0.0001 ? 'text-emerald-400' : 'text-rose-400'}`}>{netPnL > 0 ? '+' : ''}{netPnL.toFixed(4)} <span className="text-xs text-slate-500">TRUST</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 px-2">
        <AlertTriangle size={14} className="text-yellow-500" />
        <p className="text-[10px] font-mono text-yellow-500/70">POSITIONS ARE VERIFIED DIRECTLY ON-CHAIN. IF YOU SOLD, HIT REFRESH TO CLEAR.</p>
      </div>

      <div className="border border-intuition-border bg-black mb-8 relative clip-path-slant">
        <div className="px-6 py-4 border-b border-intuition-border flex items-center justify-between bg-intuition-card">
          <h3 className="font-bold text-white font-display tracking-wider flex items-center gap-2"><Zap size={18} className="text-intuition-warning animate-pulse" /> ACTIVE_POSITIONS</h3>
          {loading && <span className="text-xs font-mono text-intuition-primary animate-pulse flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> VERIFYING...</span>}
        </div>
        <div className="overflow-x-auto min-h-[100px]">
          <table className="w-full text-left text-sm font-mono">
            <thead>
              <tr className="bg-intuition-dark text-slate-500 uppercase text-xs tracking-wider border-b border-intuition-border">
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Shares Held</th>
                <th className="px-6 py-4">Est. Value</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-intuition-border/30">
              {positions.length > 0 ? positions.map(pos => (
                <tr 
                  key={pos.id} 
                  onMouseEnter={playHover}
                  className="hover:bg-intuition-primary/10 transition-colors group hover:shadow-[inset_0_0_10px_rgba(0,243,255,0.1)]"
                >
                  <td className="px-6 py-4">
                    <Link to={`/markets/${pos.id}`} className="flex items-center gap-3">
                      {pos.atom?.image && <img src={pos.atom.image} className="w-8 h-8 rounded-sm object-cover border border-intuition-primary/30" alt="" />}
                      <div className="font-bold text-white group-hover:text-intuition-primary transition-colors text-glow">{pos.atom?.label}</div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-slate-500 font-mono">{pos.id.slice(0, 8)}...</td>
                  <td className="px-6 py-4 text-white font-bold font-display text-lg">{parseFloat(pos.shares || '0').toFixed(4)}</td>
                  <td className="px-6 py-4 text-intuition-success">{(pos.value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} {CURRENCY_SYMBOL}</td>
                  <td className="px-6 py-4 text-right"><span className="text-intuition-success text-xs font-bold border border-intuition-success/30 px-2 py-1 bg-intuition-success/10 rounded flex items-center justify-end gap-1"><ExternalLink size={10} /> ON-CHAIN</span></td>
                </tr>
              )) : (!loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">NO ACTIVE POSITIONS. (Chain verified: 0)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="border border-intuition-border bg-black p-6 min-h-[300px] clip-path-slant">
          <h3 className="font-bold text-white font-display mb-4 flex items-center gap-2"><Clock size={18} className="text-intuition-secondary" /> TRANSACTION_LOGS</h3>
          <div className="space-y-2 font-mono text-xs overflow-y-auto max-h-[300px] custom-scrollbar">
            {history.length > 0 ? history.map((tx, idx) => (
              <div 
                key={tx.id + '-' + idx} 
                onMouseEnter={playHover}
                className="flex justify-between items-center p-3 border-b border-white/5 hover:bg-white/5 transition-colors relative overflow-hidden"
              >
                {!tx.id?.startsWith?.('0x') && <div className="absolute left-0 top-0 h-full w-1 bg-yellow-500 animate-pulse"></div>}
                <div className="flex flex-col pl-2">
                  <span className={`font-bold ${tx.type === 'DEPOSIT' ? 'text-intuition-success' : 'text-intuition-danger'}`}>{tx.type === 'DEPOSIT' ? 'ACQUIRED' : 'LIQUIDATED'} {tx.assetLabel || 'Unknown'}</span>
                  <span className="text-slate-600">ID: {tx.vaultId?.slice(0, 8)}...</span>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">
                    {(() => {
                        try {
                            const raw = tx.assets ?? '0';
                            const val = raw.includes('.') ? parseFloat(raw) : parseFloat(formatEther(BigInt(raw)));
                            return val.toFixed(4);
                        } catch { return '0.0000'; }
                    })()} {CURRENCY_SYMBOL}
                  </div>
                  <div className="text-slate-500">{new Date(tx.timestamp || Date.now()).toLocaleTimeString()}</div>
                </div>
              </div>
            )) : (<div className="text-slate-600 text-center py-4 border border-dashed border-slate-800">[NO HISTORY FOUND]</div>)}
          </div>
        </div>

        <div className="border border-intuition-border bg-black p-6 min-h-[300px] flex flex-col clip-path-slant hover:shadow-[0_0_20px_rgba(0,243,255,0.1)] transition-shadow">
          <h3 className="font-bold text-white font-display mb-4 flex items-center gap-2"><Activity size={18} className="text-intuition-primary animate-pulse" /> CAPITAL_DEPLOYMENT</h3>
          <div className="flex-1 w-full h-full min-h-[200px] flex items-center justify-center text-slate-600 font-mono text-xs">
            {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                          </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="name" hide />
                      <YAxis hide />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                      <Area type="stepAfter" dataKey="val" stroke="#00f3ff" fillOpacity={1} fill="url(#colorVal)" />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <span>INSUFFICIENT DATA FOR TELEMETRY</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;