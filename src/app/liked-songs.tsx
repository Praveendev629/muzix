import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import SongRow from '@/components/SongRow';
import NeonCard from '@/components/NeonCard';
import EmptyState from '@/components/EmptyState';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font } from '@/constants/theme';

export default function LikedSongsScreen() {
  const router = useRouter();
  const songs = useMusicStore((s) => s.songs);
  const playSongs = useMusicStore((s) => s.playSongs);
  const activeSong = useMusicStore((s) => s.activeSong);
  const liked = songs.filter((s) => s.isFavorite);

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="arrow-back" size={22} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Liked Songs</Text>
        <View style={styles.backBtn} />
      </View>

      {liked.length === 0 ? (
        <EmptyState icon="heart" title="No liked songs yet" subtitle="Tap the heart on any song to save it here." />
      ) : (
        <FlatList
          data={liked}
          keyExtractor={(s) => s.id}
          ListHeaderComponent={
            <NeonCard style={styles.headerCard} glow>
              <View style={styles.headerIcon}><Icon name="heart" size={30} color={Colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Liked Songs</Text>
                <Text style={styles.cardSub}>{liked.length} songs</Text>
              </View>
              <Pressable onPress={() => playSongs(liked, 0)} style={styles.playBtn} accessibilityLabel="Play liked songs"><Icon name="play" size={22} color={Colors.white} /></Pressable>
            </NeonCard>
          }
          renderItem={({ item }) => <SongRow song={item} active={activeSong?.id === item.id} />}
          contentContainerStyle={styles.content}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  content: { paddingBottom: 40 },
  headerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, marginTop: 6, marginBottom: 14, padding: 16 },
  headerIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.pink },
  cardTitle: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  cardSub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 3 },
  playBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purple },
});
