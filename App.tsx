
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import Markets from './pages/Markets';
import MarketDetail from './pages/MarketDetail';
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
          
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/markets/:id" element={<MarketDetail />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
