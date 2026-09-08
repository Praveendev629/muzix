import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import Artwork from '@/components/Artwork';
import EmptyState from '@/components/EmptyState';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font } from '@/constants/theme';

export default function AddToPlaylistScreen() {
  const router = useRouter();
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const playlists = useMusicStore((s) => s.playlists);
  const songs = useMusicStore((s) => s.songs);
  const addToPlaylist = useMusicStore((s) => s.addToPlaylist);
  const createPlaylist = useMusicStore((s) => s.createPlaylist);
  const song = songs.find((s) => s.id === songId);

  const add = async (playlistId: string) => {
    await addToPlaylist(playlistId, songId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const quickCreate = async () => {
    await createPlaylist('New Playlist', undefined, [songId]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Close"><Icon name="chevron-down" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Add to Playlist</Text>
        <View style={styles.backBtn} />
      </View>

      {song ? (
        <View style={styles.songRow}>
          <Artwork artwork={song.artwork} seed={song.album} size={44} radius={10} />
          <View style={{ flex: 1 }}>
            <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.songArtist} numberOfLines={1}>{song.artist}</Text>
          </View>
        </View>
      ) : null}

      <FlatList
        data={playlists}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <Pressable style={styles.row} onPress={quickCreate}>
            <View style={styles.newIcon}><Icon name="add" size={22} color={Colors.pink} /></View>
            <Text style={styles.rowLabel}>New Playlist</Text>
          </Pressable>
        }
        ListEmptyComponent={<EmptyState icon="albums" title="No playlists" subtitle="Create a playlist to add this song to it." />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => add(item.id)}>
            <Artwork artwork={item.artwork} seed={item.name} size={44} radius={10} iconSize={18} />
            <Text style={styles.rowLabel}>{item.name}</Text>
            <Icon name="add-circle-outline" size={22} color={Colors.purpleBright} />
          </Pressable>
        )}
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  songTitle: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
  songArtist: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
  content: { paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  newIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,20,147,0.12)', borderWidth: 1, borderColor: Colors.borderStrong },
  rowLabel: { flex: 1, color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.medium },
});
