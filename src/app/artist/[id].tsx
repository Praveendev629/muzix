import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import SongRow from '@/components/SongRow';
import EmptyState from '@/components/EmptyState';
import { useMusicStore, albumsOf } from '@/store/musicStore';
import { Colors, Font } from '@/constants/theme';

export default function ArtistScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const songs = useMusicStore((s) => s.songs);
  const playSongs = useMusicStore((s) => s.playSongs);
  const activeSong = useMusicStore((s) => s.activeSong);

  const artistSongs = songs.filter((s) => s.artist === id);
  const artistAlbums = albumsOf(artistSongs);
  const allAlbums = albumsOf(songs);
  const collabs = allAlbums.filter((a) => a.artist !== id && a.songs.some((s) => s.artist === id));

  if (artistSongs.length === 0) {
    return (
      <Screen>
        <EmptyState icon="person" title="Artist not found" />
      </Screen>
    );
  }

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="arrow-back" size={22} color={Colors.text} /></Pressable>
        <Text style={styles.title} numberOfLines={1}>{id}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={artistSongs}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={styles.hero}>
            <View style={styles.avatar}><Icon name="person" size={70} color={Colors.purpleBright} /></View>
            <Text style={styles.heroTitle}>{id}</Text>
            <Text style={styles.heroSub}>{artistSongs.length} songs · {artistAlbums.length + collabs.length} albums</Text>
            <Pressable onPress={() => playSongs(artistSongs, 0)} style={styles.playBtn} accessibilityLabel="Play artist"><Icon name="play" size={22} color={Colors.white} /></Pressable>
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
  avatar: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(123,44,255,0.16)', borderWidth: 1, borderColor: Colors.borderStrong },
  heroTitle: { color: Colors.text, fontSize: Font.size.xl, fontWeight: Font.weight.extrabold, marginTop: 16, textAlign: 'center' },
  heroSub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 6 },
  playBtn: { marginTop: 18, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purple },
});
