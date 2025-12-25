import { formatEther } from 'viem';
import { Account, Transaction } from '../types';

// --- CATEGORIZATION ENGINE ---
export type AgentCategory = 'FOUNDER' | 'CREATOR' | 'MEME' | 'PROTOCOL' | 'AI' | 'INVESTOR' | 'UNKNOWN';

export const categorizeAgent = (agent: Account): AgentCategory => {
    const label = (agent.label || '').toUpperCase();
    const type = (agent.type || '').toUpperCase();
    
    if (type === 'AI' || label.includes('BOT') || label.includes('AGENT') || label.includes('GPT') || label.includes('LLM')) return 'AI';
    if (label.includes('SWAP') || label.includes('DEX') || label.includes('DAO') || label.includes('FINANCE') || label.includes('CHAIN') || label.includes('PROTOCOL') || label.includes('L2') || label.includes('BRIDGE')) return 'PROTOCOL';
    if (label.includes('PEPE') || label.includes('DOGE') || label.includes('INU') || label.includes('MOON') || label.includes('CAT') || label.includes('WIF') || label.includes('ELON')) return 'MEME';
    if (label.includes('DEV') || label.includes('BUILDER') || label.includes('ETH') || label.includes('VITALIK') || label.includes('FOUNDER') || label.includes('CEO')) return 'FOUNDER';
    if (label.includes('ART') || label.includes('MUSIC') || label.includes('BLOG') || label.includes('PODCAST') || label.includes('MEDIA') || label.includes('NEWS')) return 'CREATOR';
    if (label.includes('CAPITAL') || label.includes('VENTURE') || label.includes('FUND') || label.includes('VC')) return 'INVESTOR';
    
    return 'UNKNOWN';
};

// --- METRIC CALCULATORS ---

/**
 * Standardized Price Calculator
 * Uses spot price from contract if available, otherwise calculates from vault reserves.
 */
export const calculateAgentPrice = (assetsWei: string, sharesWei: string, spotPriceWei?: string): number => {
    if (spotPriceWei && spotPriceWei !== "0") {
        return parseFloat(formatEther(BigInt(spotPriceWei)));
    }
    const assets = parseFloat(formatEther(BigInt(assetsWei || '0')));
    const shares = parseFloat(formatEther(BigInt(sharesWei || '0')));
    return shares > 0 ? assets / shares : 0.001;
};

/**
 * Standardized Trust Score Calculator
 * Maps spot price to a 1-99 probability range using a logarithmic scale centered at price 1.0 (50%).
 */
export const calculateTrustScore = (assetsWei: string, sharesWei: string, spotPriceWei?: string): number => {
    try {
        const price = calculateAgentPrice(assetsWei, sharesWei, spotPriceWei);
        // Formula: 50 + log10(price) * 25
        // Price 1.0 -> 50%
        // Price 10.0 -> 75%
        // Price 26.95 -> ~86%
        const strength = Math.min(99, Math.max(1, 50 + (Math.log10(Math.max(0.000001, price)) * 25)));
        return isNaN(strength) ? 50 : strength;
    } catch {
        return 50;
    }
};

export const calculateVolatility = (assetsWei: string): number => {
    const assets = parseFloat(formatEther(BigInt(assetsWei || '0')));
    if (assets === 0) return 0;
    return Math.min(100, Math.max(1, 100 - Math.log10(assets + 1) * 20));
};

export interface IndexData {
    value: number;
    change: number;
    volatility: 'LOW_STABLE' | 'MODERATE' | 'HIGH_FLUX';
    volatilityLevel: number;
    forecast: string;
}

export const calculateIndexValue = (agents: Account[]): IndexData => {
    if (agents.length === 0) return { value: 1000, change: 0, volatility: 'LOW_STABLE', volatilityLevel: 1, forecast: 'Awaiting sector initialization...' };

    let totalScore = 0;
    let totalAssets = 0;
    agents.forEach(a => {
        totalScore += calculateTrustScore(a.totalAssets || '0', a.totalShares || '0', a.currentSharePrice);
        totalAssets += parseFloat(formatEther(BigInt(a.totalAssets || '0')));
    });

    const avgScore = totalScore / agents.length;
    const indexValue = avgScore * 42; 
    
    // Deterministic metrics based on data characteristics
    const change = (totalAssets % 7) - 3.5; // Pseudo-momentum based on total volume
    
    let volatility: 'LOW_STABLE' | 'MODERATE' | 'HIGH_FLUX' = 'LOW_STABLE';
    let volLevel = 2;
    if (totalAssets < 10) { volatility = 'HIGH_FLUX'; volLevel = 5; }
    else if (totalAssets < 100) { volatility = 'MODERATE'; volLevel = 3; }
    else { volatility = 'LOW_STABLE'; volLevel = 1; }

    // Dynamic Forecast generation
    let forecast = "";
    if (change > 1) {
        forecast = "Consensus acceleration detected. Semantic conviction is rallying as top-tier constituents capture wider network reach.";
    } else if (change < -1) {
        forecast = "Sector friction identified. Short-term skepticism is mounting, presenting a potential arbitrage window for contrarian stakers.";
    } else {
        forecast = "Equilibrium maintained. Capital flows are stabilizing across primary nodes, indicating a mature reputation cycle.";
    }

    return { value: indexValue, change, volatility, volatilityLevel: volLevel, forecast };
};

// --- PORTFOLIO ANALYTICS ---

export const calculateSentimentBias = (history: Transaction[]) => {
    const total = history.length;
    if (total === 0) return { trust: 50, distrust: 50 };

    const trustActions = history.filter(t => t.type === 'DEPOSIT').length;
    const trustPct = (trustActions / total) * 100;
    
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
    }));
};