import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import './LoginPage.css';

// ─── Types ────────────────────────────────────────────────────
type Screen = 'signin' | 'signup' | 'otp';

interface SignUpForm {
  first_name: string;
  last_name: string;
  email_id: string;
  password: string;
  gender: string;
  country: string;
  phone_number: string;
  city: string;
  current_company: string;
  designation: string;
}

// ─── Helper ───────────────────────────────────────────────────
const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ─── Main Component ───────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [screen, setScreen] = useState<Screen>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Sign-in
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPw, setSignInPw] = useState('');

  const handleGoogleSuccess = async (tokenResponse: { access_token: string }) => {
    clearError();
    setLoading(true);
    try {
      // Exchange Google access_token for the id_token
      const res = await authApi.googleAuth({ id_token: tokenResponse.access_token });
      await login(res.data.access_token);
      navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Google sign-in was cancelled or failed.'),
  });

  // OTP
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '']);

  // Sign-up
  const [signUp, setSignUp] = useState<SignUpForm>({
    first_name: '', last_name: '', email_id: '', password: '',
    gender: '', country: '', phone_number: '', city: '',
    current_company: '', designation: '',
  });

  const clearError = () => setError('');

  // ── Handlers ──────────────────────────────────────────────

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await authApi.signIn({ email_id: signInEmail, password: signInPw });
      const data = res.data as { status: string; access_token?: string; email_id?: string };
      if (data.status === 'pending_verification') {
        setOtpEmail(data.email_id || signInEmail);
        setScreen('otp');
      } else if (data.access_token) {
        await login(data.access_token);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!signUp.gender) { setError('Please select a gender.'); return; }
    setLoading(true);
    try {
      const res = await authApi.signUp(signUp);
      const data = res.data as { email_id?: string };
      setOtpEmail(data.email_id || signUp.email_id);
      setScreen('otp');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpInput = (index: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpCode];
    next[index] = val;
    setOtpCode(next);
    if (val && index < 3) {
      const el = document.getElementById(`otp-${index + 1}`);
      el?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const el = document.getElementById(`otp-${index - 1}`);
      el?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const code = otpCode.join('');
    if (code.length < 4) { setError('Please enter all 4 digits.'); return; }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp({ email_id: otpEmail, otp_code: code });
      await login(res.data.access_token);
      navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Invalid or expired code. Please try again.');
      setOtpCode(['', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="lp-root">
      {/* Left panel */}
      <aside className="lp-brand">
        <div className="lp-brand-inner">
          <div className="lp-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#5B6CFF" />
              <path d="M8 22L16 10L24 22" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.5 18H21.5" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <span className="lp-logo-text">HireAI</span>
          </div>
          <div className="lp-brand-copy">
            <h1>Smarter hiring,<br />powered by AI</h1>
            <p>Upload job descriptions and resumes. Our AI evaluates every candidate in seconds — with scores, strengths, gaps, and clear hire decisions.</p>
          </div>
          <ul className="lp-features">
            {[
              ['⚡', 'Instant AI evaluations'],
              ['🔒', 'Enterprise-grade security'],
              ['📊', 'Data-driven decisions'],
            ].map(([icon, text]) => (
              <li key={text}>
                <span className="lp-feature-icon">{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <div className="lp-brand-footer">
            Trusted by hiring teams worldwide
          </div>
        </div>
        <div className="lp-brand-glow" />
      </aside>

      {/* Right panel */}
      <main className="lp-form-panel">
        <div className="lp-card">

          {/* ── SIGN IN ── */}
          {screen === 'signin' && (
            <>
              <div className="lp-card-header">
                <h2>Welcome back</h2>
                <p>Sign in to your account</p>
              </div>

              <button className="lp-google-btn" disabled={loading} onClick={() => googleLogin()}>
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="lp-divider"><span>or</span></div>

              <form onSubmit={handleSignIn} className="lp-form">
                <div className="lp-field">
                  <label htmlFor="si-email">Email</label>
                  <input
                    id="si-email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    value={signInEmail}
                    onChange={e => setSignInEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="lp-field">
                  <label htmlFor="si-pw">Password</label>
                  <div className="lp-pw-wrap">
                    <input
                      id="si-pw"
                      type={showPw ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      value={signInPw}
                      onChange={e => setSignInPw(e.target.value)}
                      required
                    />
                    <button type="button" className="lp-pw-toggle" onClick={() => setShowPw(p => !p)}>
                      <EyeIcon open={showPw} />
                    </button>
                  </div>
                </div>

                {error && <p className="lp-error">{error}</p>}

                <button type="submit" className="lp-submit" disabled={loading}>
                  {loading ? <span className="lp-spinner" /> : 'Sign In'}
                </button>
              </form>

              <p className="lp-switch">
                Don't have an account?{' '}
                <button type="button" className="lp-link" onClick={() => { setScreen('signup'); clearError(); }}>
                  Create one
                </button>
              </p>
            </>
          )}

          {/* ── SIGN UP ── */}
          {screen === 'signup' && (
            <>
              <div className="lp-card-header">
                <h2>Create account</h2>
                <p>Join HireAI and start evaluating candidates</p>
              </div>

              <form onSubmit={handleSignUp} className="lp-form">
                <div className="lp-row">
                  <div className="lp-field">
                    <label>First Name</label>
                    <input placeholder="John" required value={signUp.first_name}
                      onChange={e => setSignUp(s => ({ ...s, first_name: e.target.value }))} />
                  </div>
                  <div className="lp-field">
                    <label>Last Name</label>
                    <input placeholder="Doe" required value={signUp.last_name}
                      onChange={e => setSignUp(s => ({ ...s, last_name: e.target.value }))} />
                  </div>
                </div>

                <div className="lp-field">
                  <label>Email</label>
                  <input type="email" placeholder="you@company.com" required value={signUp.email_id}
                    onChange={e => setSignUp(s => ({ ...s, email_id: e.target.value }))} />
                </div>

                <div className="lp-field">
                  <label>Password</label>
                  <div className="lp-pw-wrap">
                    <input type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters" required
                      value={signUp.password}
                      onChange={e => setSignUp(s => ({ ...s, password: e.target.value }))} />
                    <button type="button" className="lp-pw-toggle" onClick={() => setShowPw(p => !p)}>
                      <EyeIcon open={showPw} />
                    </button>
                  </div>
                </div>

                <div className="lp-row">
                  <div className="lp-field">
                    <label>Gender</label>
                    <select value={signUp.gender} onChange={e => setSignUp(s => ({ ...s, gender: e.target.value }))} required>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not">Prefer not to say</option>
                    </select>
                  </div>
                  <div className="lp-field">
                    <label>Country</label>
                    <input placeholder="India" required value={signUp.country}
                      onChange={e => setSignUp(s => ({ ...s, country: e.target.value }))} />
                  </div>
                </div>

                <div className="lp-row">
                  <div className="lp-field">
                    <label>Phone</label>
                    <input placeholder="+91 98765 43210" value={signUp.phone_number}
                      onChange={e => setSignUp(s => ({ ...s, phone_number: e.target.value }))} />
                  </div>
                  <div className="lp-field">
                    <label>City</label>
                    <input placeholder="Mumbai" value={signUp.city}
                      onChange={e => setSignUp(s => ({ ...s, city: e.target.value }))} />
                  </div>
                </div>

                <div className="lp-row">
                  <div className="lp-field">
                    <label>Current Company</label>
                    <input placeholder="Acme Inc." value={signUp.current_company}
                      onChange={e => setSignUp(s => ({ ...s, current_company: e.target.value }))} />
                  </div>
                  <div className="lp-field">
                    <label>Designation</label>
                    <input placeholder="HR Manager" value={signUp.designation}
                      onChange={e => setSignUp(s => ({ ...s, designation: e.target.value }))} />
                  </div>
                </div>

                {error && <p className="lp-error">{error}</p>}

                <button type="submit" className="lp-submit" disabled={loading}>
                  {loading ? <span className="lp-spinner" /> : 'Create Account'}
                </button>
              </form>

              <p className="lp-switch">
                Already have an account?{' '}
                <button type="button" className="lp-link" onClick={() => { setScreen('signin'); clearError(); }}>
                  Sign in
                </button>
              </p>
            </>
          )}

          {/* ── OTP VERIFICATION ── */}
          {screen === 'otp' && (
            <>
              <div className="lp-card-header">
                <div className="lp-otp-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <h2>Check your email</h2>
                <p>
                  We sent a 4-digit code to<br />
                  <strong className="lp-otp-email">{otpEmail}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="lp-form">
                <div className="lp-otp-grid">
                  {otpCode.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      className="lp-otp-box"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpInput(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                {error && <p className="lp-error">{error}</p>}

                <button type="submit" className="lp-submit" disabled={loading}>
                  {loading ? <span className="lp-spinner" /> : 'Verify & Continue'}
                </button>
              </form>

              <p className="lp-switch">
                Wrong email?{' '}
                <button type="button" className="lp-link" onClick={() => { setScreen('signup'); clearError(); setOtpCode(['','','','']); }}>
                  Go back
                </button>
              </p>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
