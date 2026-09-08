import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/theme';

interface NeonCardProps extends ViewProps {
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** Glassmorphism card with a thin neon border and optional soft glow. */
export default function NeonCard({ glow = false, style, children, ...rest }: NeonCardProps) {
  return (
    <View style={[styles.outer, glow ? Shadow.neon : null, style]}>
      <LinearGradient colors={['rgba(123,44,255,0.14)', 'rgba(255,20,147,0.05)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.inner} {...rest}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glass, overflow: 'hidden' },
  inner: { borderRadius: Radius.lg - 1 },
});
