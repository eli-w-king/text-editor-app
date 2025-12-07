/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';

export function useThemeColor(
  props: { light?: string; dark?: string; ultramarine?: string; orange?: string; plum?: string },
  colorName: keyof typeof Colors.light
) {
  const { theme } = useAppContext();
  const colorFromProps = props[theme as keyof typeof props];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
