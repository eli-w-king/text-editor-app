/**
 * LLMTransitions -- Ambient transition affordances for LLM interactions.
 *
 * PLATFORM: Web (Desktop/Browser)
 * AESTHETIC: visionOS-inspired frosted glass, ambient, barely-noticeable
 *
 * These components provide subtle visual feedback while the LLM is generating
 * a response, streaming text, loading images, or performing any AI operation.
 * Every animation is CSS-only (keyframes), never JS timers. The intent is
 * ambient presence -- the user should feel that something is happening without
 * ever being distracted or blocked.
 *
 * Components:
 *   - LLMThinkingIndicator  -- 3-dot pulse inline where AI text will appear
 *   - StreamingTextTransition -- word-by-word fade-in of streamed text
 *   - SkeletonLoader         -- glass shimmer placeholder lines
 *   - ImageGenerationShimmer  -- frosted glass rectangle with slow pulse
 *   - TransitionOverlay       -- ultra-subtle full-editor dim overlay
 *
 * All components accept `isDark: boolean` for theme-aware rendering.
 * Pulse cycle: 2.4s (matching the mobile "slower, quieter pulse" spec).
 */

import React, { useMemo, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
//  Shared constants
// ---------------------------------------------------------------------------

/**
 * Unique prefix for injected style element IDs so we can inject CSS keyframes
 * once and avoid collisions.
 */
const STYLE_ID = 'llm-transitions-keyframes';

/**
 * All CSS keyframes used by the transition components. Injected into the
 * document head once on first mount of any component.
 */
const KEYFRAMES_CSS = `
@keyframes llm-dot-pulse {
  0%, 100% { opacity: 0.18; transform: scale(0.85); }
  50%      { opacity: 0.6;  transform: scale(1);    }
}

@keyframes llm-skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0;  }
}

@keyframes llm-image-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 0.7; }
}

@keyframes llm-image-glow {
  0%, 100% { opacity: 0;   }
  50%      { opacity: 0.35; }
}

@keyframes llm-overlay-breathe {
  0%, 100% { opacity: 0.02; }
  50%      { opacity: 0.05; }
}

@keyframes llm-fade-in {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: translateY(0);   }
}
`;

/**
 * Inject the keyframes stylesheet into the document head exactly once.
 * Safe to call multiple times -- checks for existing style element by ID.
 */
function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = KEYFRAMES_CSS;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
//  1. LLMThinkingIndicator
// ---------------------------------------------------------------------------

interface ThinkingIndicatorProps {
  isDark: boolean;
  /** Optional inline style overrides for the container */
  style?: React.CSSProperties;
}

/**
 * Three gently pulsing dots displayed inline where the AI response will
 * appear. Each dot is staggered by 0.4s within a 2.4s cycle. The dots
 * are small (5px), round, and use the theme's muted text color at very
 * low opacity so they blend into the editor canvas.
 */
export function LLMThinkingIndicator({ isDark, style }: ThinkingIndicatorProps) {
  useEffect(ensureKeyframes, []);

  const dotColor = isDark
    ? 'rgba(236, 237, 238, 0.45)'
    : 'rgba(28, 28, 30, 0.35)';

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 4px',
    verticalAlign: 'baseline',
    ...style,
  };

  const dotBase: React.CSSProperties = {
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: dotColor,
    animation: 'llm-dot-pulse 2.4s ease-in-out infinite',
    willChange: 'opacity, transform',
  };

  return (
    <span style={containerStyle} aria-label="AI is thinking" role="status">
      <span style={{ ...dotBase, animationDelay: '0s' }} />
      <span style={{ ...dotBase, animationDelay: '0.4s' }} />
      <span style={{ ...dotBase, animationDelay: '0.8s' }} />
    </span>
  );
}

// ---------------------------------------------------------------------------
//  2. StreamingTextTransition
// ---------------------------------------------------------------------------

interface StreamingTextProps {
  /** The text being streamed in from the LLM */
  text: string;
  isDark: boolean;
  /** Optional inline style overrides */
  style?: React.CSSProperties;
}

/**
 * Renders streamed LLM text with a word-by-word materialization effect.
 * Each word fades in from opacity 0 -> 1 with a very slight upward shift
 * over ~200ms. Words are split on whitespace and wrapped in individual
 * spans. The animation is additive -- new words animate in while
 * previously-rendered words remain fully visible.
 *
 * This is NOT a typewriter effect. It is a materialization: all existing
 * words are visible, and newly arriving words fade into existence.
 */
