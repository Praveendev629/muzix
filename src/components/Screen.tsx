import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Watermark from '@/components/Watermark';
import { useTheme } from '@/constants/theme';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1, backgroundColor: Colors.bg },
        safe: { flex: 1 },
        watermark: { paddingVertical: 10 },
      }),
    [Colors],
  );
};

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  showWatermark?: boolean;
}

/** Full-screen neon-gradient background + safe area wrapper. */
export default function Screen({ children, style, edges = ['top', 'bottom'], showWatermark = false }: ScreenProps) {
  const { Colors, Gradients, mode } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.flex}>
      <LinearGradient colors={Gradients.bgScreen} style={StyleSheet.absoluteFill} />
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView edges={edges} style={[styles.safe, style]}>
        {children}
        {showWatermark ? <Watermark style={styles.watermark} /> : null}
      </SafeAreaView>
    </View>
  );
}
