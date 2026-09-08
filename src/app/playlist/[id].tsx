import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import Artwork from '@/components/Artwork';
import SongRow from '@/components/SongRow';
import EmptyState from '@/components/EmptyState';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font, Radius } from '@/constants/theme';
import type { Song } from '@/types/music';

export default function PlaylistScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const songs = useMusicStore((s) => s.songs);
  const playlists = useMusicStore((s) => s.playlists);
  const playSongs = useMusicStore((s) => s.playSongs);
  const activeSong = useMusicStore((s) => s.activeSong);

  const playlist = playlists.find((p) => p.id === id);
  const list = (playlist?.songIds ?? []).map((sid) => songs.find((s) => s.id === sid)).filter(Boolean) as Song[];

  if (!playlist) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title="Playlist not found" />
      </Screen>
    );
  }

  const total = list.reduce((a, b) => a + b.duration, 0);
  const durationLabel = `${list.length} songs · ${Math.floor(total / 60)}m`;

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="arrow-back" size={22} color={Colors.text} /></Pressable>
        <Text style={styles.title} numberOfLines={1}>{playlist.name}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Artwork artwork={playlist.artwork} seed={playlist.name} size={190} radius={28} iconSize={70} />
            <Text style={styles.heroTitle}>{playlist.name}</Text>
            <Text style={styles.heroSub}>{durationLabel}</Text>
            <View style={styles.heroBtns}>
              <Pressable onPress={() => playSongs(list, 0)} style={styles.heroBtn}>
                <Icon name="play" size={20} color={Colors.white} />
                <Text style={styles.heroBtnText}>Play</Text>
              </Pressable>
              <Pressable onPress={() => playSongs([...list].sort(() => Math.random() - 0.5), 0)} style={[styles.heroBtn, styles.heroBtnGhost]}>
                <Icon name="shuffle" size={20} color={Colors.pink} />
                <Text style={[styles.heroBtnText, { color: Colors.pink }]}>Shuffle</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="list" title="No songs in this playlist" subtitle="Open a song and choose Add to playlist." />}
        renderItem={({ item }) => <SongRow song={item} playlistId={playlist.id} active={activeSong?.id === item.id} />}
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold, flex: 1, textAlign: 'center' },
  content: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
  heroTitle: { color: Colors.text, fontSize: Font.size.xl, fontWeight: Font.weight.extrabold, marginTop: 18 },
  heroSub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 6 },
  heroBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: Colors.purple },
  heroBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.borderStrong },
  heroBtnText: { color: Colors.white, fontWeight: Font.weight.bold },
});
