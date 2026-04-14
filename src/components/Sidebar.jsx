import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    to: '/add-expense',
    label: 'Add Expense',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    badge: 'New',
  },
  {
    to: '/net-balances',
    label: 'Net Balances',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    to: '/settlement-plan',
    label: 'Settlement Plan',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/settlement-tracker',
    label: 'Progress Tracker',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    to: '/visualizer',
    label: 'Visualizer',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
      </svg>
    ),
  },
  {
    to: '/what-if',
    label: 'What-If Simulator',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    to: '/vault',
    label: 'Documents',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

function Sidebar({ onSignOut }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { signOut } = useClerk();

  return (
    <aside className="dashboard-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-dot">D</div>
        <div>
          <h3>DebtEase</h3>
          <p>Live settlement workspace.</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="sidebar-menu">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-link${isActive ? ' active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ opacity: isActive ? 1 : 0.65 }}>{item.icon}</span>
                <span>{item.label}</span>
              </span>
              {item.badge && (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg,rgba(124,58,237,0.35),rgba(56,189,248,0.25))',
                  color: '#c4b5fd',
                  border: '1px solid rgba(124,58,237,0.3)',
                  letterSpacing: '0.04em',
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Sign out */}
        <a
          href="#"
          className="sidebar-link"
          onClick={async e => {
            e.preventDefault();
            // Clear local app auth state
            onSignOut();
            // Also sign out of Clerk if a session exists, then land on the homepage
            try {
              await signOut({ redirectUrl: '/' });
            } catch (err) {
              // If Clerk isn't initialized, just navigate home
              navigate('/');
            }
          }}
          style={{ textDecoration: 'none' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ opacity: 0.65 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span>Sign out</span>
          </span>
        </a>

        {/* Reset Data - Purge mock/local data */}
        <div style={{ padding: '0 20px', marginTop: '20px' }}>
            <button
                className="button-secondary"
                style={{ 
                    width: '100%', 
                    padding: '10px', 
                    fontSize: '0.8rem', 
                    borderRadius: '10px', 
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#f87171'
                }}
                onClick={async () => {
                    if (window.confirm('Wipe ALL data? This will delete both local and server storage for a fresh start.')) {
                        localStorage.removeItem('debtEaseExpenses');
                        localStorage.removeItem('debtEaseVault');
                        try {
                            await fetch('/api/reset', { method: 'POST' });
                        } catch(e) {}
                        window.location.href = '/dashboard';
                    }
                }}
            >
                ⚠️ Reset All Data
            </button>
        </div>
      </nav>

      {/* Quick action */}
      <div className="sidebar-section">
        <strong style={{ fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Quick action
        </strong>
        <button
          id="tour-add-expense-manual"
          className="button-primary"
          style={{ width: '100%', padding: '12px', fontSize: '0.92rem', borderRadius: '14px' }}
          onClick={() => navigate('/add-expense')}
        >
          + Add Expense
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
