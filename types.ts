import React from 'react';

export interface Account {
  id: string; // Mapped from term_id
  label?: string;
  image?: string;
  type?: string;
  block_number?: number;
  creator?: {
    id: string;
    label: string;
  };
  curveId?: any;
  totalAssets?: string; // Real Volume (in Wei)
  totalShares?: string; // Total Supply (in Wei)
}

export interface Triple {
  subject: { term_id: string; label: string };
  predicate: { term_id: string; label: string };
  object: { term_id: string; label: string };
  block_number?: number;
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