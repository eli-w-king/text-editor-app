import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
    padding: '20px',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '20px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  } as React.CSSProperties,
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#ECEDEE',
    textAlign: 'center' as const,
    marginBottom: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '15px',
    color: 'rgba(236, 237, 238, 0.6)',
    textAlign: 'center' as const,
    marginBottom: '32px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  inputGroup: {
    marginBottom: '20px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(236, 237, 238, 0.7)',
    marginBottom: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    color: '#ECEDEE',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    outline: 'none',
    transition: 'border-color 0.2s ease, background 0.2s ease',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  inputFocus: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
    background: 'rgba(255, 255, 255, 0.12)',
  } as React.CSSProperties,
  inputError: {
    borderColor: 'rgba(255, 59, 48, 0.5)',
  } as React.CSSProperties,
  button: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#ECEDEE',
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    marginTop: '8px',
  } as React.CSSProperties,
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  error: {
    background: 'rgba(255, 59, 48, 0.15)',
    border: '1px solid rgba(255, 59, 48, 0.3)',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '20px',
    color: '#FF6B6B',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  fieldHint: {
    fontSize: '12px',
    color: 'rgba(236, 237, 238, 0.4)',
    marginTop: '6px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  fieldError: {
    fontSize: '12px',
    color: '#FF6B6B',
    marginTop: '6px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  footer: {
    textAlign: 'center' as const,
    marginTop: '24px',
    fontSize: '14px',
    color: 'rgba(236, 237, 238, 0.5)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  link: {
    color: 'rgba(236, 237, 238, 0.9)',
    textDecoration: 'none',
    fontWeight: 500,
    borderBottom: '1px solid rgba(236, 237, 238, 0.3)',
    paddingBottom: '1px',
    transition: 'border-color 0.2s ease',
  } as React.CSSProperties,
};

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = 'Email is required.';
    }

    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      await register(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputStyle = (field: string): React.CSSProperties => ({
    ...styles.input,
    ...(focusedField === field ? styles.inputFocus : {}),
    ...(fieldErrors[field] ? styles.inputError : {}),
  });

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create Account</h1>
        <p style={styles.subtitle}>Start your writing journey</p>

        <form onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.inputGroup}>
            <label style={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.email;
                    return next;
                  });
                }
              }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle('email')}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isSubmitting}
            />
            {fieldErrors.email && <p style={styles.fieldError}>{fieldErrors.email}</p>}
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.password;
                    return next;
                  });
                }
              }}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle('password')}
              placeholder="Create a password"
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            {fieldErrors.password ? (
              <p style={styles.fieldError}>{fieldErrors.password}</p>
            ) : (
              <p style={styles.fieldHint}>Must be at least 8 characters</p>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label} htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.confirmPassword;
                    return next;
                  });
                }
              }}
              onFocus={() => setFocusedField('confirmPassword')}
              onBlur={() => setFocusedField(null)}
              style={getInputStyle('confirmPassword')}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            {fieldErrors.confirmPassword && (
              <p style={styles.fieldError}>{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(isSubmitting ? styles.buttonDisabled : {}),
            }}
            disabled={isSubmitting}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            }}
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
