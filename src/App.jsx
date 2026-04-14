import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import Topbar from './components/Topbar';
import { CurrencyProvider } from './utils/CurrencyContext';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Visualizer = lazy(() => import('./pages/Visualizer'));
const NetBalances = lazy(() => import('./pages/NetBalances'));
const AddExpense = lazy(() => import('./pages/AddExpense'));
const SettlementPlan = lazy(() => import('./pages/SettlementPlan'));
const SettlementTracker = lazy(() => import('./pages/SettlementTracker'));
const Vault = lazy(() => import('./pages/Vault'));
const WhatIf = lazy(() => import('./pages/WhatIf'));
const AppAssistant = lazy(() => import('./components/AppAssistant'));

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('debtEaseTheme') || 'dark');
  const [user, setUser] = useState(localStorage.getItem('debtEaseCurrentUser') || null);
  const { isSignedIn, user: clerkUser } = useUser();

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [theme]);

  // When a Clerk session is active, mirror it into the existing local `user` state
  // so the rest of the app (routes, Dashboard props, etc.) continues to work.
  useEffect(() => {
    if (isSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.username || clerkUser.id;
      setUser(email);
      localStorage.setItem('debtEaseCurrentUser', email);
    }
  }, [isSignedIn, clerkUser]);


  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('debtEaseTheme', newTheme);
  };

  const handleSignOut = () => {
    localStorage.removeItem('debtEaseCurrentUser');
    setUser(null);
  };

  return (
    <BrowserRouter>
      <CurrencyProvider>
        <div className="page-wrapper">
          <Suspense fallback={<div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>Loading DebtEase...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login setUser={setUser} />} />
              <Route
                path="/dashboard"
                element={user ? <Dashboard user={user} onSignOut={handleSignOut} /> : <Navigate to="/" />}
              />
              <Route
                path="/visualizer"
                element={user ? <Visualizer onSignOut={handleSignOut} /> : <Navigate to="/" />}
              />
              <Route
                path="/net-balances"
                element={user ? <NetBalances onSignOut={handleSignOut} /> : <Navigate to="/" />}
              />
              <Route
                path="/add-expense"
                element={user ? <AddExpense onSignOut={handleSignOut} /> : <Navigate to="/" />}
              />
              <Route
                path="/settlement-plan"
                element={user ? <SettlementPlan onSignOut={handleSignOut} /> : <Navigate to="/" />}
              />
              <Route
                path="/settlement-tracker"
                element={user ? <SettlementTracker onSignOut={handleSignOut} /> : <Navigate to="/" />}
              />
              <Route
                path="/vault"
                element={user ? <Vault onSignOut={handleSignOut} /> : <Navigate to="/" />}
              />
              <Route
                path="/what-if"
                element={user ? <WhatIf onSignOut={handleSignOut} /> : <Navigate to="/" />}
              />
            </Routes>
            <AppAssistant />
          </Suspense>
        </div>
      </CurrencyProvider>
    </BrowserRouter>
  );
}

export default App;
