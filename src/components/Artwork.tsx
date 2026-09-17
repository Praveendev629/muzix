import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { StyleSheet, View, Image } from 'react-native';
import Icon from '@/components/Icon';
import type { Palette } from '@/constants/theme';
import { useTheme } from '@/constants/theme';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        ring: { overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
        overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
      }),
    [Colors],
  );
};

/** Deterministic neon gradient from a string seed. */
function paletteFor(seed: string, C: Palette): [string, string, string] {
  const PALETTES: [string, string, string][] = [
    [C.purple, C.magenta, C.pink],
    [C.purpleBright, C.purple, C.magenta],
    [C.pink, C.magenta, C.red],
    [C.purple, C.pink, C.red],
    [C.magenta, C.purpleBright, C.purple],
    [C.red, C.pink, C.magenta],
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

interface ArtworkProps {
  artwork?: string | null;
  seed?: string;
  size?: number;
  radius?: number;
  iconSize?: number;
  style?: any;
}

/** Album artwork: shows the image when available, otherwise a neon gradient + music icon. */
export default function Artwork({ artwork, seed = 'muzix', size = 120, radius, iconSize, style }: ArtworkProps) {
  const { Colors } = useTheme();
  const styles = useStyles();
  const r = radius ?? Math.min(size, 140) * 0.18;

  if (artwork) {
    return (
      <View style={[styles.ring, { width: size, height: size, borderRadius: r }, style]}>
        <Image source={{ uri: artwork }} style={{ width: size, height: size, borderRadius: r }} resizeMode="cover" />
      </View>
    );
  }

  const [c1, c2, c3] = paletteFor(seed, Colors);
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: r }, style]}>
      <LinearGradient colors={[c1, c2, c3]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: r }]}>
        <View style={styles.overlay}>
          <Icon name="musical-notes" size={iconSize ?? size * 0.34} color="rgba(255,255,255,0.9)" />
        </View>
      </LinearGradient>
    </View>
  );
}
