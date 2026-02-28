/**
 * Writer Desktop -- Shared Design System
 *
 * This file mirrors the mobile app's frosted glass aesthetic.
 * Design tokens are extracted directly from the React Native codebase:
 *   - constants/theme.ts  (Colors, Fonts)
 *   - styles/index.js     (component styles, spacing)
 *   - App.js              (glassmorphism layers, watercolor color families)
 *   - components/FloatingMenu.tsx (blur + transparency patterns)
 *
 * The mobile app uses multi-layered expo-blur BlurViews to create
 * a frosted glass effect. On web, we replicate this with CSS
 * backdrop-filter: blur() and semi-transparent backgrounds.
 */

// ---------------------------------------------------------------------------
//  Color Palette -- exactly matching mobile constants/theme.ts
// ---------------------------------------------------------------------------

export const Colors = {
  light: {
    text: '#1C1C1E',
    background: '#E8E8ED',
    surface: '#F9F9F9',
    tint: '#0a7ea4',
    icon: '#636366',
    textSecondary: '#636366',
    textMuted: '#8E8E93',
    textPlaceholder: '#9ca3af',
    border: 'rgba(0, 0, 0, 0.1)',
    borderStrong: 'rgba(0, 0, 0, 0.15)',
    pill: '#E5E5EA',
    input: '#F2F2F7',
    glass: 'rgba(255, 255, 255, 0.3)',
    glassStrong: 'rgba(255, 255, 255, 0.6)',
    overlay: 'rgba(0, 0, 0, 0.08)',
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    buttonPrimary: '#000000',
    buttonPrimaryText: '#FFFFFF',
  },
  dark: {
    text: '#ECEDEE',
    background: '#000000',
    surface: '#0a0a0a',
    tint: '#FFFFFF',
    icon: '#9BA1A6',
    textSecondary: '#9BA1A6',
    textMuted: '#8E8E93',
    textPlaceholder: '#636366',
    border: 'rgba(255, 255, 255, 0.1)',
    borderStrong: 'rgba(255, 255, 255, 0.2)',
    pill: '#2C2C2E',
    input: '#1C1C1E',
    glass: 'rgba(40, 40, 42, 0.5)',
    glassStrong: 'rgba(21, 23, 24, 0.3)',
    overlay: 'rgba(255, 255, 255, 0.12)',
    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    buttonPrimary: '#FFFFFF',
    buttonPrimaryText: '#000000',
  },
} as const;

// ---------------------------------------------------------------------------
//  Watercolor Dot Color Families -- from App.js colorFamilies
// ---------------------------------------------------------------------------

export const colorFamilies = {
  burntOrange: [
    '#8B4513', // Saddle brown
    '#A0522D', // Sienna
    '#B7410E', // Rust
    '#CC5500', // Burnt orange
    '#D2691E', // Chocolate
    '#964B00', // Brown
    '#8B3A00', // Dark burnt orange
    '#A45A2A', // Windsor tan
  ],
  darkBlue: [
    '#191970', // Midnight blue
    '#000080', // Navy
    '#1B1B6A', // Dark royal blue
    '#1C2951', // Space cadet
    '#002147', // Oxford blue
    '#1D3461', // Prussian blue
    '#1A237E', // Indigo dye
    '#0D1B2A', // Rich black
  ],
  bloodRed: [
    '#660000', // Blood red dark
    '#8B0000', // Dark red
    '#800000', // Maroon
    '#6B0F1A', // Rosewood
    '#722F37', // Wine
    '#7B3B3B', // Roast coffee
    '#701C1C', // Persian plum
    '#5C0A0A', // Sangria
  ],
  deepPurple: [
    '#301934', // Dark purple
    '#4A0E4E', // Byzantium purple
    '#2E0854', // Russian violet
    '#3C1361', // Persian indigo
    '#4B0082', // Indigo
    '#371E4E', // English violet
    '#2D1B3D', // Dark byzantium
    '#432C6B', // Spanish violet
  ],
} as const;

export type ColorFamilyName = keyof typeof colorFamilies;

// ---------------------------------------------------------------------------
//  Fonts -- from constants/theme.ts web configuration
// ---------------------------------------------------------------------------

export const Fonts = {
  sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
} as const;

// ---------------------------------------------------------------------------
//  Typography Scale -- derived from styles/index.js
// ---------------------------------------------------------------------------

