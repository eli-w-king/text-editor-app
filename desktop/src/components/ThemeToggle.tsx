import { useState, useCallback } from 'react';
import { Colors, type Theme } from '../styles/design-system';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

/**
 * Theme toggle button -- mirrors the FloatingMenu's theme switching.
 * Shows a sun/moon icon inside a frosted glass circle.
 *
 * Uses design-system Colors directly instead of CSS custom properties
 * for reliable rendering regardless of CSS context.
 */
export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  const colors = Colors[theme];

  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => { setIsHovered(false); setIsPressed(false); }, []);
  const handleMouseDown = useCallback(() => setIsPressed(true), []);
  const handleMouseUp = useCallback(() => setIsPressed(false), []);

  const bgOpacity = isPressed ? 0.15 : isHovered ? 0.12 : isDark ? 0.07 : 0.35;
  const scale = isPressed ? 0.98 : isHovered ? 1.05 : 1;

  return (
    <button
      onClick={onToggle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        borderRadius: 9999,
        cursor: 'pointer',
        background: `rgba(255, 255, 255, ${bgOpacity})`,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        color: colors.text,
        boxShadow: `0 2px 16px rgba(0, 0, 0, ${isDark ? 0.3 : 0.08}), inset 0 0 0 0.5px rgba(255, 255, 255, ${isDark ? 0.06 : 0.4})`,
        transition: 'all 300ms ease-out',
        transform: `scale(${scale})`,
        appearance: 'none' as const,
        padding: 0,
        outline: 'none',
      }}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Sun icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          opacity: isDark ? 0 : 1,
          transform: isDark ? 'rotate(-90deg) scale(0)' : 'rotate(0) scale(1)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
        }}
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>

      {/* Moon icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          opacity: isDark ? 1 : 0,
          transform: isDark ? 'rotate(0) scale(1)' : 'rotate(90deg) scale(0)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
        }}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
