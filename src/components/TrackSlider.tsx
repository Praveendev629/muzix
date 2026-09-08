import Slider from '@react-native-community/slider';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Font } from '@/constants/theme';

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface TrackSliderProps {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
}

export default function TrackSlider({ position, duration, onSeek }: TrackSliderProps) {
  const max = duration > 0 ? duration : 1;
  return (
    <View style={styles.wrap}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={max}
        value={Math.min(position, max)}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={Colors.pink}
        maximumTrackTintColor="rgba(255,255,255,0.15)"
        thumbTintColor={Colors.pink}
      />
      <View style={styles.times}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  slider: { width: '100%', height: 40 },
  times: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: -6 },
  time: { color: Colors.textSecondary, fontSize: Font.size.xs, fontVariant: ['tabular-nums'] },
});
