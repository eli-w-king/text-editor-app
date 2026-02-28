// PLATFORM: Web (Desktop/Browser)
// COUNTERPART: components/auth/RegisterScreen.tsx (Mobile -- React Native/Expo)
// These files serve different platforms and share the same API contract.
// Changes to the auth API contract should be applied to both files.
//
// DESIGN: Premium visionOS-inspired frosted glass aesthetic.
// Light mode: warm, pale, almost-white gradients with frosted glass.
// Dark mode: deep charcoal-to-black gradient with blue/purple undertones.
// Uses Lora (serif) for headings, Inter/system for body/UI.
// Matches Login.tsx design structure exactly.

import React, { useState, useCallback, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// SSR-safe helpers
// ---------------------------------------------------------------------------

/**
 * Check if code is running in a browser environment.
 * Used to guard localStorage and matchMedia access.
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

// ---------------------------------------------------------------------------
// Theme detection -- reads stored preference or system preference
// SSR-safe: defaults to false (light mode) in non-browser environments.
// ---------------------------------------------------------------------------

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => {
    if (!isBrowser()) return false;
    try {
      const stored = localStorage.getItem('writer-theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch {
      // localStorage may not be available
    }
    try {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    if (!isBrowser()) return;

    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }

    const handler = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem('writer-theme');
        if (!stored) setDark(e.matches);
      } catch {
        // ignore
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return dark;
}

// ---------------------------------------------------------------------------
// Theme palettes -- inspired by visionOS glass surfaces
// Extends Login.tsx palette with Register-specific tokens:
//   hintText         -- muted text for password requirement hint
//   fieldError       -- field-level validation error text color
//   inputErrorBorder -- red-tinted border for invalid fields
// ---------------------------------------------------------------------------

interface ThemePalette {
  pageGradient: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  cardInnerGlow: string;
  title: string;
  subtitle: string;
  label: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputFocusBg: string;
  inputFocusBorder: string;
  inputFocusGlow: string;
  inputErrorBorder: string;
  buttonBg: string;
  buttonText: string;
  buttonHoverBg: string;
  buttonShadow: string;
  buttonHoverShadow: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  hintText: string;
  fieldError: string;
  footerText: string;
  linkText: string;
  linkHoverBorder: string;
}

const lightPalette: ThemePalette = {
  pageGradient:
    'linear-gradient(145deg, #faf9f7 0%, #f5f0eb 30%, #efe8e0 60%, #f2ede7 100%)',
  cardBg: 'rgba(255, 255, 255, 0.55)',
  cardBorder: 'rgba(255, 255, 255, 0.7)',
  cardShadow:
    '0 12px 64px rgba(0, 0, 0, 0.06), 0 2px 16px rgba(0, 0, 0, 0.04)',
  cardInnerGlow:
    'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.1) 100%)',
  title: '#1C1C1E',
  subtitle: 'rgba(28, 28, 30, 0.45)',
  label: 'rgba(28, 28, 30, 0.45)',
  inputBg: 'rgba(0, 0, 0, 0.03)',
  inputBorder: 'rgba(0, 0, 0, 0.08)',
  inputText: '#1C1C1E',
  inputFocusBg: 'rgba(0, 0, 0, 0.05)',
  inputFocusBorder: 'rgba(0, 0, 0, 0.15)',
  inputFocusGlow: '0 0 0 4px rgba(0, 0, 0, 0.04)',
  inputErrorBorder: 'rgba(255, 59, 48, 0.35)',
  buttonBg: '#1C1C1E',
  buttonText: '#FFFFFF',
  buttonHoverBg: '#2C2C2E',
  buttonShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
  buttonHoverShadow: '0 6px 28px rgba(0, 0, 0, 0.18)',
  errorBg: 'rgba(255, 59, 48, 0.06)',
  errorBorder: 'rgba(255, 59, 48, 0.12)',
  errorText: 'rgba(200, 40, 35, 0.8)',
  hintText: 'rgba(28, 28, 30, 0.35)',
  fieldError: 'rgba(200, 40, 35, 0.8)',
  footerText: 'rgba(28, 28, 30, 0.35)',
  linkText: 'rgba(28, 28, 30, 0.6)',
  linkHoverBorder: 'rgba(28, 28, 30, 0.3)',
};

const darkPalette: ThemePalette = {
  pageGradient:
    'linear-gradient(145deg, #0c0c0e 0%, #111118 30%, #0e1117 60%, #0a0a10 100%)',
  cardBg: 'rgba(255, 255, 255, 0.06)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  cardShadow:
    '0 16px 72px rgba(0, 0, 0, 0.5), 0 2px 20px rgba(0, 0, 0, 0.3)',
  cardInnerGlow:
    'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%)',
  title: '#ECEDEE',
  subtitle: 'rgba(236, 237, 238, 0.4)',
  label: 'rgba(236, 237, 238, 0.4)',
  inputBg: 'rgba(255, 255, 255, 0.05)',
  inputBorder: 'rgba(255, 255, 255, 0.08)',
  inputText: '#ECEDEE',
  inputFocusBg: 'rgba(255, 255, 255, 0.08)',
  inputFocusBorder: 'rgba(255, 255, 255, 0.18)',
  inputFocusGlow: '0 0 0 4px rgba(255, 255, 255, 0.04)',
  inputErrorBorder: 'rgba(255, 59, 48, 0.4)',
  buttonBg: 'rgba(255, 255, 255, 0.95)',
  buttonText: '#0c0c0e',
  buttonHoverBg: 'rgba(255, 255, 255, 1)',
  buttonShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
  buttonHoverShadow: '0 8px 36px rgba(0, 0, 0, 0.4)',
  errorBg: 'rgba(255, 59, 48, 0.08)',
  errorBorder: 'rgba(255, 59, 48, 0.15)',
  errorText: 'rgba(255, 120, 110, 0.9)',
  hintText: 'rgba(236, 237, 238, 0.3)',
  fieldError: 'rgba(255, 120, 110, 0.9)',
  footerText: 'rgba(236, 237, 238, 0.3)',
  linkText: 'rgba(236, 237, 238, 0.6)',
  linkHoverBorder: 'rgba(236, 237, 238, 0.4)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Register() {
  // isSubmitting tracks whether a register API call is in-flight.
  // This is separate from isLoading (initial mount session check).
  // By the time this component renders (inside GuestOnly guard),
  // isLoading is already false. We use isSubmitting for button
  // disabled state, input disabled state, and loading text.
  const { register, error, clearError, isSubmitting } = useAuth();
  const navigate = useNavigate();
  const isDark = usePrefersDark();
  const p = isDark ? darkPalette : lightPalette;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoveredButton, setHoveredButton] = useState(false);

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !isSubmitting;

  // Clear a single field-level error
  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Clear the AuthContext error whenever the user types in any field
  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      clearFieldError('email');
      if (error) clearError();
    },
    [error, clearError, clearFieldError],
  );

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
      clearFieldError('password');
      if (error) clearError();
    },
    [error, clearError, clearFieldError],
  );

  const handleConfirmPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmPassword(e.target.value);
      clearFieldError('confirmPassword');
      if (error) clearError();
    },
    [error, clearError, clearFieldError],
  );

  // Client-side validation
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validate()) return;

    // register() returns true on success, false on failure.
    // It does NOT throw -- errors are set in context state and
    // rendered via the error binding above. We only navigate
    // on success to avoid an unnecessary redirect cycle.
    const success = await register(email.trim(), password);
    if (success) {
      navigate('/');
    }
  };

  // -----------------------------------------------------------------------
  // Styles -- all inline React.CSSProperties, theme-aware
  // -----------------------------------------------------------------------

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: p.pageGradient,
    fontFamily:
      "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    padding: 24,
    transition: 'background 0.5s ease',
  };

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: 440,
    padding: '52px 48px 44px',
    borderRadius: 28,
    background: p.cardBg,
    backdropFilter: 'blur(48px) saturate(160%)',
    WebkitBackdropFilter: 'blur(48px) saturate(160%)',
    border: `1px solid ${p.cardBorder}`,
    boxShadow: p.cardShadow,
    overflow: 'hidden',
    transition: 'box-shadow 0.4s ease, background 0.4s ease',
  };

  // Inner glow overlay -- creates the visionOS light-gradient on the card
  const cardGlowStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: p.cardInnerGlow,
    borderRadius: 28,
    pointerEvents: 'none',
  };

  const cardContentStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
    fontSize: 34,
    fontWeight: 300,
    color: p.title,
    marginBottom: 8,
    letterSpacing: '-0.3px',
    lineHeight: 1.15,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 400,
    color: p.subtitle,
    marginBottom: 40,
    lineHeight: 1.5,
    letterSpacing: '0.1px',
  };

  const fieldGroupStyle: React.CSSProperties = {
    marginBottom: 24,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: p.label,
    marginBottom: 8,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
  };

  const getInputStyle = (field: string): React.CSSProperties => {
    const isFocused = focusedField === field;
    const hasError = !!fieldErrors[field];
    return {
      width: '100%',
      padding: '16px 18px',
      fontSize: 15,
      fontWeight: 400,
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      borderRadius: 14,
      border: `1px solid ${
        hasError
          ? p.inputErrorBorder
          : isFocused
            ? p.inputFocusBorder
            : p.inputBorder
      }`,
      background: isFocused ? p.inputFocusBg : p.inputBg,
      color: p.inputText,
      outline: 'none',
      boxShadow: isFocused ? p.inputFocusGlow : 'none',
      transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
      boxSizing: 'border-box' as const,
      letterSpacing: '0.1px',
    };
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 400,
    color: p.hintText,
    marginTop: 8,
    letterSpacing: '0.1px',
    lineHeight: 1.4,
  };

  const fieldErrorStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 400,
    color: p.fieldError,
    marginTop: 8,
    letterSpacing: '0.1px',
    lineHeight: 1.4,
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '16px 24px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    borderRadius: 14,
    border: 'none',
    background: hoveredButton && canSubmit ? p.buttonHoverBg : p.buttonBg,
    color: p.buttonText,
    cursor: canSubmit ? 'pointer' : 'not-allowed',
    opacity: canSubmit ? 1 : 0.45,
    boxShadow:
      hoveredButton && canSubmit ? p.buttonHoverShadow : p.buttonShadow,
    transform:
      hoveredButton && canSubmit ? 'translateY(-1px)' : 'translateY(0)',
    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    marginTop: 8,
    letterSpacing: '0.2px',
  };

  const errorContainerStyle: React.CSSProperties = {
    background: p.errorBg,
    border: `1px solid ${p.errorBorder}`,
    borderRadius: 14,
    padding: '14px 18px',
    marginBottom: 24,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'all 0.35s ease',
  };

  const errorTextStyle: React.CSSProperties = {
    color: p.errorText,
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.1px',
  };

  const footerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
    fontWeight: 400,
    color: p.footerText,
    letterSpacing: '0.1px',
  };

  const linkStyle: React.CSSProperties = {
    color: p.linkText,
    textDecoration: 'none',
    fontWeight: 500,
    transition: 'all 0.3s ease',
    borderBottom: '1px solid transparent',
    paddingBottom: 1,
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Inner glow overlay for visionOS-style surface sheen */}
        <div style={cardGlowStyle} />

        <div style={cardContentStyle}>
          <h1 style={titleStyle}>Create Account</h1>
          <p style={subtitleStyle}>Start your writing journey with Inlay</p>

          {error && (
            <div style={errorContainerStyle}>
              <span style={errorTextStyle}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle} htmlFor="register-email">
                Email
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                style={getInputStyle('email')}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isSubmitting}
                required
              />
              {fieldErrors.email && (
                <p style={fieldErrorStyle}>{fieldErrors.email}</p>
              )}
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle} htmlFor="register-password">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                style={getInputStyle('password')}
                placeholder="Create a password"
                autoComplete="new-password"
                disabled={isSubmitting}
                required
              />
              {fieldErrors.password ? (
                <p style={fieldErrorStyle}>{fieldErrors.password}</p>
              ) : (
                <p style={hintStyle}>Must be at least 8 characters</p>
              )}
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle} htmlFor="register-confirm-password">
                Confirm Password
              </label>
              <input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
                style={getInputStyle('confirmPassword')}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                disabled={isSubmitting}
                required
              />
              {fieldErrors.confirmPassword && (
                <p style={fieldErrorStyle}>{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              style={buttonStyle}
              disabled={!canSubmit}
              onMouseEnter={() => setHoveredButton(true)}
              onMouseLeave={() => setHoveredButton(false)}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p style={footerStyle}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={linkStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderBottomColor = p.linkHoverBorder;
                e.currentTarget.style.color = p.linkText;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderBottomColor = 'transparent';
              }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
