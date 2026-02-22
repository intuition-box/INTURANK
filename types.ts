import React from 'react';

export interface Account {
  id: string; // Mapped from term_id
  counterTermId?: string; // For triples, the ID of the opposing position
  label?: string;
  description?: string;
  image?: string;
  type?: string;
  protocol_tier?: string;
  block_number?: number;
  links?: { label: string; url: string }[];
  creator?: {
    id: string;
    label: string;
    image?: string;
  };
  curveId?: any;
  totalAssets?: string; // Real Volume (in Wei)
  totalShares?: string; // Total Supply (in Wei)
  currentSharePrice?: string; // Spot Price (in Wei)
  marketCap?: string; // Calculated Multi-Curve Market Cap
  positionCount?: number; // Number of holders (positions with shares > 0)
}

export interface Triple {
  id?: string;
  subject: { term_id: string; label: string; image?: string; type?: string };
  predicate: { term_id: string; label: string };
  object: { term_id: string; label: string; image?: string; type?: string };
  block_number?: number;
  transaction_hash?: string;
  timestamp?: number;
  creator?: { id: string; label?: string; image?: string };
}

export interface Claim {
  id: string;
  subject: { id: string; label: string; image?: string };
  predicate: string; // Changed from union type to string to support dynamic predicates
  object: { id: string; label: string; image?: string; type?: string };
  creator?: { id: string; label?: string; image?: string };
  confidence: number; // 0-100
  timestamp: number;
  txHash?: string;
  reason?: string;
  block?: number;
}

export interface Position {
  id: string;
  account_id: string;
  vault_id: string;
  shares: string;
}

export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'REDEEM';
  assets: string;
  shares: string;
  timestamp: number;
  vaultId: string;
  assetLabel?: string;
  user?: string;
}

// UI Types
export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export type Web3Status = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletState {
  address: string | null;
  status: Web3Status;
  balance: string;
  connect: () => Promise<void>;
  deposit: (amount: string, vaultId: string) => Promise<string>;
}