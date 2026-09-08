import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { Colors, Font } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  icon?: IconName;
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export default function SectionHeader({ title, icon, action, onAction, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        {icon ? <Icon name={icon} size={17} color={Colors.purpleBright} /> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action ? (
        <Text style={styles.action} onPress={onAction}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold, letterSpacing: 0.2 },
  action: { color: Colors.pink, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
});
