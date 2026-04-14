import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { useCurrency } from '../utils/CurrencyContext';

function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const { isSignedIn } = useUser();
  const { code, symbol, supported, setCode } = useCurrency();

  const toggleTheme = () => {
    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('debtEaseTheme', 'light');
    } else {
      document.body.classList.add('dark-mode');
      localStorage.setItem('debtEaseTheme', 'dark');
    }
  };

  // After a successful Clerk sign-in from anywhere, funnel the user to the main dashboard.
  useEffect(() => {
    if (!isSignedIn) return;

    // Only auto-redirect from the public landing/login screens.
    if (location.pathname === '/' || location.pathname === '/login') {
      navigate('/dashboard', { replace: true });
    }
  }, [isSignedIn, location.pathname, navigate]);

  return (
    <div className="topbar">
      {isHome ? (
        <button className="back-home-button" style={{ display: 'none' }}>Back</button>
      ) : (
        <button className="back-home-button show" onClick={() => navigate('/')}>Back</button>
      )}
      
      <div className="brand">
        <span className="brand-dot">D</span>
        <div className="brand-info">
          <strong>DebtEase</strong>
          <span>Dashboard • Settlements • Verification</span>
        </div>
      </div>
      
      <div className="topbar-actions">
        <div className="topbar-select-group">
          <select
            className="pill-select"
            value={code}
            onChange={e => setCode(e.target.value)}
            title="Display currency"
          >
            {supported.map(c => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code}
              </option>
            ))}
          </select>
        </div>
        <button className="pill-button" onClick={toggleTheme}>Toggle theme</button>
        <SignedOut>
          {isHome && (
            <SignInButton mode="modal">
              <button className="button-secondary">Sign in</button>
            </SignInButton>
          )}
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </div>
  );
}

export default Topbar;
