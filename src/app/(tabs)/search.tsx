import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import SongRow from '@/components/SongRow';
import Artwork from '@/components/Artwork';
import { useMusicStore } from '@/store/musicStore';
import { Font, Radius, useTheme } from '@/constants/theme';
import { searchYouTube, ytResultToSong } from '@/services/youtube';
import type { YTSearchResult } from '@/services/youtube';
import { TrackPlayer } from '@/services/audio';
import {
  enqueueMultiple,
  isCached,
  waitForConversion,
  getCachedAudio,
} from '@/services/convQueue';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10 },
        searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
        field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 46, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
        input: { flex: 1, color: Colors.text, fontSize: Font.size.md, paddingVertical: 0 },
        cancel: { color: Colors.pink, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
        iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
        content: { paddingBottom: 40 },
        noResults: { color: Colors.textSecondary, fontSize: Font.size.sm, paddingHorizontal: 20, paddingBottom: 12 },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingBottom: 20 },
        chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
        chipText: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.medium },
        row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
        artwork: { width: 52, height: 52, borderRadius: Radius.sm, backgroundColor: Colors.card },
        info: { flex: 1 },
        title: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.medium },
        artist: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
        duration: { color: Colors.textMuted, fontSize: Font.size.xs, marginTop: 2 },
        playBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purpleBright },
        cachedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50', position: 'absolute', top: 0, right: 0 },
        readyBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 6, backgroundColor: 'rgba(76,175,80,0.1)', marginHorizontal: 20, borderRadius: 8, marginBottom: 8 },
        readyText: { color: '#4caf50', fontSize: Font.size.xs, fontWeight: Font.weight.semibold },
      }),
    [Colors],
  );
};

export default function SearchScreen() {
  const { Colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const songs = useMusicStore((s) => s.songs);
  const searchHistory = useMusicStore((s) => s.searchHistory);
  const addSearch = useMusicStore((s) => s.addSearch);
  const clearSearch = useMusicStore((s) => s.clearSearch);
  const playSongs = useMusicStore((s) => s.playSongs);
  const [query, setQuery] = useState('');
  const [ytResults, setYtResults] = useState<YTSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cachedSet, setCachedSet] = useState<Set<string>>(new Set());
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversionSeq = useRef(0);

  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.album.toLowerCase().includes(q));
  }, [query, songs]);

  // Pre-fetch next 5 songs when results change
  useEffect(() => {
    if (ytResults.length === 0) return;
    const urls = ytResults.slice(0, 5).map((r) => r.url);
    enqueueMultiple(urls);

    const interval = setInterval(() => {
      const newSet = new Set<string>();
      ytResults.slice(0, 5).forEach((r) => {
        if (isCached(r.url)) newSet.add(r.url);
      });
      setCachedSet((prev) => {
        if (prev.size === newSet.size && [...newSet].every((u) => prev.has(u))) return prev;
        return newSet;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [ytResults]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setYtResults([]); setError(null); setCachedSet(new Set()); return; }
    setLoading(true); setError(null); setCachedSet(new Set());
    try {
      const results = await searchYouTube(q, 40);
      setYtResults(results);
      if (results.length === 0) setError('No results found');
    } catch { setError('Search failed'); }
    finally { setLoading(false); }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(text), 600);
  };

  const submit = () => { if (query.trim()) { addSearch(query.trim()); doSearch(query); } };

  const handlePlay = useCallback(async (result: YTSearchResult) => {
    const seq = ++conversionSeq.current;
    setConvertingId(result.videoId);
    try { await TrackPlayer.stop(); } catch {}

    try {
      // If already cached, play instantly
      const cached = getCachedAudio(result.url);
      if (cached?.audioUrl && seq === conversionSeq.current) {
        playSongs([ytResultToSong(result, cached.audioUrl)], 0);
      } else {
        // Wait for conversion
        const entry = await waitForConversion(result.url, 60000);
        if (entry?.audioUrl && seq === conversionSeq.current) {
          playSongs([ytResultToSong(result, entry.audioUrl)], 0);
        }
      }
    } catch (e) { console.warn('[search] Play failed:', e); }
    finally {
      if (seq === conversionSeq.current) setConvertingId(null);
    }
  }, [playSongs]);

  const hasQuery = query.trim().length > 0;
  const readyCount = cachedSet.size;

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.field}>
            <Icon name="search" size={18} color={Colors.textSecondary} />
            <TextInput value={query} onChangeText={handleQueryChange} placeholder="Search songs, artists..." placeholderTextColor={Colors.textMuted} style={styles.input} onSubmitEditing={submit} returnKeyType="search" autoCorrect={false} />
            {query.length > 0 ? <Pressable onPress={() => { setQuery(''); setYtResults([]); setError(null); setCachedSet(new Set()); }}><Icon name="close-circle" size={18} color={Colors.textSecondary} /></Pressable> : null}
          </View>
          {query.length > 0 ? <Text style={styles.cancel} onPress={() => { setQuery(''); setYtResults([]); setError(null); setCachedSet(new Set()); }}>Cancel</Text> : null}
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn} accessibilityLabel="Settings">
          <Icon name="settings-outline" size={22} color={Colors.text} />
        </Pressable>
      </View>

      {hasQuery ? (
        <ScrollView contentContainerStyle={styles.content}>
          {localResults && localResults.length > 0 && (
            <>
              <SectionHeader title={`Local (${localResults.length})`} icon="musical-notes" />
              {localResults.slice(0, 10).map((s) => <SongRow key={s.id} song={s} />)}
            </>
          )}

          <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: 20, marginVertical: 8 }} />

          {loading ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.purpleBright} size="small" />
              <Text style={[styles.noResults, { marginTop: 8 }]}>Searching YouTube...</Text>
            </View>
          ) : error ? (
            <Text style={styles.noResults}>{error}</Text>
          ) : null}

          {!loading && ytResults.length > 0 && (
            <>
              <SectionHeader title={`YouTube (${ytResults.length})`} icon="logo-youtube" />
              {ytResults.map((r) => {
                const isConverting = convertingId === r.videoId;
                const cached = cachedSet.has(r.url);
                return (
                  <View key={r.videoId} style={styles.row}>
                    <View>
                      <Artwork artwork={r.thumbnail} seed={r.videoId} size={52} style={styles.artwork} />
                      {cached && <View style={styles.cachedDot} />}
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.title} numberOfLines={1}>{r.title}</Text>
                      <Text style={styles.artist} numberOfLines={1}>{r.artist}</Text>
                      <Text style={styles.duration}>{r.duration}</Text>
                    </View>
                    {isConverting ? (
                      <View style={[styles.playBtn, { backgroundColor: Colors.card }]}>
                        <ActivityIndicator color={Colors.purpleBright} size="small" />
                      </View>
                    ) : (
                      <Pressable onPress={() => handlePlay(r)} style={styles.playBtn}>
                        <Icon name="play" size={18} color="#fff" />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader title="Recent Searches" icon="time" action="Clear" onAction={() => clearSearch()} />
          {searchHistory.length === 0 ? <Text style={styles.noResults}>No recent searches</Text> : (
            <View style={styles.chips}>
              {searchHistory.map((h) => (
                <Pressable key={h} style={styles.chip} onPress={() => { setQuery(h); doSearch(h); }}>
                  <Icon name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.chipText}>{h}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
