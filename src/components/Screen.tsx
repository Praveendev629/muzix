import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Watermark from '@/components/Watermark';
import { Colors, Gradients } from '@/constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  showWatermark?: boolean;
}

/** Full-screen neon-gradient background + safe area wrapper. */
export default function Screen({ children, style, edges = ['top', 'bottom'], showWatermark = false }: ScreenProps) {
  return (
    <View style={styles.flex}>
      <LinearGradient colors={Gradients.bgScreen} style={StyleSheet.absoluteFill} />
      <StatusBar style="light" />
      <SafeAreaView edges={edges} style={[styles.safe, style]}>
        {children}
        {showWatermark ? <Watermark style={styles.watermark} /> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },
  watermark: { paddingVertical: 10 },
});