export const Typography = {
  /** Main editor title -- styles.headerTitle */
  title: {
    fontFamily: Fonts.serif,
    fontSize: '42px',
    fontWeight: '400' as const,
    letterSpacing: '-0.5px',
    lineHeight: '1.2',
  },
  /** Page / section heading */
  heading: {
    fontFamily: Fonts.sans,
    fontSize: '22px',
    fontWeight: '400' as const,
    letterSpacing: '0.5px',
    lineHeight: '1.4',
  },
  /** Editor body text -- styles.editor */
  body: {
    fontFamily: Fonts.serif,
    fontSize: '18px',
    fontWeight: '400' as const,
    lineHeight: '28px',
  },
  /** Note list item title */
  listTitle: {
    fontFamily: Fonts.sans,
    fontSize: '17px',
    fontWeight: '500' as const,
    lineHeight: '1.4',
  },
  /** Note list item preview / secondary text */
  listSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: '15px',
    fontWeight: '400' as const,
    lineHeight: '1.4',
  },
  /** Small labels -- FloatingMenu labels */
  label: {
    fontFamily: Fonts.sans,
    fontSize: '14px',
    fontWeight: '500' as const,
    lineHeight: '1.3',
  },
  /** Tiny labels */
  caption: {
    fontFamily: Fonts.sans,
    fontSize: '12px',
    fontWeight: '400' as const,
    lineHeight: '1.3',
  },
  /** Monospace for debug / code */
  mono: {
    fontFamily: Fonts.mono,
    fontSize: '13px',
    fontWeight: '400' as const,
    lineHeight: '1.5',
  },
} as const;

// ---------------------------------------------------------------------------
//  Spacing -- derived from styles/index.js padding values
// ---------------------------------------------------------------------------

export const Spacing = {
  /** Editor horizontal padding */
  editorX: 24,
  /** Standard side padding */
  pageX: 20,
  /** Content max-width for readability on wide screens */
  maxContentWidth: 720,
  /** Max width for full layout */
  maxLayoutWidth: 1200,
} as const;

// ---------------------------------------------------------------------------
//  Border Radius -- from styles/index.js
// ---------------------------------------------------------------------------

export const Radius = {
  pill: 20,
  card: 12,
  modal: 20,
  button: 12,
  input: 12,
  circle: 9999,
} as const;

// ---------------------------------------------------------------------------
//  Glassmorphism presets -- CSS equivalents of mobile BlurView layers
// ---------------------------------------------------------------------------

export const Glass = {
  /** Standard glass panel -- FloatingMenu bg style */
  panel: {
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
  },
  /** Heavy blur -- main content blur layers (intensity 100 + 60) */
  heavy: {
    backdropFilter: 'blur(100px)',
    WebkitBackdropFilter: 'blur(100px)',
  },
  /** Medium blur -- saved notes overlay (intensity 25) */
  medium: {
    backdropFilter: 'blur(25px)',
    WebkitBackdropFilter: 'blur(25px)',
  },
  /** Light blur -- header fade layers */
  light: {
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
} as const;

// ---------------------------------------------------------------------------
//  Shadows -- derived from FloatingMenu shadowColor/shadowOffset/shadowOpacity
// ---------------------------------------------------------------------------

export const Shadows = {
  glass: '0 2px 8px rgba(0, 0, 0, 0.1)',
  elevated: '0 8px 32px rgba(0, 0, 0, 0.12)',
  subtle: '0 1px 3px rgba(0, 0, 0, 0.06)',
} as const;

// ---------------------------------------------------------------------------
//  Transitions -- matching Easing.bezier(0.4, 0.0, 0.2, 1) from mobile
// ---------------------------------------------------------------------------

export const Transitions = {
  easeSmooth: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  fast: '200ms',
  normal: '300ms',
  slow: '500ms',
  /** Standard transition shorthand */
  default: 'all 300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
} as const;

// ---------------------------------------------------------------------------
//  System Colors
// ---------------------------------------------------------------------------

export const SystemColors = {
  danger: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
} as const;

// ---------------------------------------------------------------------------
//  Breakpoints -- responsive from 320px to 2560px
// ---------------------------------------------------------------------------

export const Breakpoints = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  '3xl': 2560,
} as const;

// ---------------------------------------------------------------------------
//  Helper: get theme-aware colors
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark';

export function getThemeColors(theme: Theme) {
  return Colors[theme];
}

// ---------------------------------------------------------------------------
//  Helper: get random color from a family (mirrors App.js getColorFromTokens)
// ---------------------------------------------------------------------------

export function getRandomColorFamily(): ColorFamilyName {
  const families = Object.keys(colorFamilies) as ColorFamilyName[];
  return families[Math.floor(Math.random() * families.length)];
}

export function getColorFromFamily(family: ColorFamilyName, intensity: number = 0.5): string {
  const colors = colorFamilies[family];
  const normalized = Math.max(0, Math.min(1, intensity));
  const index = Math.floor(normalized * (colors.length - 1));
  return colors[index];
}
