/**
 * SaveIndicator.js
 *
 * A subtle auto-save status indicator that fades in/out to show the current
 * save state. Designed to sit in the editor header bar (next to the title
 * or back button) without distracting from the writing experience.
 *
 * States:
 *   'idle'   - Hidden (fully transparent). No save in progress.
 *   'saving' - Visible. Shows "Saving..." while content is being persisted.
 *   'saved'  - Visible briefly. Shows "Saved" with a 1.5s delay before
 *              fading out over 800ms.
 *   'error'  - Visible. Shows "Save failed" in red. Does not auto-hide;
 *              the parent should clear the error state when ready.
 *
 * Props:
 *   status - 'idle' | 'saving' | 'saved' | 'error'. Controls visibility
 *            and displayed text.
 *   theme  - 'light' | 'dark'. Controls the text color (muted gray that
 *            fits the frosted glass UI). Defaults to 'light'.
 *
 * Usage:
 *   <SaveIndicator status={saveStatus} theme={theme} />
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

export default function SaveIndicator({ status, theme = 'light' }) {
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
      // Fade out for idle or any unknown status
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [status, opacity]);

  /**
   * Map status to display text.
   * @returns {string}
   */
  const getText = () => {
    switch (status) {
      case 'saving': return 'Saving...';
      case 'saved': return 'Saved';
      case 'error': return 'Save failed';
      default: return '';
    }
  };

  /**
   * Map status to text color.
   * Error state uses system red; all other states use a muted gray
   * appropriate for the current theme.
   * @returns {string}
   */
  const getColor = () => {
    if (status === 'error') return '#FF3B30';
    return isDark ? '#9BA1A6' : '#687076';
  };

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Animated.Text style={[styles.text, { color: getColor() }]}>
        {getText()}
      </Animated.Text>
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
