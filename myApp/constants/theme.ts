/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#1C1C1E',
    background: '#E8E8ED',
    tint: tintColorLight,
    icon: '#636366',
    tabIconDefault: '#636366',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
  ultramarine: {
    text: '#FFFFFF',
    background: '#002080', // Deep bright ultramarine
    tint: '#4D79FF',
    icon: '#B3C6FF',
    tabIconDefault: '#B3C6FF',
    tabIconSelected: '#FFFFFF',
  },
  orange: {
    text: '#FFFFFF',
    background: '#B34700', // Burnt orange
    tint: '#FF9966',
    icon: '#FFCCB3',
    tabIconDefault: '#FFCCB3',
    tabIconSelected: '#FFFFFF',
  },
  plum: {
    text: '#FFFFFF',
    background: '#4A2C38', // Brown plum
    tint: '#D6A8BD',
    icon: '#E5C3D1',
    tabIconDefault: '#E5C3D1',
    tabIconSelected: '#FFFFFF',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