export function StreamingTextTransition({ text, isDark, style }: StreamingTextProps) {
  useEffect(ensureKeyframes, []);

  // Track the previous word count so we know which words are "new" and
  // need the fade-in animation. Words that were already displayed stay
  // fully opaque with no animation.
  const prevCountRef = useRef(0);
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  // Update the previous count after render so only truly new words animate.
  useEffect(() => {
    prevCountRef.current = words.length;
  }, [words.length]);

  const containerStyle: React.CSSProperties = {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 18,
    fontWeight: 400,
    lineHeight: '28px',
    color: isDark ? '#ECEDEE' : '#1C1C1E',
    ...style,
  };

  return (
    <div style={containerStyle} role="status" aria-live="polite">
      {words.map((word, i) => {
        const isNew = i >= prevCountRef.current;
        const wordStyle: React.CSSProperties = isNew
          ? {
              animation: 'llm-fade-in 200ms ease-out forwards',
              opacity: 0,
            }
          : { opacity: 1 };

        return (
          <span key={`${i}-${word}`} style={wordStyle}>
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  3. SkeletonLoader
// ---------------------------------------------------------------------------

interface SkeletonLoaderProps {
  isDark: boolean;
  /** Number of skeleton lines to render (default: 3) */
  lines?: number;
  /** Optional inline style overrides for the container */
  style?: React.CSSProperties;
}

/**
 * Glass-styled skeleton placeholder that shows while waiting for the
 * initial LLM response. Renders 2-3 shimmering glass rectangles that
 * match the body text dimensions (18px font, 28px line-height). The
 * shimmer is a slow horizontal sweep using the design system's glass
 * tokens. The last line is shorter (60% width) to suggest a natural
 * paragraph ending.
 */
export function SkeletonLoader({ isDark, lines = 3, style }: SkeletonLoaderProps) {
  useEffect(ensureKeyframes, []);

  const lineColor = isDark
    ? 'rgba(255, 255, 255, 0.04)'
    : 'rgba(0, 0, 0, 0.04)';

  const shimmerGradient = isDark
    ? `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)`
    : `linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.04) 50%, transparent 100%)`;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '8px 0',
    ...style,
  };

  const lineBase: React.CSSProperties = {
    height: 14,
    borderRadius: 7,
    backgroundColor: lineColor,
    backgroundImage: shimmerGradient,
    backgroundSize: '200% 100%',
    animation: 'llm-skeleton-shimmer 2.4s ease-in-out infinite',
    willChange: 'background-position',
  };

  return (
    <div style={containerStyle} aria-label="Loading AI response" role="status">
      {Array.from({ length: lines }, (_, i) => {
        // Last line is shorter to suggest a natural paragraph ending
        const isLast = i === lines - 1;
        const width = isLast ? '60%' : `${92 - i * 4}%`;

        return (
          <div
            key={i}
            style={{
              ...lineBase,
              width,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  4. ImageGenerationShimmer
// ---------------------------------------------------------------------------

interface ImageShimmerProps {
  isDark: boolean;
  /** Width of the shimmer rectangle (default: '100%') */
  width?: string | number;
  /** Height of the shimmer rectangle (default: 220) */
  height?: number;
  /** Optional inline style overrides */
  style?: React.CSSProperties;
}

/**
 * A frosted glass rectangle with a slow shimmer/pulse for AI-generated
 * image loading. Matches the mobile ImageLoadingShimmer from App.js
 * (lines 319-350) but uses pure CSS animations instead of React Native
 * Animated. Two layers: a base pulse and a colored glow overlay.
 *
 * Pulse cycle: 2.4s. Glow cycle: 3.6s (offset for visual richness).
 */
export function ImageGenerationShimmer({
  isDark,
  width = '100%',
  height = 220,
  style,
}: ImageShimmerProps) {
  useEffect(ensureKeyframes, []);

  const bgColor = isDark
    ? 'rgba(255, 255, 255, 0.04)'
    : 'rgba(0, 0, 0, 0.04)';

  const glowColor = isDark
    ? 'radial-gradient(ellipse at center, rgba(120, 140, 255, 0.08) 0%, transparent 70%)'
    : 'radial-gradient(ellipse at center, rgba(80, 100, 180, 0.08) 0%, transparent 70%)';

  const containerStyle: React.CSSProperties = {
    position: 'relative' as const,
    width,
    height,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: bgColor,
    ...style,
  };

  const pulseLayerStyle: React.CSSProperties = {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: isDark
      ? 'rgba(255, 255, 255, 0.03)'
      : 'rgba(0, 0, 0, 0.02)',
    animation: 'llm-image-pulse 2.4s ease-in-out infinite',
    willChange: 'opacity',
  };

  const glowLayerStyle: React.CSSProperties = {
    position: 'absolute' as const,
    inset: 0,
    background: glowColor,
    animation: 'llm-image-glow 3.6s ease-in-out infinite',
    willChange: 'opacity',
  };

  // Frosted glass overlay via CSS backdrop-filter (replaces mobile BlurView)
  const frostStyle: React.CSSProperties = {
    position: 'absolute' as const,
    inset: 0,
    backdropFilter: 'blur(40px) saturate(140%)',
    WebkitBackdropFilter: 'blur(40px) saturate(140%)',
  };

  return (
    <div style={containerStyle} aria-label="Generating image" role="status">
      <div style={pulseLayerStyle} />
      <div style={glowLayerStyle} />
      <div style={frostStyle} />
    </div>
  );
}

// ---------------------------------------------------------------------------
//  5. TransitionOverlay
// ---------------------------------------------------------------------------

interface TransitionOverlayProps {
  isDark: boolean;
  /** Whether the overlay should be visible */
  active: boolean;
  /** Optional inline style overrides */
  style?: React.CSSProperties;
}

/**
 * A very subtle full-editor overlay that breathes gently (opacity 0.02-0.05)
 * while any AI operation is in progress. Provides ambient feedback without
 * being intrusive. Uses pointer-events: none so the user can continue
 * interacting with the editor while the overlay is active.
 *
 * The overlay fades in smoothly over 400ms and fades out over 300ms when
 * the AI operation completes.
 */
export function TransitionOverlay({ isDark, active, style }: TransitionOverlayProps) {
  useEffect(ensureKeyframes, []);

  const overlayColor = isDark
    ? 'rgba(120, 140, 255, 0.03)'
    : 'rgba(80, 100, 180, 0.02)';

  const overlayStyle: React.CSSProperties = {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: overlayColor,
    pointerEvents: 'none' as const,
    transition: 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: active ? 1 : 0,
    animation: active ? 'llm-overlay-breathe 2.4s ease-in-out infinite' : 'none',
    willChange: active ? 'opacity' : 'auto',
    zIndex: 1,
    borderRadius: 'inherit',
    ...style,
  };

  return <div style={overlayStyle} aria-hidden="true" />;
}
