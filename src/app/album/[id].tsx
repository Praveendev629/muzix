import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import Artwork from '@/components/Artwork';
import SongRow from '@/components/SongRow';
import EmptyState from '@/components/EmptyState';
import { useMusicStore, albumsOf } from '@/store/musicStore';
import { Colors, Font } from '@/constants/theme';

export default function AlbumScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const songs = useMusicStore((s) => s.songs);
  const playSongs = useMusicStore((s) => s.playSongs);
  const activeSong = useMusicStore((s) => s.activeSong);

  const album = albumsOf(songs).find((a) => a.id === id);

  if (!album) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title="Album not found" />
      </Screen>
    );
  }

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="arrow-back" size={22} color={Colors.text} /></Pressable>
        <Text style={styles.title} numberOfLines={1}>{album.name}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={album.songs}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Artwork artwork={album.artwork} seed={album.id} size={190} radius={28} iconSize={70} />
            <Text style={styles.heroTitle}>{album.name}</Text>
            <Text style={styles.heroSub}>{album.artist} · {album.songCount} songs</Text>
            <Pressable onPress={() => playSongs(album.songs, 0)} style={styles.playBtn} accessibilityLabel="Play album"><Icon name="play" size={22} color={Colors.white} /></Pressable>
          </View>
        }
        renderItem={({ item }) => <SongRow song={item} active={activeSong?.id === item.id} />}
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
  heroTitle: { color: Colors.text, fontSize: Font.size.xl, fontWeight: Font.weight.extrabold, marginTop: 18, textAlign: 'center' },
  heroSub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 6 },
  playBtn: { marginTop: 18, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purple },
});
