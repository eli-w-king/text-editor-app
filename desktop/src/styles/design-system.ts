/**
 * Inlay Desktop -- visionOS-Inspired Design System
 * ============================================================================
 *
 * A premium, luxurious design system inspired by Apple's visionOS spatial
 * computing aesthetic. Every token is crafted to evoke the feeling of
 * frosted glass floating in space -- translucent, luminous, and minimal.
 *
 * Design principles:
 *   1. TRANSLUCENCY FIRST -- Every surface should feel like it has depth.
 *      Glass materials range from ultra-thin wisps to thick frosted panels.
 *   2. MUTED SOPHISTICATION -- No saturated primaries. Colors are soft,
 *      desaturated, and warm. The palette whispers rather than shouts.
 *   3. SPATIAL DEPTH -- Shadows are wide, diffused, and barely visible.
 *      Elements float above the background rather than sitting on it.
 *   4. INTENTIONAL SIMPLICITY -- Controls are tucked away. Every element
 *      on screen earns its place. White space is a feature, not a bug.
 *   5. WARMTH -- Pure white (#FFF) and pure black (#000) are avoided.
 *      Light mode has warm undertones; dark mode uses rich charcoal.
 *
 * References:
 *   - Apple visionOS Human Interface Guidelines (material thicknesses)
 *   - Apple Design Resources (SF color palette, system materials)
 *   - Pinterest aesthetic board: frosted glass, minimal, premium, glassy
 *
 * ============================================================================
 */

// ---------------------------------------------------------------------------
//  Theme type
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark';

// ---------------------------------------------------------------------------
//  Color Palette
//
//  Light mode: Soft, warm whites and off-whites. Apple's signature #F5F5F7
//  background with gentle gray text. Nothing is pure white or pure black --
//  every color has a subtle warmth to it.
//
//  Dark mode: Deep charcoal, never pure black. Surfaces have a slight
//  luminosity that keeps them from feeling flat. Text is warm off-white
//  rather than harsh #FFFFFF.
// ---------------------------------------------------------------------------

