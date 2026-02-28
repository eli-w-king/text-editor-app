/**
 * Pricing Page Component (Web/Desktop)
 *
 * PLATFORM: Web (Desktop/Browser)
 * COUNTERPART: None -- pricing is web-only for now.
 *
 * Displays the Inlay app's freemium tier structure with visionOS-inspired
 * frosted glass styling. Uses CSS `backdrop-filter: blur()` for glass effects,
 * inline SVG checkmarks instead of Ionicons, and `window.addEventListener`
 * for responsive layout instead of React Native's `useWindowDimensions`.
 *
 * Tiers:
 *   - Free: 3 documents, basic formatting, single device
 *   - Pro ($5/mo or $4/mo annual): Unlimited docs, AI, sync, export
 *   - Team ($12/user/mo or $10/user/mo annual): Collaboration, workspaces
 */

import React, { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingTier {
  id: 'free' | 'pro' | 'team';
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  monthlySubtext: string;
  annualSubtext: string;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

interface PricingProps {
  /** Callback invoked when the user selects a tier */
  onSelectTier?: (tierId: 'free' | 'pro' | 'team') => void;
  /** Current color scheme -- defaults to dark */
  theme?: 'light' | 'dark';
}

// ---------------------------------------------------------------------------
// Theme palette
// ---------------------------------------------------------------------------

interface ThemeColors {
  pageBg: string;
  headingColor: string;
  subtitleColor: string;
  cardBg: string;
  cardBorder: string;
  cardBorderHighlighted: string;
  cardShadow: string;
  tierNameColor: string;
  priceColor: string;
  priceSubColor: string;
  descColor: string;
  featureColor: string;
  checkColor: string;
  dividerColor: string;
  toggleBg: string;
  toggleActiveBg: string;
  toggleText: string;
  toggleActiveText: string;
  badgeBg: string;
  badgeText: string;
  ctaPrimaryBg: string;
  ctaPrimaryText: string;
  ctaOutlineBorder: string;
  ctaOutlineText: string;
  ctaOutlineHoverBg: string;
  footerColor: string;
  saveBadgeBg: string;
  saveBadgeText: string;
  popularBadgeBg: string;
  popularBadgeText: string;
  innerGlow: string;
}

const darkColors: ThemeColors = {
  pageBg: 'linear-gradient(160deg, #0a0a0a 0%, #1a1a2e 40%, #16213e 100%)',
  headingColor: '#F5F5F7',
  subtitleColor: 'rgba(245, 245, 247, 0.4)',
  cardBg: 'rgba(255, 255, 255, 0.05)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  cardBorderHighlighted: 'rgba(255, 255, 255, 0.18)',
  cardShadow: '0 8px 40px rgba(0, 0, 0, 0.5), 0 2px 12px rgba(0, 0, 0, 0.3)',
  tierNameColor: '#F5F5F7',
  priceColor: '#F5F5F7',
  priceSubColor: 'rgba(245, 245, 247, 0.35)',
  descColor: 'rgba(245, 245, 247, 0.45)',
  featureColor: 'rgba(245, 245, 247, 0.7)',
  checkColor: '#86D993',
  dividerColor: 'rgba(255, 255, 255, 0.06)',
  toggleBg: 'rgba(255, 255, 255, 0.04)',
  toggleActiveBg: 'rgba(255, 255, 255, 0.12)',
  toggleText: 'rgba(245, 245, 247, 0.35)',
  toggleActiveText: '#F5F5F7',
  badgeBg: 'rgba(255, 255, 255, 0.06)',
  badgeText: '#F5F5F7',
  ctaPrimaryBg: 'rgba(255, 255, 255, 0.95)',
  ctaPrimaryText: '#0a0a0a',
  ctaOutlineBorder: 'rgba(255, 255, 255, 0.15)',
  ctaOutlineText: 'rgba(245, 245, 247, 0.8)',
  ctaOutlineHoverBg: 'rgba(255, 255, 255, 0.08)',
  footerColor: 'rgba(245, 245, 247, 0.25)',
  saveBadgeBg: 'rgba(70, 167, 88, 0.2)',
  saveBadgeText: '#86D993',
  popularBadgeBg: 'rgba(255, 255, 255, 0.08)',
  popularBadgeText: '#F5F5F7',
  innerGlow: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%)',
};

const lightColors: ThemeColors = {
  pageBg: 'linear-gradient(160deg, #F5F5F7 0%, #EFEFF1 40%, #E8E8ED 100%)',
  headingColor: '#1D1D1F',
  subtitleColor: 'rgba(29, 29, 31, 0.45)',
  cardBg: 'rgba(255, 255, 255, 0.55)',
  cardBorder: 'rgba(255, 255, 255, 0.7)',
  cardBorderHighlighted: 'rgba(0, 0, 0, 0.1)',
  cardShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 6px rgba(0, 0, 0, 0.04)',
  tierNameColor: '#1D1D1F',
  priceColor: '#1D1D1F',
  priceSubColor: 'rgba(29, 29, 31, 0.4)',
  descColor: 'rgba(29, 29, 31, 0.5)',
  featureColor: 'rgba(29, 29, 31, 0.7)',
  checkColor: '#34C759',
  dividerColor: 'rgba(0, 0, 0, 0.06)',
  toggleBg: 'rgba(0, 0, 0, 0.03)',
  toggleActiveBg: 'rgba(0, 0, 0, 0.07)',
  toggleText: 'rgba(29, 29, 31, 0.4)',
  toggleActiveText: '#1D1D1F',
  badgeBg: 'rgba(0, 0, 0, 0.04)',
  badgeText: '#1D1D1F',
  ctaPrimaryBg: '#1D1D1F',
  ctaPrimaryText: '#F5F5F7',
  ctaOutlineBorder: 'rgba(0, 0, 0, 0.12)',
  ctaOutlineText: 'rgba(29, 29, 31, 0.7)',
  ctaOutlineHoverBg: 'rgba(0, 0, 0, 0.04)',
  footerColor: 'rgba(29, 29, 31, 0.3)',
  saveBadgeBg: 'rgba(52, 199, 89, 0.12)',
  saveBadgeText: '#2D8E45',
  popularBadgeBg: 'rgba(0, 0, 0, 0.05)',
  popularBadgeText: '#1D1D1F',
  innerGlow: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 50%)',
};

