import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import WatercolorBackground from './WatercolorBackground';
import ThemeToggle from './ThemeToggle';
import { Colors, Fonts, Transitions } from '../styles/design-system';

/**
 * Layout shell for authenticated pages.
 *
 * Mirrors the mobile app's layered architecture:
 *   1. Background color
 *   2. Watercolor ambient layer
 *   3. Heavy blur layer
 *   4. Floating glass nav bar
 *   5. Content area
 *
 * On desktop we replicate the frosted glass look with CSS
 * backdrop-filter: blur() and semi-transparent backgrounds.
 */
export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const colors = Colors[theme];

  // Loading state -- show a themed spinner while checking auth
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.background,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: `2px solid ${colors.border}`,
            borderTopColor: colors.textMuted,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  // Auth guard -- redirect unauthenticated users
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: '100vh',
        position: 'relative',
        backgroundColor: colors.background,
        transition: `background-color ${Transitions.slow} ${Transitions.easeSmooth}`,
      }}
    >
      {/* Layer 1: Watercolor ambient background */}
      <WatercolorBackground />

      {/* Layer 2: Frosted glass blur overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backdropFilter: 'blur(120px) saturate(180%)',
          WebkitBackdropFilter: 'blur(120px) saturate(180%)',
          background: theme === 'dark'
            ? 'rgba(10, 10, 14, 0.4)'
            : 'rgba(240, 239, 237, 0.3)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Layer 3: Content with floating nav */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '100vh', zIndex: 2 }}>
        {/* Floating glass nav bar */}
        <header style={{ position: 'sticky', top: 0, zIndex: 50, pointerEvents: 'none' }}>
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              maxWidth: 680,
              margin: '16px auto 0',
              padding: '10px 20px',
              borderRadius: 22,
              background: theme === 'dark'
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(80px) saturate(180%)',
              WebkitBackdropFilter: 'blur(80px) saturate(180%)',
              border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)'}`,
              boxShadow: theme === 'dark'
                ? '0 8px 40px rgba(0, 0, 0, 0.4), inset 0 0.5px 0 rgba(255, 255, 255, 0.06)'
                : '0 8px 40px rgba(0, 0, 0, 0.06), inset 0 0.5px 0 rgba(255, 255, 255, 0.8)',
              pointerEvents: 'auto',
              transition: `all ${Transitions.slow} ${Transitions.easeSmooth}`,
            }}
          >
            {/* Logo */}
            <a
              href="/"
              style={{
                color: colors.text,
                fontFamily: Fonts.serif,
                fontSize: 19,
                fontWeight: 400,
                textDecoration: 'none',
                opacity: 0.9,
                letterSpacing: '-0.2px',
              }}
            >
              Inlay
            </a>

            {/* Nav actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </nav>
        </header>

        {/* Main content area */}
        <main
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 760,
            margin: '0 auto',
            padding: '24px 20px 48px',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
