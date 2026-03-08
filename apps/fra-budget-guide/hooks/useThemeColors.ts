import { useColorScheme } from 'react-native';
import { colors, darkColors, type ThemeColors } from '@/constants/theme';

/**
 * Returns the appropriate color palette based on system color scheme.
 * Falls back to light colors if scheme is indeterminate.
 */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : colors;
}