export const Colors = {
  light: {
    /** Primary text -- warm near-black, not pure #000 */
    text: '#1D1D1F',
    /** Secondary text -- muted gray for supporting content */
    textSecondary: '#86868B',
    /** Tertiary text -- very subtle, for placeholders and metadata */
    textMuted: '#AEAEB2',
    /** Placeholder text in inputs */
    textPlaceholder: '#C7C7CC',

    /** App background -- Apple's signature warm off-white */
    background: '#F5F5F7',
    /** Elevated surface -- slightly warmer than background */
    surface: '#FFFFFF',
    /** Recessed surface -- for input fields, code blocks */
    surfaceRecessed: '#EFEFF1',

    /** Tint color -- muted Apple blue, less saturated than system blue */
    tint: '#5A8FCC',
    /** Accent color -- subtle warm highlight for interactive elements */
    accent: '#8E7CC3',

    /** Icon default color */
    icon: '#86868B',
    /** Icon on active/highlighted state */
    iconActive: '#1D1D1F',

    /** Borders -- barely visible, just enough to define edges */
    border: 'rgba(0, 0, 0, 0.06)',
    /** Stronger border -- for focused inputs, active cards */
    borderStrong: 'rgba(0, 0, 0, 0.12)',
    /** Subtle border for glass panels -- almost invisible */
    borderGlass: 'rgba(255, 255, 255, 0.5)',

    /** Pill/tag backgrounds */
    pill: '#E8E8ED',
    /** Input field backgrounds */
    input: '#F2F2F7',

    /**
     * Glass materials -- translucent white layers at varying opacities.
     * These map to visionOS material thickness levels.
     */
    glassUltraThin: 'rgba(255, 255, 255, 0.15)',
    glassThin: 'rgba(255, 255, 255, 0.30)',
    glass: 'rgba(255, 255, 255, 0.45)',
    glassThick: 'rgba(255, 255, 255, 0.65)',
    glassUltraThick: 'rgba(255, 255, 255, 0.82)',

    /** Scrim overlays */
    overlay: 'rgba(0, 0, 0, 0.04)',
    modalOverlay: 'rgba(0, 0, 0, 0.3)',

    /** Button styles */
    buttonPrimary: '#1D1D1F',
    buttonPrimaryText: '#F5F5F7',
    buttonSecondary: 'rgba(0, 0, 0, 0.05)',
    buttonSecondaryText: '#1D1D1F',

    /** Separator line -- for lists, dividers */
    separator: 'rgba(0, 0, 0, 0.08)',
  },

  dark: {
    /** Primary text -- warm off-white, not harsh pure white */
    text: '#F5F5F7',
    /** Secondary text -- soft gray */
    textSecondary: '#98989D',
    /** Tertiary text -- muted */
    textMuted: '#636366',
    /** Placeholder text */
    textPlaceholder: '#48484A',

    /** App background -- rich charcoal, never pure black */
    background: '#0A0A0C',
    /** Elevated surface -- slightly luminous */
    surface: '#1C1C1E',
    /** Recessed surface */
    surfaceRecessed: '#141416',

    /** Tint color -- soft luminous blue */
    tint: '#6BAADF',
    /** Accent color -- muted violet glow */
    accent: '#A594D4',

    /** Icon default color */
    icon: '#98989D',
    /** Icon active state */
    iconActive: '#F5F5F7',

    /** Borders -- very subtle white edges */
    border: 'rgba(255, 255, 255, 0.06)',
    /** Stronger border */
    borderStrong: 'rgba(255, 255, 255, 0.12)',
    /** Glass panel border -- subtle luminous edge */
    borderGlass: 'rgba(255, 255, 255, 0.08)',

    /** Pill/tag backgrounds */
    pill: '#2C2C2E',
    /** Input field backgrounds */
    input: '#1C1C1E',

    /**
     * Glass materials -- dark translucent layers.
     * In dark mode, glass panels are slightly lighter than the
     * background to create a "floating above" effect with subtle luminosity.
     */
    glassUltraThin: 'rgba(255, 255, 255, 0.02)',
    glassThin: 'rgba(255, 255, 255, 0.04)',
    glass: 'rgba(255, 255, 255, 0.06)',
    glassThick: 'rgba(255, 255, 255, 0.10)',
    glassUltraThick: 'rgba(255, 255, 255, 0.16)',

    /** Scrim overlays */
    overlay: 'rgba(255, 255, 255, 0.04)',
    modalOverlay: 'rgba(0, 0, 0, 0.6)',

    /** Button styles */
    buttonPrimary: '#F5F5F7',
    buttonPrimaryText: '#0A0A0C',
    buttonSecondary: 'rgba(255, 255, 255, 0.06)',
    buttonSecondaryText: '#F5F5F7',

    /** Separator line */
    separator: 'rgba(255, 255, 255, 0.06)',
  },
} as const;

// ---------------------------------------------------------------------------
//  Fonts
//
//  Typography is central to the premium feel. Inter for UI, Lora for
//  editorial/editor content, JetBrains Mono for code. The font stack
//  falls back gracefully to system fonts on every platform.
// ---------------------------------------------------------------------------

export const Fonts = {
  /** UI font -- clean, modern, highly legible at all sizes */
  sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  /** Editorial/editor font -- elegant, warm, readable at body sizes */
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  /** Code/monospace font */
  mono: "'JetBrains Mono', 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
} as const;

// ---------------------------------------------------------------------------
//  Typography Scale
//
//  Sizes are restrained and deliberate. Large titles use serif for warmth;
//  UI elements use sans-serif for clarity. Letter-spacing is tight on
//  headings (like Apple's marketing typography) and relaxed on body text
//  for comfortable reading.
// ---------------------------------------------------------------------------

