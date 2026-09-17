import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, Shadow, useTheme } from '@/constants/theme';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        outer: { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.glass, overflow: 'hidden' },
        inner: { borderRadius: Radius.lg - 1 },
      }),
    [Colors],
  );
};

interface NeonCardProps extends ViewProps {
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** Glassmorphism card with a thin neon border and optional soft glow. */
export default function NeonCard({ glow = false, style, contentStyle, children, ...rest }: NeonCardProps) {
  const { Colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.outer, glow ? Shadow.neon : null, style]}>
      <LinearGradient colors={[`${Colors.purple}24`, `${Colors.pink}0D`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.inner, contentStyle]} {...rest}>
        {children}
      </View>
    </View>
  );
}
