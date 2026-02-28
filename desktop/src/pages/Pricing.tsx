/**
 * Pricing Page Component
 *
 * Displays the Writer app's freemium tier structure with frosted glass styling.
 * This component is designed for the web/desktop version of the app.
 * It can also be rendered in React Native Web via Expo's web target.
 *
 * Tiers:
 *   - Free: 3 documents, basic formatting, single device
 *   - Pro ($5/mo): Unlimited docs, AI assistant, cross-device sync, export
 *   - Team ($12/user/mo): Collaboration, shared workspaces, admin controls
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

// ---------- Types ----------

interface PricingTier {
  id: 'free' | 'pro' | 'team';
  name: string;
  price: string;
  priceSubtext: string;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

interface PricingProps {
  /** Callback invoked when the user selects a tier */
  onSelectTier?: (tierId: 'free' | 'pro' | 'team') => void;
  /** Current color scheme */
  theme?: 'light' | 'dark';
}

// ---------- Data ----------

const TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceSubtext: 'forever',
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
    price: '$5',
    priceSubtext: 'per month',
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
    price: '$12',
    priceSubtext: 'per user / month',
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

// ---------- Sub-components ----------

/**
 * A single feature row with a checkmark icon.
 */
function FeatureRow({
  text,
  isDark,
}: {
  text: string;
  isDark: boolean;
}) {
  return (
    <View style={featureStyles.row}>
      <Ionicons
        name="checkmark-circle"
        size={18}
        color={isDark ? '#86D993' : '#34C759'}
        style={featureStyles.icon}
      />
      <Text style={[featureStyles.text, { color: isDark ? '#E5E5EA' : '#3A3A3C' }]}>
        {text}
      </Text>
    </View>
  );
}

const featureStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  icon: {
    marginRight: 8,
    marginTop: 1,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});

/**
 * Frosted glass pricing card.
 *
 * On iOS/macOS the card uses a native BlurView backdrop.
 * On web it falls back to CSS backdrop-filter for the same frosted effect.
 */
