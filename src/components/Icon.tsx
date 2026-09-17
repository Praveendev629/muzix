import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import type { TextStyle } from 'react-native';
import { useTheme } from '@/constants/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: TextStyle;
}

/** Consistent icon primitive — the whole app is icon-only (no emojis). */
export default function Icon({ name, size = 22, color, style }: IconProps) {
  const { Colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? Colors.text} style={style} />;
}
