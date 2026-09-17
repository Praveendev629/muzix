import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import TrackPlayer from 'react-native-track-player';
import SplashOverlay from '@/components/SplashOverlay';

import { useMusicStore } from '@/store/musicStore';
import { importUri } from '@/services/library';
import { ThemeProvider, useTheme } from '@/constants/theme';


const AUDIO_URL_RE = /\.(mp3|m4a|m4b|aac|wav|flac|ogg|oga|opus|amr|mid|midi|mp4)(\?.*)?$/i;

// Register the background playback service so audio continues when the app is
// backgrounded or the screen is locked. Runs in a headless context.
TrackPlayer.registerPlaybackService(() => require('@/services/playbackService'));

function ThemedStack() {
  const { Colors, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ presentation: 'card' }} />
        <Stack.Screen name="queue" options={{ presentation: 'modal' }} />
        <Stack.Screen name="equalizer" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="liked-songs" />
        <Stack.Screen name="import-songs" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-to-playlist" options={{ presentation: 'modal' }} />
        <Stack.Screen name="playlist/[id]" />
        <Stack.Screen name="album/[id]" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="lyrics" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const init = useMusicStore((s) => s.init);
  const initialized = useMusicStore((s) => s.initialized);
  const [booted, setBooted] = useState(false);
  const timer = useRef<any>(null);

  /**
   * "Open with muzix" — another app (file manager / WhatsApp / etc.) hands us
   * an audio file via an ACTION_VIEW intent. The raw file location arrives as
   * the initial URL (content:// or file://). Import it and start playback.
   */
  const handleIncomingUrl = useCallback(async (raw: string | null) => {
    if (!raw) return;
    // Our own scheme deep links are handled by expo-router.
    if (/^muzix:\/\//i.test(raw)) return;
    if (!/^(content|file):/i.test(raw) && !AUDIO_URL_RE.test(raw)) return;
    const song = await importUri(raw);
    if (!song) return;
    const { playSongs, refreshLibrary } = useMusicStore.getState();
    await refreshLibrary().catch(() => {});
    await playSongs([song], 0);
    try {
      router.replace('/player');
    } catch {
      // Navigation may not be ready during a cold start; the +not-found
      // screen still offers a manual route back to the library.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    Linking.getInitialURL()
      .then((initial) => {
        if (mounted) handleIncomingUrl(initial);
      })
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (mounted) handleIncomingUrl(url);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [handleIncomingUrl]);

  useEffect(() => {
    init();
    timer.current = setTimeout(() => setBooted(true), 4500);
    return () => clearTimeout(timer.current);
  }, [init]);

  useEffect(() => {
    if (initialized) {
      clearTimeout(timer.current);
      setBooted(true);
    }
  }, [initialized]);

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {!booted ? (
          <SplashOverlay />
        ) : (
          <ThemedStack />
        )}
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
