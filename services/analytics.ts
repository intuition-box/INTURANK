
import { formatEther } from 'viem';
import { Account, Transaction } from '../types';
import { DISPLAY_DIVISOR } from '../constants';

/**
 * --- INTURANK ANALYTICS ENGINE v2.2.0 ---
 * MISSION: Precision parity and spread-aware UX.
 */

/**
 * Robustly parses strings that might be Wei (BigInt) or Ether (Float).
 */
export const safeParseUnits = (val: string | undefined | null): number => {
    if (val === null || val === undefined || val === '0') return 0;
    try {
        if (typeof val === 'string' && val.includes('.')) return parseFloat(val);
        // Handle BigInt strings safely
        return parseFloat(formatEther(BigInt(val)));
    } catch (e) {
        const p = parseFloat(val as string);
        return isNaN(p) ? 0 : p;
    }
};

export const formatMarketValue = (val: number | string): string => {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(n) || n === 0) return "0.0000";
    if (n < 0.0001) return n.toFixed(8);
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
            return safeParseUnits(currentSharePriceWei);
        }
        const assets = safeParseUnits(assetsWei);
        const shares = safeParseUnits(sharesWei);
        if (shares <= 0) return 0.1;
        return assets / shares;
    } catch (error) {
        return 0.1;
    }
};

export const calculateTrustScore = (assetsWei: string, sharesWei: string, currentSharePriceWei?: string): number => {
    try {
        const assets = safeParseUnits(assetsWei);
        if (assets <= 0) return 15.0; 
        const score = 15 + (Math.log10(assets + 1) / 5.8) * 85;
        return Math.min(99.0, Math.max(1.0, score));
    } catch {
        return 50.0;
    }
};

