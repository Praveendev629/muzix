import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { Font, Radius, useTheme } from '@/constants/theme';

const STEPS = [-0.5, -0.1, 0.1, 0.5];

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
        label: { color: Colors.textSecondary, fontSize: Font.size.xs, fontWeight: Font.weight.semibold, marginRight: 2 },
        btn: {
          paddingHorizontal: 8,
          height: 26,
          borderRadius: Radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: Colors.borderStrong,
          backgroundColor: Colors.card,
        },
        btnText: { color: Colors.textSecondary, fontSize: Font.size.xs, fontWeight: Font.weight.semibold, fontVariant: ['tabular-nums'] },
        value: {
          paddingHorizontal: 8,
          height: 26,
          borderRadius: Radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors.purple,
        },
        valueText: { color: Colors.white, fontSize: Font.size.xs, fontWeight: Font.weight.bold, fontVariant: ['tabular-nums'] },
        resetBtn: { width: 26, height: 26, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
      }),
    [Colors],
  );
};

interface LyricAlignBarProps {
  offset: number;
  onChange: (delta: number) => void;
  onReset: () => void;
}

/** Compact -/+/reset control for nudging synced lyrics into alignment. */
export default function LyricAlignBar({ offset, onChange, onReset }: LyricAlignBarProps) {
  const { Colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.wrap} accessibilityLabel={`Lyrics alignment ${offset}s`}>
      <Text style={styles.label}>Align</Text>
      {STEPS.map((d) => (
        <Pressable key={d} onPress={() => onChange(d)} style={styles.btn} hitSlop={3} accessibilityLabel={`${d > 0 ? '+' : ''}${d} seconds`}>
          <Text style={styles.btnText}>{d > 0 ? `+${d}` : d}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onReset} style={styles.value} hitSlop={3} accessibilityLabel="Reset alignment">
        <Text style={styles.valueText}>{offset === 0 ? '0.0s' : `${offset > 0 ? '+' : ''}${offset.toFixed(1)}s`}</Text>
      </Pressable>
      <Pressable onPress={onReset} style={styles.resetBtn} hitSlop={3} accessibilityLabel="Reset sync offset">
        <Icon name="refresh" size={13} color={Colors.pink} />
      </Pressable>
    </View>
  );
}