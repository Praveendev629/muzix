import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import NeonCard from '@/components/NeonCard';
import Artwork from '@/components/Artwork';
import SectionHeader from '@/components/SectionHeader';
import EmptyState from '@/components/EmptyState';
import { useMusicStore, albumsOf } from '@/store/musicStore';
import { hasAudioPermission, requestAudioPermission } from '@/services/library';
import { Colors, Font, Gradients, Radius } from '@/constants/theme';
import type { Song } from '@/types/music';

export default function HomeScreen() {
  const router = useRouter();
  const songs = useMusicStore((s) => s.songs);
  const recentIds = useMusicStore((s) => s.recentIds);
  const settings = useMusicStore((s) => s.settings);
  const playSongs = useMusicStore((s) => s.playSongs);
  const [granted, setGranted] = useState(true);

  useEffect(() => {
    hasAudioPermission().then(setGranted);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const notifCount = 2;

  const recentSongs = recentIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean) as Song[];
  const fallback = songs.slice(0, 10);
  const recentlyPlayed = recentSongs.length ? recentSongs : fallback;

  const albums = albumsOf(songs);
  const madeForYou = albums.slice(0, 6);

  const grantPermission = async () => {
    const ok = await requestAudioPermission();
    setGranted(ok);
  };

  const renderSongCard = ({ item }: { item: Song }) => (
    <Pressable style={styles.card} onPress={() => playSongs(songs, songs.findIndex((s) => s.id === item.id))}>
      <Artwork artwork={item.artwork} seed={`${item.album}${item.artist}`} size={132} />
      <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
      <Text numberOfLines={1} style={styles.cardArtist}>{item.artist}</Text>
    </Pressable>
  );

  return (
    <Screen showWatermark>
      {songs.length === 0 ? (
        <EmptyState
          icon={granted ? 'musical-notes' : 'lock-closed'}
          title={granted ? 'No music yet' : 'Allow muzix to access your music'}
          subtitle={granted ? 'Add your first song to start listening.' : 'Your music stays on your device. muzix only needs access to find and play your audio files.'}
          buttonTitle={granted ? 'Add Music' : 'Grant Permission'}
          onButton={() => (granted ? router.push('/import-songs') : grantPermission())}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}><Icon name="person" size={20} color={Colors.white} /></View>
              <View>
                <Text style={styles.greeting}>{greeting},</Text>
                <Text style={styles.name}>{settings.name}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn} accessibilityLabel="Settings">
                <Icon name="settings-outline" size={22} color={Colors.text} />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => router.push('/(tabs)/search')} style={styles.search} accessibilityLabel="Search">
            <Icon name="search" size={18} color={Colors.textSecondary} />
            <Text style={styles.searchText}>Search songs, artists, albums...</Text>
          </Pressable>

          {!granted ? (
            <NeonCard style={styles.permCard} glow>
              <Icon name="shield-checkmark" size={20} color={Colors.purpleBright} />
              <Text style={styles.permText}>Allow muzix to access your music to scan your library.</Text>
              <Pressable onPress={grantPermission} style={styles.permBtn}><Text style={styles.permBtnText}>Allow</Text></Pressable>
            </NeonCard>
          ) : null}

          <Pressable onPress={() => playSongs(songs, 0)} style={styles.featured} accessibilityLabel="Featured playlist">
            <LinearGradient colors={[Colors.purple, Colors.magenta, Colors.red]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.featuredText}>
              <Text style={styles.featuredTitle}>Music{'\n'}makes everything{'\n'}better</Text>
              <Text style={styles.featuredSub}>Feel every beat.</Text>
            </View>
            <View style={styles.featuredPlay}><Icon name="play" size={22} color={Colors.white} /></View>
          </Pressable>

          <SectionHeader title="Recently Played" icon="time" action="See all" onAction={() => router.push('/liked-songs')} />
          <FlatList horizontal data={recentlyPlayed} keyExtractor={(item) => item.id} renderItem={renderSongCard} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList} />

          <SectionHeader title="Made for You" icon="sparkles" />
          <View style={styles.grid}>
            {madeForYou.map((album, i) => (
              <Pressable key={album.id} style={styles.albumCard} onPress={() => playSongs(album.songs, 0)}>
                <Artwork artwork={album.artwork} seed={album.id} size={72} radius={16} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.albumName}>{album.name}</Text>
                  <Text numberOfLines={1} style={styles.cardArtist}>{album.artist}</Text>
                </View>
                <Icon name="play-circle" size={28} color={Colors.pink} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purple, borderWidth: 1, borderColor: Colors.borderStrong },
  greeting: { color: Colors.textSecondary, fontSize: Font.size.sm },
  name: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  badge: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.pink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, paddingHorizontal: 16, height: 48, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  searchText: { color: Colors.textSecondary, fontSize: Font.size.md },
  permCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 16, padding: 16 },
  permText: { flex: 1, color: Colors.textSecondary, fontSize: Font.size.sm },
  permBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.pink },
  permBtnText: { color: Colors.white, fontWeight: Font.weight.bold },
  featured: { marginHorizontal: 20, marginTop: 20, height: 180, borderRadius: Radius.xl, padding: 22, justifyContent: 'space-between', overflow: 'hidden' },
  featuredText: {},
  featuredTitle: { color: Colors.white, fontSize: Font.size.xl, fontWeight: Font.weight.extrabold, lineHeight: 30 },
  featuredSub: { color: 'rgba(255,255,255,0.85)', fontSize: Font.size.md, marginTop: 8, fontWeight: Font.weight.semibold },
  featuredPlay: { position: 'absolute', right: 20, bottom: 20, width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  hList: { paddingHorizontal: 20, gap: 14 },
  card: { width: 132 },
  cardTitle: { color: Colors.text, fontSize: Font.size.sm, fontWeight: Font.weight.semibold, marginTop: 8 },
  cardArtist: { color: Colors.textSecondary, fontSize: Font.size.xs, marginTop: 2 },
  grid: { paddingHorizontal: 20, gap: 12 },
  albumCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  albumName: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
});
