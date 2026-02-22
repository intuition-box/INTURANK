import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import type { Theme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from './wagmi-config';

// IntuRank palette
const INTURANK = {
  dark: '#020308',
  card: '#080a12',
  border: '#1a2a4a',
  primary: '#00f3ff',
  secondary: '#ff1e6d',
} as const;

const rainbowKitTheme: Theme = (() => {
  const base = darkTheme({
    accentColor: INTURANK.primary,
    accentColorForeground: 'black',
    borderRadius: 'small',
    overlayBlur: 'small',
  });
  return {
    ...base,
    colors: {
      ...base.colors,
      modalBackground: INTURANK.card,
      modalBackdrop: 'rgba(2, 3, 8, 0.88)',
      modalBorder: 'rgba(0, 243, 255, 0.25)',
      generalBorder: INTURANK.border,
      generalBorderDim: 'rgba(26, 42, 74, 0.7)',
      menuItemBackground: INTURANK.card,
      connectButtonBackground: INTURANK.card,
      connectButtonInnerBackground: INTURANK.dark,
      connectButtonText: INTURANK.primary,
      selectedOptionBorder: INTURANK.primary,
      closeButton: INTURANK.primary,
      closeButtonBackground: INTURANK.card,
      actionButtonSecondaryBackground: INTURANK.card,
      modalText: '#e2e8f0',
      modalTextDim: '#94a3b8',
      modalTextSecondary: '#64748b',
      profileForeground: '#e2e8f0',
      profileAction: INTURANK.card,
      profileActionHover: 'rgba(0, 243, 255, 0.12)',
    },
  };
})();
import { EmailNotifyProvider } from './contexts/EmailNotifyContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Stats from './pages/Stats';
import Markets from './pages/Markets';
import MarketDetail from './pages/MarketDetail';
import Feed from './pages/Feed';
import Compare from './pages/Compare';
import Portfolio from './pages/Portfolio';
import PublicProfile from './pages/PublicProfile';
import Account from './pages/Account';
import KPIDashboard from './pages/KPIDashboard';
import Documentation from './pages/Documentation';
import ComingSoon from './pages/ComingSoon';
import CreateSignal from './pages/CreateSignal';
import SDKPlayground from './pages/SDKPlayground';
import { ToastContainer } from './components/Toast';
import EmailNotifyModal from './components/EmailNotifyModal';

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={rainbowKitTheme}
          modalSize="compact"
          coolMode
        >
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <EmailNotifyProvider>
              <Layout>
          <ToastContainer />
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agents" element={<Navigate to="/markets" replace />} />
          <Route path="/agents/:id" element={<Navigate to="/markets/:id" replace />} />
          
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/account" element={<Account />} />
          <Route path="/profile/:address" element={<PublicProfile />} />
          <Route path="/dashboard" element={<Navigate to="/portfolio" replace />} /> 
          
          <Route path="/stats" element={<Stats />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/markets/:id" element={<MarketDetail />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/health" element={<KPIDashboard />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/sdk-lab" element={<SDKPlayground />} />
          
          {/* New Features */}
          <Route path="/compare" element={<Compare />} />
          <Route path="/coming-soon" element={<ComingSoon />} />
          <Route path="/create" element={<CreateSignal />} />
          </Routes>
        </Layout>
        <EmailNotifyModal />
      </EmailNotifyProvider>
    </Router>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default App;
