
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Stats from './pages/Stats';
import Markets from './pages/Markets';
import MarketDetail from './pages/MarketDetail';
import Feed from './pages/Feed';
import Compare from './pages/Compare';
import Indexes from './pages/Indexes';
import Portfolio from './pages/Portfolio';
import PublicProfile from './pages/PublicProfile';
import KPIDashboard from './pages/KPIDashboard';
import Documentation from './pages/Documentation';
import ComingSoon from './pages/ComingSoon';
import { ToastContainer } from './components/Toast';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <ToastContainer />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agents" element={<Navigate to="/markets" replace />} />
          <Route path="/agents/:id" element={<Navigate to="/markets/:id" replace />} />
          
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/profile/:address" element={<PublicProfile />} />
          <Route path="/dashboard" element={<Navigate to="/portfolio" replace />} /> 
          
          <Route path="/stats" element={<Stats />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/markets/:id" element={<MarketDetail />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/health" element={<KPIDashboard />} />
          <Route path="/documentation" element={<Documentation />} />
          
          {/* New Features */}
          <Route path="/compare" element={<Compare />} />
          <Route path="/indexes" element={<Indexes />} />
          <Route path="/coming-soon" element={<ComingSoon />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
