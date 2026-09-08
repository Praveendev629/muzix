import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import SongRow from '@/components/SongRow';
import Artwork from '@/components/Artwork';
import EmptyState from '@/components/EmptyState';
import { useMusicStore, albumsOf, artistsOf } from '@/store/musicStore';
import { Colors, Font, Radius } from '@/constants/theme';

export default function SearchScreen() {
  const router = useRouter();
  const songs = useMusicStore((s) => s.songs);
  const searchHistory = useMusicStore((s) => s.searchHistory);
  const mostPlayedIds = useMusicStore((s) => s.mostPlayedIds);
  const addSearch = useMusicStore((s) => s.addSearch);
  const clearSearch = useMusicStore((s) => s.clearSearch);
  const [query, setQuery] = useState('');

  const trending = mostPlayedIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean) as any[];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const songHits = songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.album.toLowerCase().includes(q));
    const albumHits = albumsOf(songs).filter((a) => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q));
    const artistHits = artistsOf(songs).filter((a) => a.name.toLowerCase().includes(q));
    const genreHits = songs.filter((s) => (s.genre || '').toLowerCase().includes(q));
    return { songHits, albumHits, artistHits, genreHits };
  }, [query, songs]);

  const submit = () => {
    if (query.trim()) addSearch(query.trim());
  };

  return (
    <Screen showWatermark>
      <View style={styles.searchRow}>
        <View style={styles.field}>
          <Icon name="search" size={18} color={Colors.textSecondary} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search songs, artists, albums..." placeholderTextColor={Colors.textMuted} style={styles.input} onSubmitEditing={submit} returnKeyType="search" autoCorrect={false} />
          {query.length > 0 ? <Icon name="close-circle" size={18} color={Colors.textSecondary} onPress={() => setQuery('')} /> : null}
        </View>
        {query.length > 0 ? <Text style={styles.cancel} onPress={() => setQuery('')}>Cancel</Text> : null}
      </View>

      {query.trim() ? (
        <ScrollView contentContainerStyle={styles.content}>
          {results && (
            <>
              <SectionHeader title={`Songs (${results.songHits.length})`} icon="musical-notes" />
              {results.songHits.length === 0 ? <Text style={styles.noResults}>No songs found</Text> : results.songHits.map((s) => <SongRow key={s.id} song={s} />)}
              <SectionHeader title={`Artists (${results.artistHits.length})`} icon="people" />
              {results.artistHits.map((a) => (
                <Pressable key={a.id} style={styles.resultRow} onPress={() => router.push(`/artist/${encodeURIComponent(a.id)}`)}>
                  <View style={styles.smallIcon}><Icon name="person" size={18} color={Colors.purpleBright} /></View>
                  <Text style={styles.resultText}>{a.name}</Text>
                </Pressable>
              ))}
              <SectionHeader title={`Albums (${results.albumHits.length})`} icon="albums" />
              {results.albumHits.map((a) => (
                <Pressable key={a.id} style={styles.resultRow} onPress={() => router.push(`/album/${encodeURIComponent(a.id)}`)}>
                  <Artwork artwork={a.artwork} seed={a.id} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultText}>{a.name}</Text>
                    <Text style={styles.sub}>{a.artist}</Text>
                  </View>
                </Pressable>
              ))}
              <SectionHeader title={`Genres (${results.genreHits.length})`} icon="pricetags" />
              {results.genreHits.length > 0 ? (
                <View style={styles.chips}>
                  {[...new Set(results.genreHits.map((s) => s.genre))].filter(Boolean).map((g) => (
                    <Pressable key={g} style={styles.chip} onPress={() => setQuery(g!)}><Text style={styles.chipText}>{g}</Text></Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.noResults}>No genres found</Text>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader title="Recent Searches" icon="time" action="Clear" onAction={() => clearSearch()} />
          {searchHistory.length === 0 ? <Text style={styles.noResults}>No recent searches</Text> : (
            <View style={styles.chips}>
              {searchHistory.map((h) => (
                <Pressable key={h} style={styles.chip} onPress={() => setQuery(h)}>
                  <Icon name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.chipText}>{h}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <SectionHeader title="Trending" icon="trending-up" />
          {trending.length === 0 ? (
            <EmptyState icon="trending-up" title="No trending tracks yet" subtitle="Play some music to build your trending list." />
          ) : (
            trending.slice(0, 10).map((s, i) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={{ flex: 1 }}><SongRow song={s} /></View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 46, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  input: { flex: 1, color: Colors.text, fontSize: Font.size.md, paddingVertical: 0 },
  cancel: { color: Colors.pink, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
  content: { paddingBottom: 40 },
  noResults: { color: Colors.textSecondary, fontSize: Font.size.sm, paddingHorizontal: 20, paddingBottom: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  smallIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(123,44,255,0.14)' },
  resultText: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.medium },
  sub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingBottom: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipText: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.medium },
  rank: { width: 32, textAlign: 'center', color: Colors.textMuted, fontSize: Font.size.md, fontWeight: Font.weight.bold },
});
