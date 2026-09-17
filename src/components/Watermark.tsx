import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Icon from '@/components/Icon';
import { Font, Watermark as WATERMARK_LABEL, useTheme } from '@/constants/theme';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.6 },
        text: { color: Colors.textMuted, fontSize: Font.size.xs, fontWeight: Font.weight.medium, letterSpacing: 0.5 },
      }),
    [Colors],
  );
};

/** "developed by praveen" watermark used on key screens. */
export default function Watermark({ style }: { style?: ViewStyle }) {
  const { Colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.row, style]} pointerEvents="none">
      <Icon name="code-slash" size={12} color={Colors.textMuted} />
      <Text style={styles.text}>{WATERMARK_LABEL}</Text>
    </View>
  );
}