export const Typography = {
  /** Hero/display title -- used sparingly, for first impressions */
  display: {
    fontFamily: Fonts.serif,
    fontSize: '56px',
    fontWeight: '400' as const,
    letterSpacing: '-1.5px',
    lineHeight: '1.1',
  },
  /** Main editor title */
  title: {
    fontFamily: Fonts.serif,
    fontSize: '42px',
    fontWeight: '400' as const,
    letterSpacing: '-0.5px',
    lineHeight: '1.2',
  },
  /** Page or section heading */
  heading: {
    fontFamily: Fonts.sans,
    fontSize: '22px',
    fontWeight: '600' as const,
    letterSpacing: '-0.2px',
    lineHeight: '1.35',
  },
  /** Sub-heading */
  subheading: {
    fontFamily: Fonts.sans,
    fontSize: '17px',
    fontWeight: '600' as const,
    letterSpacing: '-0.1px',
    lineHeight: '1.4',
  },
  /** Editor body text -- the most important style, optimized for reading */
  body: {
    fontFamily: Fonts.serif,
    fontSize: '18px',
    fontWeight: '400' as const,
    lineHeight: '30px',
    letterSpacing: '0px',
  },
  /** Compact body -- for denser UI areas */
  bodySmall: {
    fontFamily: Fonts.sans,
    fontSize: '15px',
    fontWeight: '400' as const,
    lineHeight: '22px',
    letterSpacing: '0px',
  },
  /** Note list item title */
  listTitle: {
    fontFamily: Fonts.sans,
    fontSize: '17px',
    fontWeight: '500' as const,
    lineHeight: '1.4',
    letterSpacing: '-0.1px',
  },
  /** Note list item preview / secondary text */
  listSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: '14px',
    fontWeight: '400' as const,
    lineHeight: '1.45',
    letterSpacing: '0px',
  },
  /** Small labels -- menu items, badges, buttons */
  label: {
    fontFamily: Fonts.sans,
    fontSize: '14px',
    fontWeight: '500' as const,
    lineHeight: '1.3',
    letterSpacing: '0px',
  },
  /** Tiny captions -- timestamps, metadata */
  caption: {
    fontFamily: Fonts.sans,
    fontSize: '12px',
    fontWeight: '400' as const,
    lineHeight: '1.35',
    letterSpacing: '0.1px',
  },
  /** Monospace -- code blocks, debug info */
  mono: {
    fontFamily: Fonts.mono,
    fontSize: '13px',
    fontWeight: '400' as const,
    lineHeight: '1.6',
    letterSpacing: '0px',
  },
} as const;

// ---------------------------------------------------------------------------
//  Spacing Scale
//
//  A harmonious 4px-based scale. The editor uses generous padding to
//  let content breathe -- this is key to the premium/luxurious feel.
//  Dense UI is the opposite of luxury; white space is the luxury.
// ---------------------------------------------------------------------------

export const Spacing = {
  /** Micro spacing -- between icon and label, tight gaps */
  xs: 4,
  /** Small spacing -- between related elements */
  sm: 8,
  /** Medium spacing -- default gap, list item padding */
  md: 12,
  /** Standard spacing -- section gaps, card padding */
  lg: 16,
  /** Large spacing -- between major sections */
  xl: 24,
  /** Extra large spacing -- page-level breathing room */
  '2xl': 32,
  /** Generous spacing -- hero sections, onboarding */
  '3xl': 48,
  /** Maximum spacing -- display layouts */
  '4xl': 64,

  /** Editor horizontal padding -- generous for readability */
  editorX: 28,
  /** Standard page side padding */
  pageX: 24,
  /** Content max-width for comfortable reading on wide screens */
  maxContentWidth: 680,
  /** Max width for full layout (sidebar + content) */
  maxLayoutWidth: 1200,
} as const;

// ---------------------------------------------------------------------------
//  Border Radius
//
//  Generously rounded corners are central to the visionOS aesthetic.
//  Larger radii make elements feel softer and more organic. The `window`
//  radius matches visionOS app window corners.
// ---------------------------------------------------------------------------

export const Radius = {
  /** Subtle rounding -- small chips, inline badges */
  xs: 6,
  /** Standard rounding -- buttons, inputs */
  sm: 10,
  /** Card rounding -- content cards, list items */
  md: 14,
  /** Modal/panel rounding -- floating panels, dialogs */
  lg: 20,
  /** Window rounding -- matches visionOS window corners */
  xl: 28,
  /** Pill shape -- tags, status indicators */
  pill: 100,
  /** Full circle */
  circle: 9999,
} as const;

// ---------------------------------------------------------------------------
//  Glassmorphism / Material Tokens
//
//  visionOS defines materials in five thicknesses that control how much
//  of the background bleeds through. We replicate this with CSS
//  backdrop-filter blur values. Higher blur = thicker material = more
//  frosted, less background visible.
//
//  On visionOS, blur values are extremely high (60-120px+). We use
//  similarly aggressive values to achieve that soft, dreamy frosted look.
//
//  Usage:
//    - ultraThin: Ambient overlays, background tints
//    - thin:      Sidebars, secondary panels
//    - regular:   Standard floating panels, menus
//    - thick:     Primary content areas, modals
//    - ultraThick: Full-screen overlays, onboarding cards
// ---------------------------------------------------------------------------