// ---------------------------------------------------------------------------
// Tier data
// ---------------------------------------------------------------------------

const TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: '$0',
    annualPrice: '$0',
    monthlySubtext: 'forever',
    annualSubtext: 'forever',
    description: 'Get started with the essentials.',
    features: [
      'Up to 3 documents',
      'Basic formatting (bold, italic, lists)',
      'Single device',
      'Local storage',
      'Light & dark themes',
    ],
    highlighted: false,
    cta: 'Get Started',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: '$5',
    annualPrice: '$4',
    monthlySubtext: 'per month',
    annualSubtext: 'per month, billed annually',
    description: 'Unlock the full writing experience.',
    features: [
      'Unlimited documents',
      'AI writing assistant',
      'Cross-device sync',
      'Advanced formatting & markdown',
      'Export to PDF & DOCX',
      'Priority AI models',
      'Custom themes',
    ],
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    id: 'team',
    name: 'Team',
    monthlyPrice: '$12',
    annualPrice: '$10',
    monthlySubtext: 'per user / month',
    annualSubtext: 'per user / month, billed annually',
    description: 'Write together, beautifully.',
    features: [
      'Everything in Pro',
      'Real-time collaboration',
      'Shared workspaces',
      'Admin controls & permissions',
      'Team templates',
      'Priority support',
      'Usage analytics',
    ],
    highlighted: false,
    cta: 'Contact Sales',
  },
];

