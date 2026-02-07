
import { formatEther } from 'viem';
import { Account, Transaction } from '../types';
import { DISPLAY_DIVISOR } from '../constants';

/**
 * --- INTURANK ANALYTICS ENGINE v1.9.7 ---
 */

/**
 * Robustly parses asset or share values from various formats (Wei string, float string, number).
 */
export const smartParseValue = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const s = val.toString().trim();
    if (s === '0' || !s) return 0;
    
    // If it contains a dot, treat as already formatted Ether decimal
    if (s.includes('.')) {
        const parsed = parseFloat(s);
        return isNaN(parsed) ? 0 : parsed;
    }
    
    // Otherwise assume it's raw Wei
    try {
        // Safety: if the string is very short (e.g. "1"), it might be a pre-formatted whole number.
        // But protocol indexers always return Wei strings.
        return parseFloat(formatEther(BigInt(s)));
    } catch {
        const fallback = parseFloat(s);
        return isNaN(fallback) ? 0 : fallback;
    }
};

export const formatMarketValue = (val: number | string): string => {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(n) || n === 0) return "0.00";
    if (n < 0.0001) return n.toFixed(8);
    if (n < 0.01) return n.toFixed(6);
    if (n < 1) return n.toFixed(4);
    
    return Intl.NumberFormat('en-US', { 
        notation: 'compact', 
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    }).format(n);
};

export const formatLargeNumber = (val: number | string): string => {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(n)) return "0";
    if (n >= 1000) return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
    return Math.floor(n).toLocaleString();
};

export const calculateAgentPrice = (assetsWei: string, sharesWei: string, currentSharePriceWei?: string): number => {
    try {
        if (currentSharePriceWei && currentSharePriceWei !== "0") {
            return parseFloat(formatEther(BigInt(currentSharePriceWei)));
        }
        const assets = parseFloat(formatEther(BigInt(assetsWei || '0')));
        const shares = parseFloat(formatEther(BigInt(sharesWei || '0')));
        if (shares <= 0) return 0.1;
        return assets / shares;
    } catch (error) {
        return 0.1;
    }
};

export const calculateTrustScore = (assetsWei: string, sharesWei: string, currentSharePriceWei?: string): number => {
    try {
        const assets = parseFloat(formatEther(BigInt(assetsWei || '0')));
        if (assets <= 0) return 47.0; 
        const score = 47 + (Math.pow(assets / 375000, 0.4) * 53);
        return Math.min(100.0, Math.max(0.1, score));
    } catch {
        return 50.0;
    }
};

export const calculateVolatility = (assetsWei: string): number => {
    try {
        const assets = parseFloat(formatEther(BigInt(assetsWei || '0')));
        if (assets <= 0) return 0.85;
        const entropy = Math.max(0.05, 1.5 / (Math.log10(assets + 1) + 1));
        return parseFloat(entropy.toFixed(4));
    } catch {
        return 0.5;
    }
};

export const calculateMarketCap = (assetsWei: string, sharesWei: string, priceWei?: string): number => {
    try {
        const price = calculateAgentPrice(assetsWei, sharesWei, priceWei);
        const shares = parseFloat(formatEther(BigInt(sharesWei || '0')));
        return shares * price;
    } catch {
        return 0;
    }
};

export type AgentCategory = 'FOUNDER' | 'CREATOR' | 'MEME' | 'PROTOCOL' | 'AI' | 'INVESTOR' | 'PERSON' | 'UNKNOWN';

export const categorizeAgent = (agent: Account): AgentCategory => {
    const label = (agent.label || '').toUpperCase();
    const type = (agent.type || '').toUpperCase();
    if (type === 'AI' || label.includes('BOT') || label.includes('AGENT') || label.includes('GPT') || label.includes('LLM')) return 'AI';
    if (type === 'PERSON' || type === 'ACCOUNT' || label.endsWith('.ETH') || label.includes('DEV') || label.includes('BUILDER') || label.includes('FOUNDER')) return 'PERSON';
    if (type === 'ORGANIZATION' || label.includes('SWAP') || label.includes('DEX') || label.includes('DAO') || label.includes('FINANCE') || label.includes('CHAIN') || label.includes('PROTOCOL') || label.includes('L2') || label.includes('BRIDGE')) return 'PROTOCOL';
    if (label.includes('PEPE') || label.includes('DOGE') || label.includes('INU') || label.includes('MOON') || label.includes('CAT') || label.includes('WIF') || label.includes('ELON')) return 'MEME';
    if (label.includes('ART') || label.includes('MUSIC') || label.includes('BLOG') || label.includes('PODCAST') || label.includes('MEDIA') || label.includes('NEWS')) return 'CREATOR';
    if (label.includes('CAPITAL') || label.includes('VENTURE') || label.includes('FUND') || label.includes('VC')) return 'INVESTOR';
    return 'UNKNOWN';
};

