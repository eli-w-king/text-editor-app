import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

/**
 * Auto-save status indicator
 * Shows "Saving..." or "Saved" with a subtle fade animation
 * 
 * @param {Object} props
 * @param {'idle' | 'saving' | 'saved' | 'error'} props.status
 * @param {'light' | 'dark'} props.theme
 */
export default function SaveIndicator({ status, theme }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const isDark = theme === 'dark';

  useEffect(() => {
    if (status === 'saving' || status === 'saved' || status === 'error') {
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Auto-fade out after saved
      if (status === 'saved') {
        const timeout = setTimeout(() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }).start();
        }, 1500);
        return () => clearTimeout(timeout);
      }
    } else {
      // Fade out for idle
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [status]);

  const getText = () => {
    switch (status) {
      case 'saving': return 'Saving...';
      case 'saved': return 'Saved';
      case 'error': return 'Save failed';
      default: return '';
    }
  };

  const getColor = () => {
    if (status === 'error') return '#FF3B30';
    return isDark ? '#9BA1A6' : '#687076';
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={[styles.text, { color: getColor() }]}>
        {getText()}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});
