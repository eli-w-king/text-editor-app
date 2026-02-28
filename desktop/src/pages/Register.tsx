import React, { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Styles -- frosted glass aesthetic matching Login.tsx
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

const inputErrorStyle: React.CSSProperties = {
  borderColor: 'rgba(255, 59, 48, 0.5)',
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

const linkStyle: React.CSSProperties = {
  color: 'rgba(255, 255, 255, 0.6)',
  fontSize: 14,
  textAlign: 'center' as const,
  marginTop: 24,
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  textDecoration: 'underline',
  display: 'block',
  width: '100%',
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

const fieldHintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255, 255, 255, 0.35)',
  marginTop: 6,
};

const fieldErrorStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#FF6B6B',
  marginTop: 6,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RegisterProps {
  onSwitchToLogin?: () => void;
}

export default function Register({ onSwitchToLogin }: RegisterProps) {
  const { register, error, clearError, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const displayError = localError || error;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    }

    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (!validate()) return;

    try {
      await register(email.trim(), password);
    } catch {
      // Error is handled by AuthContext
    }
  };

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const getInputStyle = (field: string): React.CSSProperties => ({
    ...inputStyle,
    ...(focusedField === field ? inputFocusStyle : {}),
    ...(fieldErrors[field] ? inputErrorStyle : {}),
  });

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Create account</h1>
        <p style={subtitleStyle}>Start writing with Writer</p>

        {displayError && <div style={errorStyle}>{displayError}</div>}

        <form onSubmit={handleSubmit}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle} htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle('email')}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              required
            />
            {fieldErrors.email && <p style={fieldErrorStyle}>{fieldErrors.email}</p>}
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle} htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle('password')}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              disabled={isLoading}
              required
              minLength={8}
            />
            {fieldErrors.password ? (
              <p style={fieldErrorStyle}>{fieldErrors.password}</p>
            ) : (
              <p style={fieldHintStyle}>Must be at least 8 characters</p>
            )}
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle} htmlFor="register-confirm">Confirm password</label>
            <input
              id="register-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
              onFocus={() => setFocusedField('confirm')}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle('confirmPassword')}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              disabled={isLoading}
              required
            />
            {fieldErrors.confirmPassword && (
              <p style={fieldErrorStyle}>{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            style={{
              ...buttonStyle,
              ...(isLoading ? buttonDisabledStyle : {}),
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {onSwitchToLogin && (
          <button style={linkStyle} onClick={onSwitchToLogin} type="button">
            Already have an account? Sign in
          </button>
        )}
      </div>
    </div>
  );
}