export const formatDisplayedShares = (val: string | number | bigint): string => {
    try {
        if (typeof val === 'number') return val.toFixed(6);
        const s = val.toString();
        if (s.includes('.')) return parseFloat(s).toFixed(6);
        return parseFloat(formatEther(BigInt(s))).toFixed(6);
    } catch {
        return "0.000000";
    }
};

export const calculatePositionPnL = (sharesHeld: number, currentValue: number, localHistory: Transaction[], vaultId: string) => {
    const filteredHistory = localHistory.filter(tx => tx.vaultId?.toLowerCase() === vaultId.toLowerCase());
    let totalSpent = 0;
    let totalSharesBought = 0;
    
    filteredHistory.forEach(tx => {
        if (tx.type === 'DEPOSIT') {
            const assetVal = smartParseValue(tx.assets);
            const shareVal = smartParseValue(tx.shares);
            totalSpent += assetVal;
            totalSharesBought += shareVal;
        }
    });

    const avgEntryPrice = totalSharesBought > 0 ? (totalSpent / totalSharesBought) : 0;
    const costBasis = sharesHeld * avgEntryPrice;
    
    const profit = currentValue - costBasis;
    const pnlPercent = costBasis > 0 ? (profit / costBasis) * 100 : 0;
    
    return { profit, pnlPercent, avgEntryPrice, costBasis };
};

/**
 * Calculates Global Protocol PnL (Realized + Unrealized)
 * Formula: (Total Current Equity) + (Total Assets Redeemed) - (Total Assets Deposited)
 */
export const calculateGlobalPnL = (currentEquity: number, history: Transaction[]) => {
    let totalDeposited = 0;
    let totalRedeemed = 0;

    history.forEach(tx => {
        const val = smartParseValue(tx.assets);
        if (tx.type === 'DEPOSIT') totalDeposited += val;
        else if (tx.type === 'REDEEM') totalRedeemed += val;
    });

    return (currentEquity + totalRedeemed) - totalDeposited;
};

export const calculateIndexValue = (agents: Account[]) => {
    if (agents.length === 0) return { value: 1000, change: 0, volatility: 'LOW_STABLE', volatilityLevel: 1, forecast: 'Sector Offline.' };
    let totalScore = 0;
    let totalAssets = 0;
    agents.forEach(a => {
        totalScore += calculateTrustScore(a.totalAssets || '0', a.totalShares || '0', a.currentSharePrice);
        totalAssets += parseFloat(formatEther(BigInt(a.totalAssets || '0')));
    });
    const avgScore = totalScore / agents.length;
    const indexValue = avgScore * 42; 
    const change = (totalAssets % 7) - 3.5;
    return { value: indexValue, change, volatility: totalAssets < 100 ? 'MODERATE' : 'LOW_STABLE', volatilityLevel: 2, forecast: "Equilibrium maintained." };
};

export const calculateSentimentBias = (history: Transaction[]) => {
    if (history.length === 0) return { trust: 50, distrust: 50 };
    const deposits = history.filter(t => t.type === 'DEPOSIT').length;
    const trustPct = (deposits / history.length) * 100;
    return { trust: trustPct, distrust: 100 - trustPct };
};

export const calculateCategoryExposure = (positions: any[]) => {
    const exposure: Record<string, number> = {};
    let totalValue = 0;
    positions.forEach(p => {
        const cat = categorizeAgent({ label: p.atom?.label || '', type: p.atom?.type } as Account);
        const val = p.value || 0;
        exposure[cat] = (exposure[cat] || 0) + val;
        totalValue += val;
    });
    if (totalValue === 0) return [];
    return Object.entries(exposure).map(([name, value]) => ({
        name,
        value: (value / totalValue) * 100
    })).sort((a, b) => b.value - a.value);
};
