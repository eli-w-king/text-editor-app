import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef } from 'react';
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

export default function FormattingToolbar({ editorRef, theme, visible }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const isDark = theme === 'dark';

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 100,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleAction = (button) => {
    if (!editorRef?.current) return;

    if (button.special === 'link') {
      handleLink();
      return;
    }

    editorRef.current.sendAction(button.action, 'result');
  };

  const handleLink = () => {
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
      // Android fallback - use the editor's built-in link dialog
      editorRef.current?.sendAction(actions.insertLink, 'result');
    }
  };

  const bgColor = isDark ? 'rgba(40,40,42,0.5)' : 'rgba(255,255,255,0.3)';
  const iconColor = isDark ? '#ECEDEE' : '#1C1C1E';
  const borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY }],
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <BlurView
        intensity={40}
        tint={isDark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}
      />
      <View
        style={[
          styles.topBorder,
          { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        ]}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {TOOLBAR_BUTTONS.map((button, index) => {
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
              key={button.action || index}
              style={[styles.button, { borderColor }]}
              onPress={() => handleAction(button)}
              activeOpacity={0.6}
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
