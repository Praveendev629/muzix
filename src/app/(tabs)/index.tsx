import React, { useMemo, useCallback, useState, useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import Artwork from '@/components/Artwork';
import SectionHeader from '@/components/SectionHeader';
import { useMusicStore } from '@/store/musicStore';
import { hasAudioPermission, requestAudioPermission, scanDeviceLibrary } from '@/services/library';
import { Font, Radius, useTheme } from '@/constants/theme';
import type { Song } from '@/types/music';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        content: { paddingBottom: 30 },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
        headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purple, borderWidth: 1, borderColor: Colors.borderStrong },
        greeting: { color: Colors.textSecondary, fontSize: Font.size.sm },
        name: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
        iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
        hList: { paddingHorizontal: 20, gap: 14 },
        card: { width: 132 },
        cardTitle: { color: Colors.text, fontSize: Font.size.sm, fontWeight: Font.weight.semibold, marginTop: 8 },
        cardArtist: { color: Colors.textSecondary, fontSize: Font.size.xs, marginTop: 2 },
        emptyText: { color: Colors.textMuted, fontSize: Font.size.sm, paddingHorizontal: 20, paddingBottom: 12 },
        permCard: { marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
        permRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        permText: { flex: 1, color: Colors.textSecondary, fontSize: Font.size.sm },
        permBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.pink },
        permBtnText: { color: Colors.white, fontWeight: Font.weight.bold },
      }),
    [Colors],
  );
};

export default function HomeScreen() {
  const { Colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const songs = useMusicStore((s) => s.songs);
  const recentIds = useMusicStore((s) => s.recentIds);
  const settings = useMusicStore((s) => s.settings);
  const playSongs = useMusicStore((s) => s.playSongs);
  const refreshLibrary = useMusicStore((s) => s.refreshLibrary);
  const [granted, setGranted] = useState(true);
  const [scanning, setScanning] = useState(false);

  useLayoutEffect(() => { hasAudioPermission().then(setGranted); }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const recentSongs = recentIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean) as Song[];
  const likedSongs = useMemo(() => songs.filter((s) => s.isFavorite), [songs]);

  const grantPermission = async () => {
    const ok = await requestAudioPermission();
    setGranted(ok);
    if (ok && songs.length === 0) { setScanning(true); try { await scanDeviceLibrary(); await refreshLibrary(); } catch {} setScanning(false); }
  };

  return (
    <Screen showWatermark>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}><Icon name="person" size={20} color={Colors.white} /></View>
            <View>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.name}>{settings.name}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
            <Icon name="settings-outline" size={22} color={Colors.text} />
          </Pressable>
        </View>

        {!granted ? (
          <View style={styles.permCard}>
            <View style={styles.permRow}>
              <Icon name="shield-checkmark" size={20} color={Colors.purpleBright} />
              <Text style={styles.permText}>Allow muzix to access your music to scan your library.</Text>
              <Pressable onPress={grantPermission} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Allow</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {songs.length === 0 && granted ? (
          <Text style={styles.emptyText}>No music found. Add songs to your device to get started.</Text>
        ) : null}

        {recentSongs.length > 0 && (
          <>
            <SectionHeader title="Recently Played" icon="time" action="See all" onAction={() => router.push('/recent')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ marginBottom: 4 }} contentContainerStyle={styles.hList}>
              {recentSongs.slice(0, 20).map((item) => (
                <Pressable key={item.id} style={styles.card} onPress={() => playSongs(songs, songs.findIndex((s) => s.id === item.id))}>
                  <Artwork artwork={item.artwork} seed={`${item.album}${item.artist}`} size={132} />
                  <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                  <Text numberOfLines={1} style={styles.cardArtist}>{item.artist}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {likedSongs.length > 0 && (
          <>
            <SectionHeader title="Liked Songs" icon="heart" action="See all" onAction={() => router.push('/liked-songs')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ marginBottom: 4 }} contentContainerStyle={styles.hList}>
              {likedSongs.slice(0, 20).map((item) => (
                <Pressable key={item.id} style={styles.card} onPress={() => playSongs(songs, songs.findIndex((s) => s.id === item.id))}>
                  <Artwork artwork={item.artwork} seed={`${item.album}${item.artist}`} size={132} />
                  <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                  <Text numberOfLines={1} style={styles.cardArtist}>{item.artist}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <SectionHeader title="All Songs" icon="musical-notes" />
        {songs.length === 0 ? (
          <Text style={styles.emptyText}>No songs in your library</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ marginBottom: 4 }} contentContainerStyle={styles.hList}>
            {songs.map((item) => (
              <Pressable key={item.id} style={styles.card} onPress={() => playSongs(songs, songs.findIndex((s) => s.id === item.id))}>
                <Artwork artwork={item.artwork} seed={`${item.album}${item.artist}`} size={132} />
                <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                <Text numberOfLines={1} style={styles.cardArtist}>{item.artist}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </Screen>
  );
}
