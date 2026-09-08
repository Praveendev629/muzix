import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Artwork from '@/components/Artwork';
import Icon from '@/components/Icon';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font, Radius } from '@/constants/theme';

/** Persistent mini-player shown above the tab bar while music is active. */
export default function MiniPlayer() {
  const router = useRouter();
  const activeSong = useMusicStore((s) => s.activeSong);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const position = useMusicStore((s) => s.position);
  const duration = useMusicStore((s) => s.duration);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const translateY = useRef(new Animated.Value(120)).current;
  const height = useRef(new Animated.Value(0)).current;

  const visible = !!activeSong;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: visible ? 0 : 120, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.timing(height, { toValue: visible ? 66 : 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [visible, translateY, height]);

  if (!activeSong) return null;
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }], height }]}>
      <Pressable style={styles.card} onPress={() => router.push('/player')}>
        <View style={[styles.progressTrack, { width: `${progress * 100}%` }]} />
        <Artwork artwork={activeSong.artwork} seed={activeSong.album} size={50} radius={12} />
        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.title}>{activeSong.title}</Text>
          <Text numberOfLines={1} style={styles.artist}>{activeSong.artist}</Text>
        </View>
        <Pressable onPress={(e) => { e.stopPropagation(); togglePlay(); }} style={styles.playBtn} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={24} color={Colors.white} />
        </Pressable>
        <Icon name="chevron-forward" size={20} color={Colors.textSecondary} onPress={() => router.push('/player')} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', paddingHorizontal: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.cardElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 8, overflow: 'hidden' },
  progressTrack: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: Colors.pink },
  info: { flex: 1 },
  title: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
  artist: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
  playBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,20,147,0.18)', borderWidth: 1, borderColor: Colors.borderStrong },
});
