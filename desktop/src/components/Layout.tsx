import { Outlet } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import WatercolorBackground from '@/components/WatercolorBackground';
import ThemeToggle from '@/components/ThemeToggle';

/**
 * Responsive layout shell -- works from 320px to 2560px wide.
 *
 * Mirrors the mobile app's layered architecture:
 *   1. Background color (Colors[theme].background)
 *   2. Watercolor dot layer
 *   3. Heavy blur layer (100px + 60px blur on mobile)
 *   4. Content layer
 *
 * On desktop we achieve the same frosted look with:
 *   - A canvas-drawn watercolor background
 *   - A full-screen backdrop-blur overlay
 *   - Content rendered on top
 */
export default function Layout() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <div
      data-theme={theme}
      className="min-h-screen relative"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Layer 1: Watercolor ambient dots */}
      <WatercolorBackground />

      {/* Layer 2: Frosted glass blur overlay -- replicates the double BlurView */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backdropFilter: 'blur(80px)',
          WebkitBackdropFilter: 'blur(80px)',
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* Layer 3: Content */}
      <div className="relative flex flex-col min-h-screen" style={{ zIndex: 2 }}>
        {/* Top navigation bar */}
        <header className="sticky top-0 z-50">
          {/* Tiered blur header -- matches mobile's layered BlurView header */}
          <div
            className="absolute inset-x-0 top-0 h-20 pointer-events-none"
            style={{
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              maskImage: 'linear-gradient(to bottom, black 60%, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent)',
            }}
            aria-hidden="true"
          />
          <nav className="relative flex items-center justify-between px-5 py-4 max-w-screen-2xl mx-auto">
            {/* Logo / app name */}
            <a
              href="/"
              className="text-lg font-medium tracking-wide no-underline"
              style={{
                color: 'var(--text)',
                fontFamily: "'Lora', Georgia, serif",
              }}
            >
              Writer
            </a>

            {/* Nav actions */}
            <div className="flex items-center gap-3">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </nav>
        </header>

        {/* Main content area -- responsive container */}
        <main className="flex-1 w-full max-w-screen-2xl mx-auto px-5 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
