import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

interface EqualizerBarsProps {
  active?: boolean;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

/** Animated equalizer bars to indicate the currently playing track. */
export default function EqualizerBars({ active = true, size = 16, color = Colors.pink, style }: EqualizerBarsProps) {
  const anims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.4))).current;

  useEffect(() => {
    if (!active) {
      anims.forEach((a) => a.stopAnimation());
      anims.forEach((a) => a.setValue(0.4));
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, { toValue: 1, duration: 260 + i * 90, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.4, duration: 260 + i * 90, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, anims]);

  const barW = size * 0.2;
  const barGap = size * 0.14;

  return (
    <View style={[styles.row, style]} accessibilityLabel="Playing indicator">
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            width: barW,
            height: size,
            marginHorizontal: barGap / 2,
            borderRadius: barW / 2,
            backgroundColor: color,
            transform: [{ scaleY: a }],
            opacity: active ? 1 : 0.35,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