export const Glass = {
  /** Ultra-thin material -- barely frosted, mostly transparent */
  ultraThin: {
    backdropFilter: 'blur(20px) saturate(1.2)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
  },
  /** Thin material -- light frosting, background still visible */
  thin: {
    backdropFilter: 'blur(40px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
  },
  /** Regular material -- standard frosted glass panel */
  regular: {
    backdropFilter: 'blur(60px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(60px) saturate(1.4)',
  },
  /** Thick material -- heavily frosted, content barely visible behind */
  thick: {
    backdropFilter: 'blur(80px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(80px) saturate(1.5)',
  },
  /** Ultra-thick material -- maximum frosting, nearly opaque feel */
  ultraThick: {
    backdropFilter: 'blur(120px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(120px) saturate(1.6)',
  },
} as const;

// ---------------------------------------------------------------------------
//  Glass Border Tokens
//
//  visionOS panels have extremely subtle borders -- often just a 1px
//  white or light line at maybe 10-15% opacity. The border gives the
//  glass panel a slight "edge catch" as if light is reflecting off
//  the edge of a physical glass pane. In dark mode, these borders
//  provide a faint luminous outline.
// ---------------------------------------------------------------------------

export const GlassBorder = {
  /** No visible border */
  none: '1px solid transparent',
  /** Barely perceptible -- for ambient panels */
  subtle: {
    light: '1px solid rgba(255, 255, 255, 0.4)',
    dark: '1px solid rgba(255, 255, 255, 0.06)',
  },
  /** Standard glass border -- for floating panels, menus */
  regular: {
    light: '1px solid rgba(255, 255, 255, 0.6)',
    dark: '1px solid rgba(255, 255, 255, 0.10)',
  },
  /** Pronounced border -- for focused/active elements */
  strong: {
    light: '1px solid rgba(0, 0, 0, 0.08)',
    dark: '1px solid rgba(255, 255, 255, 0.16)',
  },
} as const;

// ---------------------------------------------------------------------------
//  Shadows
//
//  Premium shadows are wide, diffused, and low-opacity. They create
//  the illusion of elements floating above the surface rather than
//  casting harsh directional shadows. The `y` offset is minimal --
//  visionOS elements feel weightless.
//
//  Each level uses a multi-layer shadow for realism:
//    - A soft, wide ambient shadow (large spread, very low opacity)
//    - An optional tighter shadow for definition
// ---------------------------------------------------------------------------

export const Shadows = {
  /** No shadow */
  none: 'none',
  /** Barely visible lift -- list items, subtle cards */
  sm: '0 1px 2px rgba(0, 0, 0, 0.02), 0 2px 8px rgba(0, 0, 0, 0.03)',
  /** Standard elevation -- floating panels, menus */
  md: '0 2px 8px rgba(0, 0, 0, 0.03), 0 8px 24px rgba(0, 0, 0, 0.06)',
  /** Pronounced elevation -- modals, popovers */
  lg: '0 4px 12px rgba(0, 0, 0, 0.04), 0 16px 48px rgba(0, 0, 0, 0.08)',
  /** Maximum elevation -- full-screen overlays, onboarding */
  xl: '0 8px 24px rgba(0, 0, 0, 0.06), 0 32px 80px rgba(0, 0, 0, 0.12)',
} as const;

// ---------------------------------------------------------------------------
//  Transitions
//
//  Smooth, deliberate animations. The easing curve matches Apple's
//  standard ease-in-out. Duration is slightly longer than typical web
//  defaults -- premium interfaces don't rush their animations.
// ---------------------------------------------------------------------------

export const Transitions = {
  /** Apple's standard ease-in-out curve */
  easeSmooth: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  /** Spring-like overshoot for playful interactions (menu open, toggle) */
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Gentle deceleration for elements entering the screen */
  easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  /** Subtle acceleration for elements leaving the screen */
  easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',

  /** Duration presets */
  instant: '100ms',
  fast: '200ms',
  normal: '350ms',
  slow: '500ms',
  /** For dramatic entrances -- onboarding, page transitions */
  dramatic: '800ms',

  /** Ready-made transition shorthand for common use */
  default: 'all 350ms cubic-bezier(0.4, 0.0, 0.2, 1)',
  /** For hover effects -- faster response feels more responsive */
  hover: 'all 200ms cubic-bezier(0.4, 0.0, 0.2, 1)',
  /** For color/opacity changes -- smooth and barely noticeable */
  color: 'color 350ms ease, opacity 350ms ease, background-color 350ms ease',
} as const;

