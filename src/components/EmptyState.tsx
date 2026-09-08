import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import GlowButton from '@/components/GlowButton';
import { Colors, Font } from '@/constants/theme';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  buttonTitle?: string;
  onButton?: () => void;
}

export default function EmptyState({ icon, title, subtitle, buttonTitle, onButton }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={52} color={Colors.purpleBright} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {buttonTitle && onButton ? (
        <GlowButton title={buttonTitle} onPress={onButton} icon="musical-notes" style={styles.btn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: 'rgba(123,44,255,0.10)',
    marginBottom: 24,
  },
  title: { color: Colors.text, fontSize: Font.size.xl, fontWeight: Font.weight.bold, textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: Font.size.md, textAlign: 'center', marginTop: 10, lineHeight: 22, maxWidth: 300 },
  btn: { marginTop: 28, minWidth: 220 },
});
