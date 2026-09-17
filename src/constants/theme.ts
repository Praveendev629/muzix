import React, { createContext, useContext, useMemo } from 'react';
import { Platform } from 'react-native';
import { Appearance } from 'react-native';
import { useMusicStore } from '@/store/musicStore';
import type { AccentName, CustomAccentSettings, CustomThemeSettings, ThemeName } from '@/types/music';
import { deriveAccent, isLight, mix, withAlpha } from '@/utils/color';

/**
 * muzix design system — futuristic neon theme.
 * Near-black (or light) backgrounds, neon purple / pink / magenta,
 * small red accents, glassmorphism cards, neon borders and soft glows.
 * The active palette is resolved from the user's settings via ThemeProvider.
 */

export interface Palette {
  bg: string;
  bgSecondary: string;
  card: string;
  cardElevated: string;
  purple: string;
  purpleBright: string;
  pink: string;
  magenta: string;
  red: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  glass: string;
  success: string;
  warning: string;
  danger: string;
  white: string;
  black: string;
  transparent: string;
}

const ACCENTS: Record<Exclude<AccentName, 'custom'>, { purple: string; purpleBright: string; pink: string; magenta: string }> = {
  purplePink: { purple: '#7B2CFF', purpleBright: '#A855F7', pink: '#FF1493', magenta: '#FF007F' },
  bluePurple: { purple: '#2E5BFF', purpleBright: '#5B8CFF', pink: '#00B7EB', magenta: '#7C4DFF' },
  redPurple: { purple: '#E01E4C', purpleBright: '#F4507C', pink: '#FF5B7F', magenta: '#E01E4C' },
};

function resolveAccent(
  accent: AccentName,
  custom: CustomAccentSettings | null | undefined
): { purple: string; purpleBright: string; pink: string; magenta: string } {
  if (accent === 'custom' && custom?.base) return deriveAccent(custom.base);
  return ACCENTS[accent as Exclude<AccentName, 'custom'>] ?? ACCENTS.purplePink;
}

export function resolveMode(theme: ThemeName): 'dark' | 'light' {
  if (theme === 'light') return 'light';
  if (theme === 'system') return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  return 'dark';
}

export function makePalette(
  theme: ThemeName,
  accent: AccentName,
  custom?: { theme?: CustomThemeSettings | null; accent?: CustomAccentSettings | null }
): Palette {
  const acc = resolveAccent(accent, custom?.accent);
  if (theme === 'custom' && custom?.theme) {
    const t = custom.theme;
    const light = isLight(t.bg);
    const card = t.card;
    return {
      bg: t.bg,
      bgSecondary: light ? mix(t.bg, '#FFFFFF', 0.5) : mix(t.bg, '#000000', 0.06),
      card,
      cardElevated: light ? mix(card, '#FFFFFF', 0.35) : mix(card, '#FFFFFF', 0.08),
      purple: acc.purple,
      purpleBright: acc.purpleBright,
      pink: acc.pink,
      magenta: acc.magenta,
      red: '#FF1744',
      text: t.text,
      textSecondary: withAlpha(t.text, 0.72),
      textMuted: withAlpha(t.text, 0.5),
      border: withAlpha(acc.purple, 0.24),
      borderStrong: withAlpha(acc.pink, 0.45),
      glass: light ? 'rgba(255,255,255,0.6)' : withAlpha(card, 0.55),
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#FF1744',
      white: '#FFFFFF',
      black: '#000000',
      transparent: 'transparent',
    };
  }
  const mode = resolveMode(theme);
  const light = mode === 'light';
  return {
    bg: light ? '#F4F2FA' : '#05030A',
    bgSecondary: light ? '#E9E5F3' : '#0B0715',
    card: light ? '#FFFFFF' : '#110C1D',
    cardElevated: light ? '#FFFFFF' : '#171027',

    purple: acc.purple,
    purpleBright: acc.purpleBright,
    pink: acc.pink,
    magenta: acc.magenta,
    red: '#FF1744',

    text: light ? '#1B1530' : '#FFFFFF',
    textSecondary: light ? '#5B5470' : '#A9A2B8',
    textMuted: light ? '#8B84A0' : '#6B6478',

    border: light ? `${acc.purple}3A` : `${acc.purple}38`,
    borderStrong: light ? `${acc.pink}59` : `${acc.pink}73`,
    glass: light ? 'rgba(255,255,255,0.6)' : 'rgba(17,12,29,0.55)',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#FF1744',
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
  };
}

export function makeGradients(Colors: Palette): {
  primary: [string, string];
  magentaPink: [string, string];
  purpleMagenta: [string, string];
  redMagenta: [string, string];
  bgScreen: [string, string, string];
  artwork: [string, string, string];
  glow: [string, string];
} {
  const light = Colors.bg === '#F4F2FA';
  return {
    primary: [Colors.purple, Colors.pink],
    magentaPink: [Colors.magenta, Colors.pink],
    purpleMagenta: [Colors.purple, Colors.magenta],
    redMagenta: [Colors.red, Colors.magenta],
    bgScreen: [Colors.bg, light ? '#ECE8F6' : '#0A0613', Colors.bgSecondary] as [string, string, string],
    artwork: [Colors.purpleBright, Colors.pink, Colors.red] as [string, string, string],
    glow: [Colors.purpleBright, Colors.magenta] as [string, string],
  };
}

export interface ThemeValue {
  Colors: Palette;
  Gradients: ReturnType<typeof makeGradients>;
  mode: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeValue>({
  Colors: makePalette('dark', 'purplePink'),
  Gradients: makeGradients(makePalette('dark', 'purplePink')),
  mode: 'dark',
});

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/** Resolves the active palette from settings and provides it to the app. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useMusicStore((s) => s.settings);
  const value = useMemo<ThemeValue>(() => {
    const Colors = makePalette(settings.theme, settings.accent, {
      theme: settings.customTheme,
      accent: settings.customAccent,
    });
    return { Colors, Gradients: makeGradients(Colors), mode: resolveMode(settings.theme) };
  }, [settings.theme, settings.accent, settings.customTheme, settings.customAccent]);
  return React.createElement(ThemeContext.Provider, { value }, children);
}

export const Radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 };

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const Font = {
  size: { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, xxxl: 36 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800' } as const,
};

export const Shadow = {
  neon: Platform.select({
    ios: { shadowColor: '#A855F7', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 12, shadowColor: '#A855F7' },
    default: {},
  }),
  strong: Platform.select({
    ios: { shadowColor: '#FF1493', shadowOpacity: 0.5, shadowRadius: 26, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 18 },
    default: {},
  }),
};

/** Watermark label used across the app. */
export const Watermark = 'developed by praveen';