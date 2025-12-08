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

export const calculateTrustScore = (assetsWei: string, sharesWei: string): number => {
    try {
        const assets = parseFloat(formatEther(BigInt(assetsWei || '0')));
        const shares = parseFloat(formatEther(BigInt(sharesWei || '0')));
        if (!shares || shares === 0) return 50;
        
        const price = assets / shares;
        // Logarithmic scale centered at 50
        const strength = Math.min(99, Math.max(1, 50 + Math.log10(price * 10 + 1) * 25));
        return isNaN(strength) ? 50 : strength;
    } catch {
        return 50;
    }
};

export const calculateVolatility = (assetsWei: string): number => {
    // Synthetic volatility based on asset depth (Lower depth = Higher volatility potential)
    const assets = parseFloat(formatEther(BigInt(assetsWei || '0')));
    if (assets === 0) return 0;
    // Inverse log scale
    return Math.min(100, Math.max(1, 100 - Math.log10(assets + 1) * 20));
};

export const calculateIndexValue = (agents: Account[]): { value: number, change: number } => {
    if (agents.length === 0) return { value: 1000, change: 0 };

    let totalScore = 0;
    agents.forEach(a => {
        totalScore += calculateTrustScore(a.totalAssets || '0', a.totalShares || '0');
    });

    const avg = totalScore / agents.length;
    // Scale to "Index" looking number (e.g. 1000 - 5000)
    const indexValue = avg * 42; 
    
    // Synthetic 24h change (Mocked deterministically based on ID for consistency)
    const mockChange = (agents.length % 5) - 2.5; 

    return { value: indexValue, change: mockChange };
};

// --- PORTFOLIO ANALYTICS ---

export const calculateSentimentBias = (history: Transaction[]) => {
    const total = history.length;
    if (total === 0) return { trust: 50, distrust: 50 };

    const trustActions = history.filter(t => t.type === 'DEPOSIT').length; // Assuming Deposit = Long/Trust
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