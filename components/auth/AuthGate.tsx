import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../context/AuthContext';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';

/**
 * AuthGate wraps the app's main content.
 * - Shows a loading screen while restoring the session.
 * - Shows LoginScreen or RegisterScreen when unauthenticated.
 * - Renders children when authenticated.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  if (isLoading) {
    return <LoadingScreen />;
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
 * A minimal loading screen matching the app aesthetic.
 * Shown while the auth session is being restored on startup.
 */
function LoadingScreen() {
  return (
    <View style={loadingStyles.container}>
      {/* Decorative watercolor accents */}
      <View style={loadingStyles.dotAccent1} />
      <View style={loadingStyles.dotAccent2} />

      <View style={loadingStyles.cardWrapper}>
        <BlurView
          intensity={40}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View style={loadingStyles.cardContent}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={loadingStyles.loadingText}>Loading...</Text>
        </View>
      </View>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8E8ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotAccent1: {
    position: 'absolute',
    top: '20%',
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(45, 64, 116, 0.08)', // darkBlue family
  },
  dotAccent2: {
    position: 'absolute',
    bottom: '25%',
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(88, 47, 100, 0.08)', // deepPurple family
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
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
});

export default AuthGate;
