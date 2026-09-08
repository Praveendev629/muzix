import { Platform } from 'react-native';

/**
 * muzix design system — futuristic neon dark theme.
 * Matches the reference UI: near-black backgrounds, neon purple / pink / magenta,
 * small red accents, glassmorphism cards, neon borders and soft glows.
 */
export const Colors = {
  bg: '#05030A',
  bgSecondary: '#0B0715',
  card: '#110C1D',
  cardElevated: '#171027',

  purple: '#7B2CFF',
  purpleBright: '#A855F7',
  pink: '#FF1493',
  magenta: '#FF007F',
  red: '#FF1744',

  text: '#FFFFFF',
  textSecondary: '#A9A2B8',
  textMuted: '#6B6478',

  border: 'rgba(168,85,247,0.22)',
  borderStrong: 'rgba(255,20,147,0.45)',
  glass: 'rgba(17,12,29,0.55)',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FF1744',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const Gradients = {
  primary: [Colors.purple, Colors.pink] as [string, string, ...string[]],
  magentaPink: [Colors.magenta, Colors.pink] as [string, string, ...string[]],
  purpleMagenta: [Colors.purple, Colors.magenta] as [string, string, ...string[]],
  redMagenta: [Colors.red, Colors.magenta] as [string, string, ...string[]],
  bgScreen: [Colors.bg, '#0A0613', Colors.bgSecondary] as [string, string, ...string[]],
  artwork: [Colors.purpleBright, Colors.pink, Colors.red] as [string, string, ...string[]],
  glow: [Colors.purpleBright, Colors.magenta] as [string, string, ...string[]],
};

export const Radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 };

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const Font = {
  size: { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, xxxl: 36 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800' } as const,
};

export const Shadow = {
  neon: Platform.select({
    ios: { shadowColor: Colors.purpleBright, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 12, shadowColor: Colors.purpleBright },
    default: {},
  }),
  strong: Platform.select({
    ios: { shadowColor: Colors.pink, shadowOpacity: 0.5, shadowRadius: 26, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 18 },
    default: {},
  }),
};

/** Watermark label used across the app. */
export const Watermark = 'developed by praveen';
