import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, Image } from 'react-native';
import Icon from '@/components/Icon';
import { Colors } from '@/constants/theme';

const PALETTES: [string, string, string][] = [
  [Colors.purple, Colors.magenta, Colors.pink],
  [Colors.purpleBright, Colors.purple, Colors.magenta],
  [Colors.pink, Colors.magenta, Colors.red],
  [Colors.purple, Colors.pink, Colors.red],
  [Colors.magenta, Colors.purpleBright, Colors.purple],
  [Colors.red, Colors.pink, Colors.magenta],
];

/** Deterministic neon gradient from a string seed. */
function paletteFor(seed: string): [string, string, string] {
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
}

/** Album artwork: shows the image when available, otherwise a neon gradient + music icon. */
export default function Artwork({ artwork, seed = 'muzix', size = 120, radius, iconSize }: ArtworkProps) {
  const r = radius ?? Math.min(size, 140) * 0.18;

  if (artwork) {
    return (
      <View style={[styles.ring, { width: size, height: size, borderRadius: r }]}>
        <Image source={{ uri: artwork }} style={{ width: size, height: size, borderRadius: r }} resizeMode="cover" />
      </View>
    );
  }

  const [c1, c2, c3] = paletteFor(seed);
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: r }]}>
      <LinearGradient colors={[c1, c2, c3]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: r }]}>
        <View style={styles.overlay}>
          <Icon name="musical-notes" size={iconSize ?? size * 0.34} color="rgba(255,255,255,0.9)" />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
