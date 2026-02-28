/**
 * RegisterScreen -- mobile registration form with frosted glass aesthetic.
 *
 * PLATFORM: React Native (mobile)
 * COUNTERPART: desktop/src/pages/Register.tsx (web)
 *
 * Security notes:
 *   - Both password fields use secureTextEntry (native masking).
 *   - Inputs are disabled during submission (editable={!isSubmitting}).
 *   - Client-side validation: email format, password 8+ chars, confirm match.
 *   - Errors (local validation + server) are cleared on every keystroke.
 *   - Submit button is disabled when fields are empty or submission is in-flight.
 *   - Uses isSubmitting (not isLoading) for button state.
 *   - Zero console.log/warn/error statements.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

export default function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const { register, error, clearError, isSubmitting } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Refs for stable error clearing
  const errorRef = useRef(error);
  errorRef.current = error;
  const clearErrorRef = useRef(clearError);
  clearErrorRef.current = clearError;
  const localErrorRef = useRef(localError);
  localErrorRef.current = localError;

  // TextInput refs for keyboard navigation
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const displayError = localError || error;
  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !isSubmitting;

  /**
   * Clear both local validation errors and context-level API errors
   * whenever the user modifies any input field. Uses refs so this
   * callback has zero dependencies and never causes handler recreation.
   */
  const clearAllErrors = useCallback(() => {
    if (localErrorRef.current) setLocalError(null);
    if (errorRef.current) clearErrorRef.current();
  }, []);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    clearAllErrors();
  }, [clearAllErrors]);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    clearAllErrors();
  }, [clearAllErrors]);

  const handleConfirmPasswordChange = useCallback((text: string) => {
    setConfirmPassword(text);
    clearAllErrors();
  }, [clearAllErrors]);

  const handleRegister = useCallback(async () => {
    clearError();
    setLocalError(null);

    const trimmedEmail = email.trim();

    // Client-side validation
    if (!trimmedEmail) {
      setLocalError('Please enter your email address');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await register(trimmedEmail, password);
    } catch {
      // Error is handled by AuthContext and displayed via displayError
    }
  }, [email, password, confirmPassword, clearError, register]);

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#E8E8ED', '#D1D1D6', '#E8E8ED']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.cardContainer}>
          <BlurView intensity={60} tint="light" style={styles.blurCard}>
            <View style={styles.cardContent}>
              {/* Header */}
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Start writing with Inlay</Text>

              {/* Error message */}
              {displayError && (
                <View
                  style={styles.errorContainer}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  <Text style={styles.errorText}>{displayError}</Text>
                </View>
              )}

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  editable={!isSubmitting}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabel="Email address"
                  accessibilityHint="Enter your email address"
                />
              </View>

              {/* Password -- secureTextEntry masks the password field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  value={password}
                  onChangeText={handlePasswordChange}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  secureTextEntry
                  textContentType="newPassword"
                  autoComplete="new-password"
                  editable={!isSubmitting}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  accessibilityLabel="Password"
                  accessibilityHint="Create a password, minimum 8 characters"
                />
              </View>

              {/* Confirm password -- secureTextEntry masks the field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  placeholder="Re-enter your password"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  secureTextEntry
                  textContentType="newPassword"
                  autoComplete="new-password"
                  editable={!isSubmitting}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  accessibilityLabel="Confirm password"
                  accessibilityHint="Re-enter your password to confirm"
                />
              </View>

              {/* Submit button -- disabled when fields are empty or submitting */}
              <TouchableOpacity
                style={[styles.button, !canSubmit && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={!canSubmit}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Create account"
                accessibilityState={{ disabled: !canSubmit }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Switch to login */}
              <TouchableOpacity
                style={styles.switchButton}
                onPress={onSwitchToLogin}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Switch to sign in"
              >
                <Text style={styles.switchText}>
                  Already have an account?{' '}
                  <Text style={styles.switchLink}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  blurCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  cardContent: {
    padding: 32,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '300',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -0.5,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.45)',
    marginBottom: 28,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.5)',
    marginBottom: 6,
    letterSpacing: 0.3,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1C1C1E',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
  },
  button: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.45)',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }),
  },
  switchLink: {
    color: '#1C1C1E',
    textDecorationLine: 'underline',
  },
});
