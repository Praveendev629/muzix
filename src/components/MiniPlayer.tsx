import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Artwork from '@/components/Artwork';
import Icon from '@/components/Icon';
import { useMusicStore } from '@/store/musicStore';
import { Font, Radius, useTheme } from '@/constants/theme';

const SWIPE_THRESHOLD = 60;
const FLING_VELOCITY = 0.5;
const TAP_MOVE = 12;
const TAP_MS = 400;

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        wrap: { overflow: 'hidden', paddingHorizontal: 12 },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: Colors.cardElevated,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: Colors.border,
          padding: 8,
          overflow: 'hidden',
        },
        progressTrack: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: Colors.pink },
        info: { flex: 1 },
        title: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
        artist: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
        playBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: `${Colors.pink}2E`, borderWidth: 1, borderColor: Colors.borderStrong },
        chevron: { paddingHorizontal: 2 },
      }),
    [Colors],
  );
};

/** Persistent mini-player shown above the tab bar while music is active. */
export default function MiniPlayer() {
  const router = useRouter();
  const { Colors } = useTheme();
  const styles = useStyles();
  const activeSong = useMusicStore((s) => s.activeSong);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const position = useMusicStore((s) => s.position);
  const duration = useMusicStore((s) => s.duration);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const next = useMusicStore((s) => s.next);
  const previous = useMusicStore((s) => s.previous);
  const translateY = useRef(new Animated.Value(120)).current;
  const height = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.Value(0)).current;
  const cardW = useRef(400);
  const busy = useRef(false);
  const startTime = useRef(0);

  const visible = !!activeSong;

  useEffect(() => {
    // Both animations must use the same driver. Mixing useNativeDriver values on
    // one Animated.View makes RN throw "Attempting to run JS driven animation on
    // animated node that has been moved to native" (crash during open-with flow).
    Animated.parallel([
      Animated.spring(translateY, { toValue: visible ? 0 : 120, useNativeDriver: false, damping: 18, stiffness: 200 }),
      Animated.timing(height, { toValue: visible ? 66 : 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [visible, translateY, height]);

  // Reversed slide: the outgoing card leaves against the finger's direction and
  // the incoming card slides in from the same side the finger dragged towards.
  const settle = (dir: 1 | -1) => {
    const far = Math.max(cardW.current, 400);
    Animated.timing(pan, { toValue: -dir * far, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      if (dir === -1) next();
      else previous();
      pan.setValue(dir * far);
      Animated.timing(pan, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
        busy.current = false;
      });
    });
  };

  const snapBack = () => {
    Animated.spring(pan, { toValue: 0, useNativeDriver: false, friction: 14, tension: 90 }).start(() => {
      busy.current = false;
    });
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !busy.current,
      onMoveShouldSetPanResponder: (_, g) => !busy.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startTime.current = Date.now();
      },
      onPanResponderMove: (_, g) => {
        const far = Math.max(cardW.current, 400);
        pan.setValue(Math.max(-far, Math.min(far, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const horizontal = Math.abs(g.dx) > Math.abs(g.dy);
        const fling = Math.abs(g.vx) > FLING_VELOCITY;
        busy.current = true;
        if (horizontal && (g.dx <= -SWIPE_THRESHOLD || (fling && g.dx < -20))) {
          settle(-1);
        } else if (horizontal && (g.dx >= SWIPE_THRESHOLD || (fling && g.dx > 20))) {
          settle(1);
        } else if (
          Math.abs(g.dx) < TAP_MOVE &&
          Math.abs(g.dy) < TAP_MOVE &&
          Date.now() - startTime.current < TAP_MS
        ) {
          busy.current = false;
          router.push('/player');
        } else {
          snapBack();
        }
      },
      onPanResponderTerminate: snapBack,
    })
  ).current;

  if (!activeSong) return null;
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateY }], height }]}
      onLayout={(e) => {
        if (e.nativeEvent.layout.width > 0) cardW.current = e.nativeEvent.layout.width;
      }}
    >
      <Animated.View style={[styles.card, { transform: [{ translateX: pan }] }]} {...responder.panHandlers}>
        <View style={[styles.progressTrack, { width: `${progress * 100}%` }]} />
        <Artwork artwork={activeSong.artwork} seed={activeSong.album} size={50} radius={12} />
        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.title}>{activeSong.title}</Text>
          <Text numberOfLines={1} style={styles.artist}>{activeSong.artist}</Text>
        </View>
        <Pressable onPress={togglePlay} style={styles.playBtn} hitSlop={4} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={24} color={Colors.white} />
        </Pressable>
        <View style={styles.chevron}>
          <Icon name="chevron-forward" size={20} color={Colors.textSecondary} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}