// ---------------------------------------------------------------------------
// SVG Checkmark Icon
// ---------------------------------------------------------------------------

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      style={{ flexShrink: 0, marginRight: 10, marginTop: 2 }}
    >
      <circle cx="9" cy="9" r="9" fill={color} fillOpacity="0.15" />
      <path
        d="M5.5 9.5L7.5 11.5L12.5 6.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pricing Card
// ---------------------------------------------------------------------------

function PricingCard({
  tier,
  colors,
  billingCycle,
  onSelect,
  isWide,
}: {
  tier: PricingTier;
  colors: ThemeColors;
  billingCycle: 'monthly' | 'annual';
  onSelect: () => void;
  isWide: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCtaHovered, setIsCtaHovered] = useState(false);

  const price = billingCycle === 'annual' ? tier.annualPrice : tier.monthlyPrice;
  const subtext = billingCycle === 'annual' ? tier.annualSubtext : tier.monthlySubtext;

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    width: isWide ? 320 : '100%',
    maxWidth: isWide ? 320 : 400,
    padding: '32px 28px 28px',
    borderRadius: 22,
    background: colors.cardBg,
    backdropFilter: 'blur(36px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(36px) saturate(1.4)',
    border: `1px solid ${tier.highlighted ? colors.cardBorderHighlighted : colors.cardBorder}`,
    boxShadow: colors.cardShadow,
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: isHovered ? 'translateY(-6px)' : tier.highlighted && isWide ? 'translateY(-8px)' : 'translateY(0)',
    overflow: 'hidden',
    flexShrink: 0,
  };

  // Inner glow overlay for glass depth
  const glowStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: colors.innerGlow,
    borderRadius: 22,
    pointerEvents: 'none',
  };

  const tierNameStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    color: colors.priceSubColor,
    marginBottom: 14,
  };

  const priceStyle: React.CSSProperties = {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 44,
    fontWeight: 400,
    letterSpacing: '-1px',
    color: colors.priceColor,
    lineHeight: '1',
  };

  const priceSubStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 13,
    fontWeight: 400,
    color: colors.priceSubColor,
    marginLeft: 6,
  };

  const descStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    lineHeight: '1.5',
    color: colors.descColor,
    marginTop: 12,
    marginBottom: 24,
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    background: colors.dividerColor,
    marginBottom: 22,
    border: 'none',
  };

  const featureTextStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    lineHeight: '1.5',
    color: colors.featureColor,
  };

  const featureRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: 10,
  };

  // CTA button style -- solid for highlighted, outline for others
  const ctaBaseStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 24px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    marginTop: 6,
    letterSpacing: '-0.1px',
    outline: 'none',
  };

  const ctaStyle: React.CSSProperties = tier.highlighted
    ? {
        ...ctaBaseStyle,
        background: colors.ctaPrimaryBg,
        color: colors.ctaPrimaryText,
        border: 'none',
        boxShadow: isCtaHovered
          ? '0 4px 20px rgba(0, 0, 0, 0.25)'
          : '0 2px 8px rgba(0, 0, 0, 0.15)',
        transform: isCtaHovered ? 'translateY(-1px)' : 'translateY(0)',
      }
    : {
        ...ctaBaseStyle,
        background: isCtaHovered ? colors.ctaOutlineHoverBg : 'transparent',
        color: colors.ctaOutlineText,
        border: `1.5px solid ${colors.ctaOutlineBorder}`,
      };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Inner glow */}
      <div style={glowStyle} />

      {/* "Most Popular" badge for highlighted tier */}
      {tier.highlighted && (
        <div
          style={{
            position: 'absolute',
            top: -1,
            left: '50%',
            transform: 'translateX(-50%)',
            background: colors.popularBadgeBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 100,
            padding: '5px 16px',
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.8px',
              textTransform: 'uppercase' as const,
              color: colors.popularBadgeText,
            }}
          >
            Most Popular
          </span>
        </div>
      )}

      {/* Tier name */}
      <h3 style={tierNameStyle}>{tier.name}</h3>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', position: 'relative', zIndex: 1 }}>
        <span style={priceStyle}>{price}</span>
        <span style={priceSubStyle}>{subtext}</span>
      </div>

      {/* Description */}
      <p style={descStyle}>{tier.description}</p>

      {/* Divider */}
      <hr style={dividerStyle} />

      {/* Features list */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 24, position: 'relative', zIndex: 1 }}>
        {tier.features.map((feature) => (
          <li key={feature} style={featureRowStyle}>
            <CheckIcon color={colors.checkColor} />
            <span style={featureTextStyle}>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA button */}
      <button
        type="button"
        style={ctaStyle}
        onClick={onSelect}
        onMouseEnter={() => setIsCtaHovered(true)}
        onMouseLeave={() => setIsCtaHovered(false)}
      >
        {tier.cta}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Pricing({ onSelectTier, theme = 'dark' }: PricingProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 900 : true);

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  // Responsive layout via window resize listener
  useEffect(() => {
    function handleResize() {
      setIsWide(window.innerWidth >= 900);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelect = useCallback(
    (tierId: 'free' | 'pro' | 'team') => {
      onSelectTier?.(tierId);
    },
    [onSelectTier],
  );

  // ---- Styles ----

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.pageBg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '80px 24px 100px',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    overflowY: 'auto',
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: isWide ? 42 : 34,
    fontWeight: 300,
    letterSpacing: '-0.5px',
    color: colors.headingColor,
    marginBottom: 10,
    textAlign: 'center',
  };

  const subtitleStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 15,
    fontWeight: 400,
    color: colors.subtitleColor,
    marginBottom: 40,
    textAlign: 'center',
  };

  const toggleContainerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: colors.toggleBg,
    borderRadius: 14,
    padding: 4,
    marginBottom: 48,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${colors.cardBorder}`,
  };

  const getToggleStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? colors.toggleActiveText : colors.toggleText,
    background: active ? colors.toggleActiveBg : 'transparent',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
  });

  const saveBadgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 6,
    background: colors.saveBadgeBg,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 11,
    fontWeight: 700,
    color: colors.saveBadgeText,
    letterSpacing: '0.3px',
  };

  const cardsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isWide ? 'row' : 'column',
    alignItems: isWide ? 'flex-start' : 'center',
    justifyContent: 'center',
    gap: isWide ? 20 : 24,
    width: '100%',
    maxWidth: 1040,
    paddingTop: isWide ? 16 : 0,
  };

  const footerStyle: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 13,
    lineHeight: '1.6',
    color: colors.footerColor,
    textAlign: 'center',
    marginTop: 48,
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <header style={{ textAlign: 'center' }}>
        <h1 style={headingStyle}>Choose your plan</h1>
        <p style={subtitleStyle}>Start free, upgrade when you need more.</p>
      </header>

      {/* Billing cycle toggle */}
      <div style={toggleContainerStyle}>
        <button
          type="button"
          style={getToggleStyle(billingCycle === 'monthly')}
          onClick={() => setBillingCycle('monthly')}
        >
          Monthly
        </button>
        <button
          type="button"
          style={getToggleStyle(billingCycle === 'annual')}
          onClick={() => setBillingCycle('annual')}
        >
          Annual
          <span style={saveBadgeStyle}>Save 20%</span>
        </button>
      </div>

      {/* Pricing cards */}
      <div style={cardsContainerStyle}>
        {TIERS.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            colors={colors}
            billingCycle={billingCycle}
            onSelect={() => handleSelect(tier.id)}
            isWide={isWide}
          />
        ))}
      </div>

      {/* Footer note */}
      <footer style={footerStyle}>
        All plans include a 14-day free trial for Pro features.<br />
        Cancel anytime. No questions asked.
      </footer>
    </div>
  );
}
