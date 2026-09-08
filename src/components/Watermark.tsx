import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Icon from '@/components/Icon';
import { Colors, Font, Watermark as WATERMARK_LABEL } from '@/constants/theme';

/** "developed by praveen" watermark used on key screens. */
export default function Watermark({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.row, style]} pointerEvents="none">
      <Icon name="code-slash" size={12} color={Colors.textMuted} />
      <Text style={styles.text}>{WATERMARK_LABEL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.6 },
  text: { color: Colors.textMuted, fontSize: Font.size.xs, fontWeight: Font.weight.medium, letterSpacing: 0.5 },
});