export const calculateMarketCap = (assetsWei: string, sharesWei: string, priceWei?: string): number => {
    if (typeof assetsWei === 'string' && assetsWei.includes('.')) return parseFloat(assetsWei);
    try {
        const price = calculateAgentPrice(assetsWei, sharesWei, priceWei);
        const shares = safeParseUnits(sharesWei);
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
    if (type === 'PERSON' || label.endsWith('.ETH') || label.includes('DEV') || label.includes('BUILDER') || label.includes('FOUNDER')) return 'PERSON';
    if (label.includes('SWAP') || label.includes('DEX') || label.includes('DAO') || label.includes('FINANCE') || label.includes('CHAIN') || label.includes('PROTOCOL') || label.includes('L2') || label.includes('BRIDGE')) return 'PROTOCOL';
    if (label.includes('PEPE') || label.includes('DOGE') || label.includes('INU') || label.includes('MOON') || label.includes('CAT') || label.includes('WIF') || label.includes('ELON')) return 'MEME';
    if (label.includes('ART') || label.includes('MUSIC') || label.includes('BLOG') || label.includes('PODCAST') || label.includes('MEDIA') || label.includes('NEWS')) return 'CREATOR';
    if (label.includes('CAPITAL') || label.includes('VENTURE') || label.includes('FUND') || label.includes('VC')) return 'INVESTOR';
    if (type === 'ORGANIZATION') return 'PROTOCOL';
    if (type === 'ACCOUNT') return 'PERSON';
    return 'UNKNOWN';
};

/**
 * Distinguishes between System-Verified (official protocols/known identities) 
 * and User-Generated atoms.
 */
export const isSystemVerified = (agent: Account): boolean => {
    const label = (agent.label || '').toLowerCase();
    const category = categorizeAgent(agent);
    
    // Logic 1: ENS Names are considered self-verified identity nodes
    if (label.endsWith('.eth')) return true;
    
    // Logic 2: Known Protocol entities and AI Models
    if (category === 'PROTOCOL' || category === 'AI') return true;
    
    // Logic 3: Specific system/network keywords
    const systemKeywords = ['intuition', 'ethereum', 'base', 'optimism', 'arbitrum', 'uniswap', 'aave', 'chainlink', 'vault'];
    if (systemKeywords.some(k => label.includes(k))) return true;

    return false;
};

export const calculateVolatility = (assetsWei: string): number => {
    const assets = safeParseUnits(assetsWei);
    if (assets === 0) return 0;
    return Math.min(100, Math.max(1, 100 - Math.log10(assets + 1) * 20));
};

export const formatDisplayedShares = (val: string | bigint | number): string => {
    if (typeof val === 'number') return val.toFixed(6);
    return safeParseUnits(val.toString()).toFixed(6);
};

/**
 * Calculates accurate PnL. 
 * Unrealized PnL should use Spot Price (valuation) to avoid spread red ink on new positions.
 * When curveId is provided, only deposits/redemptions for that curve are used (linear vs exponential).
 */
export const calculatePositionPnL = (sharesHeld: number, valuationPrice: number, unifiedHistory: Transaction[], vaultId: string, curveId?: number) => {
    const normalizedId = vaultId.toLowerCase();
    const filteredHistory = unifiedHistory.filter(tx => {
        if (tx.vaultId?.toLowerCase() !== normalizedId) return false;
        if (curveId != null && tx.curveId != null && tx.curveId !== curveId) return false;
        return true;
    });
    
    let totalSpent = 0;
    let totalSharesBought = 0;
    
    filteredHistory.forEach(tx => {
        if (tx.type === 'DEPOSIT') {
            const assetVal = safeParseUnits(tx.assets);
            const shareVal = safeParseUnits(tx.shares);
            if (assetVal > 0 && shareVal > 0) {
                totalSpent += assetVal;
                totalSharesBought += shareVal;
            }
        }
    });

    if (totalSharesBought === 0) {
        return { 
            profit: 0, 
            pnlPercent: 0, 
            avgEntryPrice: valuationPrice, 
            costBasis: sharesHeld * valuationPrice 
        };
    }

    const avgEntryPrice = totalSpent / totalSharesBought;
    const costBasisOfHeldShares = sharesHeld * avgEntryPrice;
    
    // Valuation is derived from valuationPrice (usually Spot Price for unrealized UX)
    const currentValue = sharesHeld * valuationPrice;
    const profit = currentValue - costBasisOfHeldShares;
    const pnlPercent = costBasisOfHeldShares > 0 ? (profit / costBasisOfHeldShares) * 100 : 0;
    
    return { profit, pnlPercent, avgEntryPrice, costBasis: costBasisOfHeldShares };
};

/**
 * Calculates realized PnL for a specific sell transaction.
 */
export const calculateRealizedPnL = (sharesSold: number, assetsReceived: number, unifiedHistory: Transaction[], vaultId: string) => {
    const normalizedId = vaultId.toLowerCase();
    const historyBeforeSell = unifiedHistory.filter(tx => tx.vaultId?.toLowerCase() === normalizedId && tx.type === 'DEPOSIT');
    
    let totalSpent = 0;
    let totalSharesBought = 0;
    
    historyBeforeSell.forEach(tx => {
        const assetVal = safeParseUnits(tx.assets);
        const shareVal = safeParseUnits(tx.shares);
        totalSpent += assetVal;
        totalSharesBought += shareVal;
    });

    if (totalSharesBought === 0) return { profit: 0, pnlPercent: 0, entry: 0, exit: 0 };

    const avgEntryPrice = totalSpent / totalSharesBought;
    const costBasisOfSoldShares = sharesSold * avgEntryPrice;
    const profit = assetsReceived - costBasisOfSoldShares;
    const pnlPercent = (profit / costBasisOfSoldShares) * 100;

    return {
        profit,
        pnlPercent: pnlPercent.toFixed(2),
        entry: avgEntryPrice.toFixed(4),
        exit: (assetsReceived / sharesSold).toFixed(4)
    };
};

export interface IndexData {
    value: number;
    change: number;
    volatility: 'LOW_STABLE' | 'MODERATE' | 'HIGH_FLUX';
    volatilityLevel: number;
    forecast: string;
}

export const calculateIndexValue = (agents: Account[]): IndexData => {
    if (agents.length === 0) return { value: 1000, change: 0, volatility: 'LOW_STABLE', volatilityLevel: 1, forecast: 'Sector Offline.' };
    let totalScore = 0;
    let totalAssets = 0;
    agents.forEach(a => {
        totalScore += calculateTrustScore(a.totalAssets || '0', a.totalShares || '0', a.currentSharePrice);
        totalAssets += safeParseUnits(a.totalAssets);
    });
    const avgScore = totalScore / agents.length;
    const indexValue = avgScore * 42; 
    const change = (totalAssets % 7) - 3.5;
    let volatility: 'LOW_STABLE' | 'MODERATE' | 'HIGH_FLUX' = 'LOW_STABLE';
    let volLevel = 2;
    if (totalAssets < 10) { volatility = 'HIGH_FLUX'; volLevel = 5; }
    else if (totalAssets < 100) { volatility = 'MODERATE'; volLevel = 3; }
    else { volatility = 'LOW_STABLE'; volLevel = 1; }
    const forecast = change > 1 ? "Bullish convergence across primary sector nodes." : "Equilibrium maintained within standard deviations.";
    return { value: indexValue, change, volatility, volatilityLevel: volLevel, forecast };
};

/**
 * Biased towards Bullish sentiment based on protocol behavior.
 */
export const calculateSentimentBias = (history: Transaction[]) => {
    if (history.length === 0) return { trust: 50, distrust: 50 };
    const deposits = history.filter(t => t.type === 'DEPOSIT').length;
    const rawRatio = (deposits / history.length) * 100;
    
    // Applying a high Bullish bias floor (90-100% range)
    const biasedTrust = 91 + (rawRatio * 0.08) + (Math.random() * 1.5);
    const finalTrust = Math.min(100, biasedTrust);
    
    return { 
        trust: finalTrust, 
        distrust: 100 - finalTrust 
    };
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
