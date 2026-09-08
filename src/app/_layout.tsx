import React, { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import TrackPlayer from 'react-native-track-player';
import SplashOverlay from '@/components/SplashOverlay';
import { useMusicStore } from '@/store/musicStore';

// Register the background playback service so audio continues when the app is
// backgrounded or the screen is locked. Runs in a headless context.
TrackPlayer.registerPlaybackService(() => require('@/services/playbackService'));

export default function RootLayout() {
  const init = useMusicStore((s) => s.init);
  const initialized = useMusicStore((s) => s.initialized);
  const [booted, setBooted] = useState(false);
  const timer = useRef<any>(null);

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {!booted ? (
        <SplashOverlay />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#05030A' },
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
        </Stack>
      )}
    </GestureHandlerRootView>
  );
}
