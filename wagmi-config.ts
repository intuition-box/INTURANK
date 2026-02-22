import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import type { Chain } from 'wagmi/chains';
import { CHAIN_ID, NETWORK_NAME, RPC_URL, EXPLORER_URL } from './constants';

const intuitionChain = {
  id: CHAIN_ID,
  name: NETWORK_NAME,
  nativeCurrency: { name: 'TRUST', symbol: 'TRUST', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'Intuition Explorer', url: EXPLORER_URL },
  },
} as const satisfies Chain;

const projectId = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
if (!projectId && typeof window !== 'undefined') {
  console.warn('IntuRank: VITE_WALLETCONNECT_PROJECT_ID is not set. WalletConnect will not work.');
}

export const wagmiConfig = getDefaultConfig({
  appName: 'IntuRank',
  projectId: projectId || '00000000000000000000000000000000',
  chains: [intuitionChain],
  transports: {
    [CHAIN_ID]: http(RPC_URL),
  },
  ssr: false,
});

export { intuitionChain };
