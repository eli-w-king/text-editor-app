/**
 * FormattingToolbar.js
 *
 * A frosted glass formatting toolbar for the rich text editor.
 * Positioned at the bottom of the screen, it slides in/out when the editor
 * gains or loses focus. Uses BlurView to match the app's FloatingMenu aesthetic.
 *
 * Dependencies:
 *   - react-native-pell-rich-editor (actions enum)
 *   - expo-blur (BlurView for frosted glass)
 *   - @expo/vector-icons (Ionicons for icon buttons)
 *   - react-native-safe-area-context (bottom inset for iPhone home bar)
 *
 * Props:
 *   editorRef  - React ref pointing to the RichEditor instance from
 *                react-native-pell-rich-editor. Used to dispatch formatting
 *                actions (bold, italic, etc.) and insert links.
 *   theme      - 'light' | 'dark'. Controls text/icon colors and blur tint.
 *                Defaults to 'light' if not provided.
 *   visible    - Boolean controlling whether the toolbar is shown. When false
 *                the toolbar slides offscreen and becomes non-interactive.
 *                Defaults to false.
 *
 * Usage:
 *   <FormattingToolbar
 *     editorRef={richEditorRef}
 *     theme={theme}
 *     visible={isEditorFocused && !showingSavedNotes}
 *   />
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { actions } from 'react-native-pell-rich-editor';

/**
 * Configuration for toolbar buttons.
 *
 * Each entry is one of three types:
 *   - 'text'    : renders a styled text label (e.g. B, I, U, H1, H2)
 *   - 'icon'    : renders an Ionicons icon
 *   - 'divider' : renders a visual separator between button groups
 *
 * The `special` field on the link button triggers the platform-aware URL prompt
 * instead of directly calling sendAction.
 */
const TOOLBAR_BUTTONS = [
  { action: actions.setBold, label: 'B', style: { fontWeight: '700' }, type: 'text' },
  { action: actions.setItalic, label: 'I', style: { fontStyle: 'italic' }, type: 'text' },
  { action: actions.setUnderline, label: 'U', style: { textDecorationLine: 'underline' }, type: 'text' },
  { action: actions.heading1, label: 'H1', style: { fontWeight: '600', fontSize: 13 }, type: 'text' },
  { action: actions.heading2, label: 'H2', style: { fontWeight: '600', fontSize: 13 }, type: 'text' },
  { type: 'divider' },
  { action: actions.insertBulletsList, icon: 'list-outline', type: 'icon' },
  { action: actions.insertOrderedList, icon: 'reorder-four-outline', type: 'icon' },
  { type: 'divider' },
  { action: actions.insertLink, icon: 'link-outline', type: 'icon', special: 'link' },
  { action: actions.code, icon: 'code-slash-outline', type: 'icon' },
  { action: actions.blockquote, icon: 'chatbubble-outline', type: 'icon' },
];

export default function FormattingToolbar({ editorRef, theme = 'light', visible = false }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const isDark = theme === 'dark';

  // Animate toolbar in/out based on visibility
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 100,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  /**
   * Insert a link with a platform-specific prompt.
   *
   * iOS: Uses Alert.prompt for a native text input dialog.
   * Android: Falls back to the editor's built-in link dialog because
   * Alert.prompt is iOS-only.
   *
   * Automatically prefixes "https://" if the user omits the protocol.
   *
   * Defined before handleAction so it can be included in handleAction's
   * dependency array without violating the rules-of-hooks ordering.
   */
  const handleLink = useCallback(() => {
    if (!editorRef?.current) return;

    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Insert Link',
        'Enter URL:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Insert',
            onPress: (url) => {
              if (url && url.trim()) {
                // Ensure URL has a protocol prefix
                const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                editorRef.current?.insertLink('Link', fullUrl);
              }
            },
          },
        ],
        'plain-text',
        'https://'
      );
    } else {
      // Android fallback -- use the editor's built-in link dialog
      editorRef.current?.sendAction(actions.insertLink, 'result');
    }
  }, [editorRef]);

  /**
   * Dispatches the formatting action to the RichEditor.
   * Link insertion is handled separately via handleLink() which shows
   * a platform-specific URL prompt.
   */
  const handleAction = useCallback((button) => {
    if (!editorRef?.current) return;

    if (button.special === 'link') {
      handleLink();
      return;
    }

    editorRef.current.sendAction(button.action, 'result');
  }, [editorRef, handleLink]);

  // Theme-dependent colors matching the app's frosted glass aesthetic.
  // Values align with FloatingMenu.tsx getThemeColors().
  const bgColor = isDark ? 'rgba(40,40,42,0.5)' : 'rgba(255,255,255,0.3)';
  const iconColor = isDark ? '#ECEDEE' : '#1C1C1E';
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY }],
          // Bottom padding accounts for iPhone home bar via SafeAreaInsets
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Frosted glass background -- matches FloatingMenu aesthetic */}
      <BlurView
        intensity={40}
        tint={isDark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}
      />

      {/* Subtle top border */}
      <View
        style={[
          styles.topBorder,
          { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        ]}
      />

      {/* Horizontal scrollable button row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {TOOLBAR_BUTTONS.map((button, index) => {
          // Render divider separators between button groups
          if (button.type === 'divider') {
            return (
              <View
                key={`divider-${index}`}
                style={[styles.divider, { backgroundColor: dividerColor }]}
              />
            );
          }

          return (
            <TouchableOpacity
              key={button.action || `btn-${index}`}
              style={[styles.button, { borderColor }]}
              onPress={() => handleAction(button)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={button.label || button.icon?.replace('-outline', '') || 'format'}
            >
              {button.type === 'text' ? (
                <Text style={[styles.buttonLabel, { color: iconColor }, button.style]}>
                  {button.label}
                </Text>
              ) : (
                <Ionicons name={button.icon} size={20} color={iconColor} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    overflow: 'hidden',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 8,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonLabel: {
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
});