function PricingCard({
  tier,
  isDark,
  onSelect,
  isWide,
}: {
  tier: PricingTier;
  isDark: boolean;
  onSelect: () => void;
  isWide: boolean;
}) {
  const cardWidth = isWide ? 320 : '100%';

  const cardContent = (
    <View
      style={[
        cardStyles.inner,
        {
          width: cardWidth as any,
          borderColor: tier.highlighted
            ? isDark
              ? 'rgba(255,255,255,0.25)'
              : 'rgba(0,0,0,0.15)'
            : isDark
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {/* Badge for highlighted tier */}
      {tier.highlighted && (
        <View style={[cardStyles.badge, { backgroundColor: isDark ? '#FFFFFF' : '#000000' }]}>
          <Text style={[cardStyles.badgeText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
            Most Popular
          </Text>
        </View>
      )}

      {/* Tier name */}
      <Text style={[cardStyles.tierName, { color: isDark ? '#FFFFFF' : '#000000' }]}>
        {tier.name}
      </Text>

      {/* Price */}
      <View style={cardStyles.priceRow}>
        <Text style={[cardStyles.price, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          {tier.price}
        </Text>
        <Text style={[cardStyles.priceSubtext, { color: isDark ? '#8E8E93' : '#636366' }]}>
          {' '}{tier.priceSubtext}
        </Text>
      </View>

      {/* Description */}
      <Text style={[cardStyles.description, { color: isDark ? '#AEAEB2' : '#636366' }]}>
        {tier.description}
      </Text>

      {/* Divider */}
      <View
        style={[
          cardStyles.divider,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
        ]}
      />

      {/* Features list */}
      <View style={cardStyles.featuresContainer}>
        {tier.features.map((feature) => (
          <FeatureRow key={feature} text={feature} isDark={isDark} />
        ))}
      </View>

      {/* CTA button */}
      <TouchableOpacity
        style={[
          cardStyles.ctaButton,
          tier.highlighted
            ? { backgroundColor: isDark ? '#FFFFFF' : '#000000' }
            : {
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
              },
        ]}
        onPress={onSelect}
        activeOpacity={0.8}
      >
        <Text
          style={[
            cardStyles.ctaText,
            tier.highlighted
              ? { color: isDark ? '#000000' : '#FFFFFF', fontWeight: '600' }
              : { color: isDark ? '#FFFFFF' : '#000000', fontWeight: '500' },
          ]}
        >
          {tier.cta}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Use native BlurView on iOS; CSS backdrop-filter fallback on web
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={60}
        tint={isDark ? 'dark' : 'light'}
        style={[cardStyles.blurContainer, { width: cardWidth as any }]}
      >
        {cardContent}
      </BlurView>
    );
  }

  // Web / Android fallback with CSS-based frosted glass
  return (
    <View
      style={[
        cardStyles.glassContainer,
        {
          width: cardWidth as any,
          backgroundColor: isDark ? 'rgba(44,44,46,0.65)' : 'rgba(255,255,255,0.55)',
          // @ts-ignore -- web-only CSS property
          backdropFilter: 'blur(24px)',
          // @ts-ignore
          WebkitBackdropFilter: 'blur(24px)',
        },
      ]}
    >
      {cardContent}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  blurContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  glassContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  inner: {
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tierName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  priceSubtext: {
    fontSize: 14,
    fontWeight: '400',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    marginBottom: 20,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  ctaButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 16,
  },
});

// ---------- Main Component ----------

export default function Pricing({ onSelectTier, theme: themeProp }: PricingProps) {
  const { width } = useWindowDimensions();
  const isDark = (themeProp ?? 'light') === 'dark';
  const isWide = width >= 900;

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const handleSelect = (tierId: 'free' | 'pro' | 'team') => {
    onSelectTier?.(tierId);
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: isDark ? '#000000' : '#E8E8ED' }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>
          Choose your plan
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#AEAEB2' : '#636366' }]}>
          Start free, upgrade when you need more.
        </Text>
      </View>

      {/* Billing cycle toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            billingCycle === 'monthly' && {
              backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            },
          ]}
          onPress={() => setBillingCycle('monthly')}
        >
          <Text
            style={[
              styles.toggleText,
              {
                color:
                  billingCycle === 'monthly'
                    ? isDark
                      ? '#FFFFFF'
                      : '#000000'
                    : isDark
                    ? '#8E8E93'
                    : '#636366',
                fontWeight: billingCycle === 'monthly' ? '600' : '400',
              },
            ]}
          >
            Monthly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleOption,
            billingCycle === 'annual' && {
              backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            },
          ]}
          onPress={() => setBillingCycle('annual')}
        >
          <Text
            style={[
              styles.toggleText,
              {
                color:
                  billingCycle === 'annual'
                    ? isDark
                      ? '#FFFFFF'
                      : '#000000'
                    : isDark
                    ? '#8E8E93'
                    : '#636366',
                fontWeight: billingCycle === 'annual' ? '600' : '400',
              },
            ]}
          >
            Annual
          </Text>
          <View style={[styles.saveBadge, { backgroundColor: '#34C759' }]}>
            <Text style={styles.saveBadgeText}>Save 20%</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Pricing cards */}
      <View style={[styles.cardsContainer, isWide && styles.cardsRow]}>
        {TIERS.map((tier) => {
          // Adjust price display for annual billing
          const displayTier = { ...tier };
          if (billingCycle === 'annual' && tier.id !== 'free') {
            if (tier.id === 'pro') {
              displayTier.price = '$4';
              displayTier.priceSubtext = 'per month, billed annually';
            } else if (tier.id === 'team') {
              displayTier.price = '$10';
              displayTier.priceSubtext = 'per user / month, billed annually';
            }
          }

          return (
            <PricingCard
              key={tier.id}
              tier={displayTier}
              isDark={isDark}
              onSelect={() => handleSelect(tier.id)}
              isWide={isWide}
            />
          );
        })}
      </View>

      {/* Footer note */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: isDark ? '#636366' : '#8E8E93' }]}>
          All plans include a 14-day free trial for Pro features.{'\n'}
          Cancel anytime. No questions asked.
        </Text>
      </View>
    </ScrollView>
  );
}

// ---------- Page styles ----------

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 80,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 36,
    gap: 4,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 6,
  },
  toggleText: {
    fontSize: 14,
  },
  saveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  saveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardsContainer: {
    width: '100%',
    maxWidth: 1040,
    alignItems: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 20,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
