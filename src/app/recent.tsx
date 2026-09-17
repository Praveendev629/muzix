import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import SongRow from '@/components/SongRow';
import NeonCard from '@/components/NeonCard';
import EmptyState from '@/components/EmptyState';
import MiniPlayer from '@/components/MiniPlayer';
import { useMusicStore } from '@/store/musicStore';
import { Font, useTheme } from '@/constants/theme';
import type { Song } from '@/types/music';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
        backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
        title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
        content: { paddingBottom: 40 },
        list: { flex: 1 },
        headerCard: { marginHorizontal: 20, marginTop: 6, marginBottom: 14, padding: 16 },
        headerCardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
        headerIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purple },
        cardTitle: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
        cardSub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 3 },
        playBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.pink },
      }),
    [Colors],
  );
};

export default function RecentScreen() {
  const { Colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const songs = useMusicStore((s) => s.songs);
  const recentIds = useMusicStore((s) => s.recentIds);
  const playSongs = useMusicStore((s) => s.playSongs);
  const activeSong = useMusicStore((s) => s.activeSong);
  const recentSongs = recentIds
    .map((id) => songs.find((s) => s.id === id))
    .filter((s): s is Song => !!s);

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="arrow-back" size={22} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Recently Played</Text>
        <View style={styles.backBtn} />
      </View>

      {recentSongs.length === 0 ? (
        <EmptyState icon="time" title="Nothing played yet" subtitle="Songs you play will show up here." />
      ) : (
        <FlatList
          data={recentSongs}
          keyExtractor={(s) => s.id}
          ListHeaderComponent={
            <NeonCard style={styles.headerCard} contentStyle={styles.headerCardRow} glow>
              <View style={styles.headerIcon}><Icon name="time" size={30} color={Colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Recently Played</Text>
                <Text style={styles.cardSub}>{recentSongs.length} songs</Text>
              </View>
              <Pressable onPress={() => playSongs(recentSongs, 0)} style={styles.playBtn} accessibilityLabel="Play recent songs"><Icon name="play" size={22} color={Colors.white} /></Pressable>
            </NeonCard>
          }
          renderItem={({ item }) => <SongRow song={item} onPress={(song) => { const idx = recentSongs.findIndex((s) => s.id === song.id); playSongs(recentSongs, idx); }} active={activeSong?.id === item.id} />}
          style={styles.list}
          contentContainerStyle={styles.content}
        />
      )}
      <MiniPlayer />
    </Screen>
  );
}