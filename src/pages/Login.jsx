import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';

function Login({ setUser }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode');

  const [mode, setMode] = useState(initialMode || 'signin'); // 'signin', 'signup', 'verify'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [hintCode, setHintCode] = useState('');

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const sendVerificationEmail = async (email, code) => {
    try {
      const response = await fetch('/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const result = await response.json();
      return result;
    } catch (error) {
      return { success: false, error: 'Network error or backend offline' };
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) return showToast('Please enter both email and password.');
    if (password.length < 8) return showToast('Password needs at least 8 characters.');

    const users = JSON.parse(localStorage.getItem('debtEaseUsers') || '{}');
    const user = users[email];

    if (!user || user.password !== password) {
      return showToast('Invalid email or password. Please try again.');
    }

    if (!user.verified) {
      setMode('verify');
      const code = user.verifyCode || Math.floor(100000 + Math.random() * 900000).toString();
      user.verifyCode = code;
      setHintCode(code);
      localStorage.setItem('debtEaseUsers', JSON.stringify(users));

      const emailResult = await sendVerificationEmail(email, code);
      if (emailResult.success) {
        showToast('Verification code sent to your inbox.');
      } else {
        showToast(`${emailResult.error}. Used mock code.`);
      }
      return;
    }

    localStorage.setItem('debtEaseCurrentUser', email);
    setUser(email);
    navigate('/dashboard');
  };

  const handleSignUp = async () => {
    if (!email || !password) return showToast('Please fill in both email and password.');
    if (password.length < 8) return showToast('Password needs at least 8 characters.');

    const users = JSON.parse(localStorage.getItem('debtEaseUsers') || '{}');
    if (users[email]) {
      return showToast('This email is already registered. Please sign in.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    users[email] = { password, verified: false, verifyCode: code };
    localStorage.setItem('debtEaseUsers', JSON.stringify(users));

    setHintCode(code);
    setMode('verify');

    const emailResult = await sendVerificationEmail(email, code);
    if (emailResult.success) {
      showToast('Verification code sent to your inbox.');
    } else {
      showToast(`${emailResult.error}. Used mock code.`);
    }
  };

  const handleVerify = () => {
    const codeStr = verifyCode.join('');
    if (codeStr.length !== 6) return showToast('Please enter the full 6-digit code.');

    const users = JSON.parse(localStorage.getItem('debtEaseUsers') || '{}');
    const user = users[email];

    if (!user) return showToast('Account not found. Please sign up.');

    if (codeStr !== user.verifyCode) {
      return showToast('The code is incorrect. Please try again.');
    }

    user.verified = true;
    delete user.verifyCode;
    localStorage.setItem('debtEaseUsers', JSON.stringify(users));

    localStorage.setItem('debtEaseCurrentUser', email);
    setUser(email);
    navigate('/dashboard');
    showToast('Email verified successfully. Welcome to DebtEase!');
  };

  const handleCodeChange = (index, val) => {
    const newCode = [...verifyCode];
    newCode[index] = val.replace(/[^0-9]/g, '');
    setVerifyCode(newCode);

    if (val && index < 5) {
      document.getElementById(`codeDigit${index + 1}`)?.focus();
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      document.getElementById(`codeDigit${index - 1}`)?.focus();
    }
  };

  return (
    <>
      <Topbar />
      <section className="page-section active">
        {mode === 'signin' && (
          <div className="auth-panel">
            <div className="info-badge">Welcome back to DebtEase</div>
            <h2>Sign in</h2>
            <p>Continue to your settlement workspace with secure authentication and instant access to your dashboard.</p>
            <button className="auth-secondary" onClick={() => showToast('OAuth coming soon.')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21.35 11.1h-9.35v2.8h5.35c-.4 2.2-2.4 3.45-5.1 3.45-3.45 0-6.35-2.8-6.35-6.3s2.9-6.3 6.35-6.3c1.8 0 3.35.7 4.35 1.85l2.25-2.2c-1.6-1.5-3.75-2.45-6.6-2.45-5 0-9.1 4.05-9.1 9.05s4.1 9.05 9.1 9.05c4.75 0 8.8-3.35 8.8-8.05z" fill="currentColor" /></svg>
              &nbsp;Continue with Google
            </button>
            <div className="auth-divider">or use your email</div>
            <div className="form-row">
              <div className="input-group">
                <label>Email address</label>
                <input type="email" placeholder="hello@you.com" value={email} onChange={e => setEmail(e.target.value.toLowerCase())} />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} />
                <div className="input-icon">
                  <button type="button" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3.98 8.78l1.4 1.4a10.88 10.88 0 0 0-1.85 1.88 1.06 1.06 0 0 0 0 1.15A16.77 16.77 0 0 0 12 19c2.22 0 4.32-.57 6.16-1.57l1.4 1.4a1 1 0 0 0 1.42-1.41L5.4 7.37a1 1 0 0 0-1.42 1.41Zm8.02 7.82a5 5 0 0 1-5-5c0-.95.27-1.84.73-2.6l6.87 6.87A4.96 4.96 0 0 1 12 16.6Zm5.64-2.98a10.84 10.84 0 0 0 1.28-1.64 1.06 1.06 0 0 0 0-1.15 16.84 16.84 0 0 0-2.59-2.73l1.4-1.4A.99.99 0 0 0 17.6 6.9L5.4 19.1a.99.99 0 0 0 1.4 1.4l3.06-3.06A10.9 10.9 0 0 0 12 19c2.22 0 4.32-.57 6.16-1.57l1.4 1.4a1 1 0 0 0 1.42-1.41L17.64 13.02Z" fill="currentColor" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" fill="currentColor" /></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            {password.length > 0 && password.length < 8 && <p className="password-error" style={{ display: 'block' }}>Your password must contain 8 or more characters.</p>}
            <button className="auth-button" onClick={handleSignIn} style={{ marginTop: '16px' }}>Sign in</button>
            <button className="button-secondary" style={{ width: '100%', marginTop: '14px' }} onClick={() => navigate('/')}>Back to homepage</button>
            <p className="auth-alt">Don't have an account? <button onClick={() => setMode('signup')}>Sign up</button></p>
            <p className="helper-text">By signing in, you agree to the DebtEase terms and privacy policy.</p>
          </div>
        )}

        {mode === 'signup' && (
          <div className="auth-panel">
            <div className="info-badge">Create your DebtEase account</div>
            <h2>Sign up</h2>
            <p>Welcome! Use your email to create an account, then verify your address using the code sent to your inbox.</p>
            <button className="auth-secondary" onClick={() => showToast('OAuth coming soon.')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21.35 11.1h-9.35v2.8h5.35c-.4 2.2-2.4 3.45-5.1 3.45-3.45 0-6.35-2.8-6.35-6.3s2.9-6.3 6.35-6.3c1.8 0 3.35.7 4.35 1.85l2.25-2.2c-1.6-1.5-3.75-2.45-6.6-2.45-5 0-9.1 4.05-9.1 9.05s4.1 9.05 9.1 9.05c4.75 0 8.8-3.35 8.8-8.05z" fill="currentColor" /></svg>
              &nbsp;Continue with Google
            </button>
            <div className="auth-divider">or create with email</div>
            <div className="form-row">
              <div className="input-group">
                <label>Email address</label>
                <input type="email" placeholder="hello@you.com" value={email} onChange={e => setEmail(e.target.value.toLowerCase())} />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input type="password" placeholder="Create a password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
            <p className="password-hint">Your password should contain at least <strong>8 characters</strong>.</p>
            {password.length > 0 && password.length < 8 && <p className="password-error" style={{ display: 'block' }}>Your password must contain 8 or more characters.</p>}
            <button className="auth-button" onClick={handleSignUp} style={{ marginTop: '16px' }}>Continue</button>
            <button className="button-secondary" style={{ width: '100%', marginTop: '14px' }} onClick={() => navigate('/')}>Back to homepage</button>
            <p className="auth-alt">Already have an account? <button onClick={() => setMode('signin')}>Sign in</button></p>
            <p className="helper-text">Once verified, your dashboard will open with the latest settlement summary.</p>
          </div>
        )}

        {mode === 'verify' && (
          <div className="verification-panel">
            <div className="info-badge">Verify your email</div>
            <h2>Verify your email</h2>
            <p>Enter the 6-digit code sent to the email address below to activate your DebtEase account.</p>
            <p className="verification-email">{email}</p>
            {hintCode && (
              <p className="verification-note" style={{ display: 'block', color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                (Demo mode) Your verification code is: <strong style={{ color: 'var(--text)' }}>{hintCode}</strong>
              </p>
            )}
            <div className="verification-grid">
              {verifyCode.map((digit, index) => (
                <input
                  key={index}
                  id={`codeDigit${index}`}
                  className="code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(index, e)}
                  autoComplete="one-time-code"
                />
              ))}
            </div>
            <div className="verification-actions">
              <button className="auth-button" onClick={handleVerify}>Continue</button>
              <button onClick={async () => {
                const users = JSON.parse(localStorage.getItem('debtEaseUsers') || '{}');
                const user = users[email];
                if (user) {
                  const code = Math.floor(100000 + Math.random() * 900000).toString();
                  user.verifyCode = code;
                  setHintCode(code);
                  localStorage.setItem('debtEaseUsers', JSON.stringify(users));

                  const emailResult = await sendVerificationEmail(email, code);
                  if (emailResult.success) {
                    showToast('Fresh code sent to your inbox.');
                  } else {
                    showToast(`${emailResult.error}. Used mock hint.`);
                  }
                }
              }} style={{ border: 'none', background: 'transparent', color: '#c4b5fd', fontWeight: 700, cursor: 'pointer', marginTop: '14px' }}>Resend code</button>
            </div>
            <button className="button-secondary" style={{ width: '100%', marginTop: '24px' }} onClick={() => navigate('/')}>Back to homepage</button>
          </div>
        )}
      </section>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}

export default Login;
