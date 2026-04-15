import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import Topbar from '../components/Topbar';

function Home() {
  const navigate = useNavigate();

  return (
    <>
      <Topbar />
      <section className="page-section active">
        <div className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Build fair shared finances</span>
            <h1>Settle group expenses with clarity, speed, and style.</h1>
            <p>DebtEase creates a clean settlement experience for friends, roommates, travel groups, and teams — with fewer transactions and clearer balances.</p>
            <div className="button-row">
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="button-primary">Create free account</button>
              </SignUpButton>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="button-secondary">Sign in</button>
              </SignInButton>
            </div>
            <div className="feature-grid">
              <div className="feature-card">
                <h3>Simple onboarding</h3>
                <p>Sign up instantly and verify in seconds with email code delivery.</p>
              </div>
              <div className="feature-card">
                <h3>Clear settlement path</h3>
                <p>Track who owes who with dashboard cards and interactive insights.</p>
              </div>
              <div className="feature-card">
                <h3>Smart consolidation</h3>
                <p>Save time by reducing redundant debt transfers and confusion.</p>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card__visual">
              <img src="https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=900&q=80" alt="Finance mockup" />
            </div>
            <div className="hero-card-grid">
              <div className="hero-card__item">
                <span>Participants</span>
                <strong>122</strong>
              </div>
              <div className="hero-card__item">
                <span>Settlements</span>
                <strong>87</strong>
              </div>
              <div className="hero-card__item">
                <span>Total balance</span>
                <strong>₹398.8k</strong>
              </div>
              <div className="hero-card__item">
                <span>Data source</span>
                <strong>balances.json</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default Home;
