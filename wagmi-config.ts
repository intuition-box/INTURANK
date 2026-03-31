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

const env = import.meta.env as { VITE_WALLETCONNECT_PROJECT_ID?: string; VITE_APP_URL?: string };
const rawProjectId = env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
const isPlaceholderProjectId =
  !rawProjectId ||
  rawProjectId === 'your_walletconnect_project_id' ||
  rawProjectId === '00000000000000000000000000000000';
const projectId = isPlaceholderProjectId ? '00000000000000000000000000000000' : rawProjectId;

if (isPlaceholderProjectId && typeof window !== 'undefined') {
  console.warn(
    '[IntuRank] Set VITE_WALLETCONNECT_PROJECT_ID (https://cloud.reown.com) — mobile wallets need a valid WalletConnect project ID.'
  );
}

/** Canonical site URL for WalletConnect deep links / metadata (production: set VITE_APP_URL to your public origin). */
function resolveAppUrl(): string | undefined {
  const fromEnv = env.VITE_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return undefined;
}

function resolveAppIcon(appUrl: string | undefined): string | undefined {
  const base = appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return undefined;
  return `${base.replace(/\/$/, '')}/icon.png`;
}

const appUrl = resolveAppUrl();
const appIcon = resolveAppIcon(appUrl);

export const wagmiConfig = getDefaultConfig({
  appName: 'IntuRank',
  appDescription: 'Trust Intelligence Layer on Intuition',
  appUrl,
  appIcon,
  projectId,
  chains: [intuitionChain],
  transports: {
    [CHAIN_ID]: http(RPC_URL),
  },
  ssr: false,
});

export { intuitionChain };
