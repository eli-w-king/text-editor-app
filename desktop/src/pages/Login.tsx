import React, { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Styles -- frosted glass aesthetic matching the mobile app
// ---------------------------------------------------------------------------

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  padding: 40,
  borderRadius: 20,
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 300,
  color: '#ECEDEE',
  marginBottom: 8,
  letterSpacing: -0.5,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'rgba(255, 255, 255, 0.5)',
  marginBottom: 32,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'rgba(255, 255, 255, 0.6)',
  marginBottom: 6,
  letterSpacing: 0.3,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: 16,
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.12)',
  background: 'rgba(255, 255, 255, 0.06)',
  color: '#ECEDEE',
  outline: 'none',
  transition: 'border-color 0.2s, background 0.2s',
  boxSizing: 'border-box' as const,
};

const inputFocusStyle: React.CSSProperties = {
  borderColor: 'rgba(255, 255, 255, 0.3)',
  background: 'rgba(255, 255, 255, 0.1)',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 24px',
  fontSize: 16,
  fontWeight: 600,
  borderRadius: 12,
  border: 'none',
  background: '#ECEDEE',
  color: '#0a0a0a',
  cursor: 'pointer',
  transition: 'opacity 0.2s, transform 0.1s',
  marginTop: 8,
};

const buttonDisabledStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

const errorStyle: React.CSSProperties = {
  background: 'rgba(255, 59, 48, 0.15)',
  border: '1px solid rgba(255, 59, 48, 0.3)',
  borderRadius: 12,
  padding: '10px 14px',
  color: '#FF6B6B',
  fontSize: 13,
  marginBottom: 16,
};

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 20,
};

const footerStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  marginTop: 24,
  fontSize: 14,
  color: 'rgba(236, 237, 238, 0.5)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const linkStyle: React.CSSProperties = {
  color: 'rgba(236, 237, 238, 0.9)',
  textDecoration: 'none',
  fontWeight: 500,
  borderBottom: '1px solid rgba(236, 237, 238, 0.3)',
  paddingBottom: '1px',
  transition: 'border-color 0.2s ease',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Login() {
  const { login, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email.trim() || !password) return;

    try {
      await login(email.trim(), password);
      navigate('/');
    } catch {
      // Error is handled by AuthContext
    }
  };

  const getInputStyle = (field: string): React.CSSProperties => ({
    ...inputStyle,
    ...(focusedField === field ? inputFocusStyle : {}),
  });

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Welcome back</h1>
        <p style={subtitleStyle}>Sign in to your Writer account</p>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle} htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle('email')}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle} htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle('password')}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            style={{
              ...buttonStyle,
              ...(isLoading ? buttonDisabledStyle : {}),
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={footerStyle}>
          Don't have an account?{' '}
          <Link to="/register" style={linkStyle}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
