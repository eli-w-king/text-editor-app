/**
 * AuthGate wraps the app's main content and enforces a default-deny posture:
 *
 * 1. LOADING: While isLoading is true (session being restored), shows a
 *    LoadingScreen. A minimum display time (MIN_LOADING_DISPLAY_MS) prevents
 *    the loading screen from flashing too briefly on fast networks. A fade-in
 *    animation (FADE_IN_DURATION_MS) smooths the appearance.
 *
 * 2. UNAUTHENTICATED: When the user is not authenticated, shows LoginScreen
 *    or RegisterScreen with a mode toggle. Children never mount.
 *
 * 3. AUTHENTICATED: Renders children (the actual app).
 *
 * This component MUST be rendered inside <AuthProvider> or useAuth() will
 * throw: "useAuth must be used within an AuthProvider".
 *
 * PLATFORM: React Native (mobile)
 * COUNTERPART: desktop/src/main.tsx (GuestOnly / RequireAuth route guards)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../context/AuthContext';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';

/** Minimum time (ms) the loading screen is shown to prevent visual flicker. */
const MIN_LOADING_DISPLAY_MS = 400;

/** Duration (ms) of the fade-in animation on the loading screen. */
const FADE_IN_DURATION_MS = 250;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const mountTimeRef = useRef(Date.now());

  // Fade-in animation value
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Start fade-in and minimum timer on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: FADE_IN_DURATION_MS,
      useNativeDriver: true,
    }).start();

    const elapsed = Date.now() - mountTimeRef.current;
    const remaining = Math.max(0, MIN_LOADING_DISPLAY_MS - elapsed);

    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, remaining);

    return () => {
      clearTimeout(timer);
    };
  }, [fadeAnim]);

  // Show loading screen until BOTH auth check completes AND minimum time elapses.
  // This prevents a brief flash of the LoginScreen before confirming the user
  // is authenticated (or not).
  const showLoading = isLoading || !minTimeElapsed;

  if (showLoading) {
    return <LoadingScreen fadeAnim={fadeAnim} />;
  }

  if (!isAuthenticated) {
    return mode === 'login' ? (
      <LoginScreen onSwitchToRegister={() => setMode('register')} />
    ) : (
      <RegisterScreen onSwitchToLogin={() => setMode('login')} />
    );
  }

  return <>{children}</>;
}

/**
 * A loading screen matching the app aesthetic with dark mode support.
 * Shown while the auth session is being restored on startup.
 */
function LoadingScreen({ fadeAnim }: { fadeAnim: Animated.Value }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Animated.View
      style={[
        loadingStyles.container,
        { opacity: fadeAnim },
        isDark ? loadingStyles.containerDark : null,
      ]}
    >
      {/* Decorative watercolor accents */}
      <View
        style={[
          loadingStyles.dotAccent1,
          isDark && { backgroundColor: 'rgba(45, 64, 116, 0.15)' },
        ]}
      />
      <View
        style={[
          loadingStyles.dotAccent2,
          isDark && { backgroundColor: 'rgba(88, 47, 100, 0.15)' },
        ]}
      />

      <View
        style={[
          loadingStyles.cardWrapper,
          isDark && loadingStyles.cardWrapperDark,
        ]}
      >
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={loadingStyles.cardContent}>
          <ActivityIndicator
            size="large"
            color={isDark ? '#FFFFFF' : '#000000'}
          />
          <Text
            style={[
              loadingStyles.loadingText,
              isDark && loadingStyles.loadingTextDark,
            ]}
          >
            Loading...
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8E8ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerDark: {
    backgroundColor: '#1C1C1E',
  },
  dotAccent1: {
    position: 'absolute',
    top: '20%',
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(45, 64, 116, 0.08)',
  },
  dotAccent2: {
    position: 'absolute',
    bottom: '25%',
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(88, 47, 100, 0.08)',
  },
  cardWrapper: {
    width: 160,
    height: 120,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardWrapperDark: {
    borderColor: 'rgba(255,255,255,0.1)',
    shadowOpacity: 0.2,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
  },
  loadingTextDark: {
    color: 'rgba(255,255,255,0.5)',
  },
});

export default AuthGate;