// ---------------------------------------------------------------------------
//  System Colors
//
//  Muted, desaturated versions of standard system colors. Even
//  error/success states should feel calm and understated. These are
//  softer than Apple's default system colors.
// ---------------------------------------------------------------------------

export const SystemColors = {
  /** Error/destructive -- muted red, not aggressive */
  danger: '#E5484D',
  /** Danger with subtle background tint */
  dangerBackground: 'rgba(229, 72, 77, 0.08)',
  /** Success -- soft sage green */
  success: '#46A758',
  /** Success background tint */
  successBackground: 'rgba(70, 167, 88, 0.08)',
  /** Warning -- warm amber, not harsh yellow */
  warning: '#F0A030',
  /** Warning background tint */
  warningBackground: 'rgba(240, 160, 48, 0.08)',
  /** Info -- matches the tint color */
  info: '#5A8FCC',
  /** Info background tint */
  infoBackground: 'rgba(90, 143, 204, 0.08)',
} as const;

// ---------------------------------------------------------------------------
//  Breakpoints
//
//  Responsive design from compact mobile to ultra-wide displays.
//  The app should feel premium at every size. On narrow screens,
//  controls collapse into the floating menu; on wide screens,
//  generous whitespace keeps the layout luxurious.
// ---------------------------------------------------------------------------

export const Breakpoints = {
  /** Compact phone */
  xs: 320,
  /** Standard phone landscape / small tablet */
  sm: 640,
  /** Tablet portrait */
  md: 768,
  /** Tablet landscape / small laptop */
  lg: 1024,
  /** Standard desktop */
  xl: 1280,
  /** Wide desktop */
  '2xl': 1536,
  /** Ultra-wide / external display */
  '3xl': 2560,
} as const;

// ---------------------------------------------------------------------------
//  Z-Index Scale
//
//  A predictable stacking order. Glass panels sit above content;
//  floating menus above panels; modals above everything.
// ---------------------------------------------------------------------------

export const ZIndex = {
  /** Below page content -- background canvas, watercolor dots */
  background: -1,
  /** Default page content */
  base: 0,
  /** Sticky headers, toolbars */
  sticky: 10,
  /** Floating panels, sidebars */
  panel: 20,
  /** Floating action menu */
  menu: 30,
  /** Dropdown, popover */
  popover: 40,
  /** Modal dialogs */
  modal: 50,
  /** Toast notifications */
  toast: 60,
  /** Highest -- loading overlays, onboarding */
  overlay: 70,
} as const;

// ---------------------------------------------------------------------------
//  Animation Keyframes (as CSS string constants)
//
//  Ready-made keyframe definitions for common entrance/exit animations.
//  These can be injected into a <style> tag or used with CSS-in-JS.
// ---------------------------------------------------------------------------

export const Keyframes = {
  /** Fade in from transparent */
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  /** Slide up and fade in -- for cards, panels entering from below */
  slideUp: `
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  /** Scale up from slightly smaller -- for modals popping in */
  scaleIn: `
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
  `,
  /** Gentle float -- for ambient elements that feel alive */
  float: `
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
    }
  `,
  /** Subtle pulse glow -- for active/loading indicators */
  pulseGlow: `
    @keyframes pulseGlow {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
  `,
} as const;

// ---------------------------------------------------------------------------
//  Helper: get theme-aware colors
//
//  Usage:
//    const colors = getThemeColors('dark');
//    element.style.color = colors.text;
//    element.style.background = colors.glass;
// ---------------------------------------------------------------------------

export function getThemeColors(theme: Theme) {
  return Colors[theme];
}

// ---------------------------------------------------------------------------
//  Helper: get theme-aware glass border
//
//  Usage:
//    const border = getGlassBorder('subtle', 'dark');
//    element.style.border = border;
// ---------------------------------------------------------------------------

export function getGlassBorder(
  level: 'none' | 'subtle' | 'regular' | 'strong',
  theme: Theme,
): string {
  if (level === 'none') return GlassBorder.none;
  return GlassBorder[level][theme];
}
