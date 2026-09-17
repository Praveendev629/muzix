import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Icon, { type IconName } from '@/components/Icon';
import { Font, Radius, useTheme } from '@/constants/theme';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: Radius.pill, overflow: 'hidden', paddingHorizontal: 26 },
        pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
        disabled: { opacity: 0.4 },
        text: { color: Colors.white, fontSize: Font.size.md, fontWeight: Font.weight.bold },
      }),
    [Colors],
  );
};

interface GlowButtonProps {
  title: string;
  onPress: () => void;
  icon?: IconName;
  gradient?: [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export default function GlowButton({ title, onPress, icon, gradient, style, disabled }: GlowButtonProps) {
  const { Colors, Gradients } = useTheme();
  const styles = useStyles();
  const grad = gradient ?? Gradients.primary;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      {icon ? <Icon name={icon} size={20} color={Colors.white} /> : null}
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}
