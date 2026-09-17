import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius, useTheme } from '@/constants/theme';
import { useMusicStore } from '@/store/musicStore';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: Spacing.xxl,
          backgroundColor: Colors.bg,
        },
        iconWrap: {
          width: 96,
          height: 96,
          borderRadius: Radius.xl,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors.card,
          marginBottom: Spacing.xl,
          borderWidth: 1,
          borderColor: Colors.border,
        },
        title: {
          color: Colors.text,
          fontSize: 22,
          fontWeight: '700',
          marginBottom: Spacing.sm,
        },
        subtitle: {
          color: Colors.textSecondary,
          fontSize: 15,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: Spacing.xxl,
        },
        button: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
          borderRadius: Radius.pill,
          backgroundColor: Colors.purple,
        },
        buttonText: {
          color: Colors.white,
          fontSize: 16,
          fontWeight: '600',
        },
      }),
    [Colors],
  );
};

export default function NotFoundScreen() {
  const { Colors } = useTheme();
  const styles = useStyles();
  const initialized = useMusicStore((s) => s.initialized);
  const activeSong = useMusicStore((s) => s.activeSong);
  const done = useRef(false);

  useEffect(() => {
    // Coming back from the media notification can resume the app on a route
    // that no longer exists. Land on the player when music is restored, never
    // on "Page not found".
    const go = (to: string) => {
      if (done.current) return;
      done.current = true;
      router.replace(to);
    };

    // Fast path: a song is already loaded in this session.
    if (activeSong) {
      go('/player');
      return;
    }
    // Cold start: wait for the store to restore the playing track, then decide.
    if (initialized) {
      go('/(tabs)');
      return;
    }
    const t = setTimeout(() => {
      go(useMusicStore.getState().activeSong ? '/player' : '/(tabs)');
    }, 5000);
    return () => clearTimeout(t);
  }, [activeSong, initialized]);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="musical-notes-outline" size={56} color={Colors.purpleBright} />
      </View>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.subtitle}>
        The screen you were looking for doesn&apos;t exist.{'\n'}You can head back to your music.
      </Text>
      <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]} onPress={() => router.replace('/(tabs)')}>
        <Ionicons name="home" size={18} color={Colors.white} />
        <Text style={styles.buttonText}>Go to library</Text>
      </Pressable>
    </View>
  );
}