import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import EmptyState from '@/components/EmptyState';
import LyricAlignBar from '@/components/LyricAlignBar';
import { useMusicStore } from '@/store/musicStore';
import { fetchLyrics, formatLrcTimestamp, isLyricsServiceReachable, parseLrc, SYNC_LINE_HOLD, type TimedLine } from '@/services/lyrics';
import { clampOffset, getLyricOffset, setLyricOffset } from '@/services/lyricOffset';
import { getProgress } from '@/services/audio';
import { Font, Radius, useTheme } from '@/constants/theme';
import type { LyricsSnapshot } from '@/types/music';

const ROW_H = 54;
const TOP_PAD = 180;
const BOT_PAD = 140;

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
        headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
        headerMid: { flex: 1, alignItems: 'center' },
        headerTitle: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.bold, maxWidth: '70%' },
        headerSub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
        seg: { flexDirection: 'row', alignSelf: 'center', gap: 8, marginTop: 6, padding: 4, borderRadius: Radius.pill, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
        segBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: Radius.pill },
        segActive: { backgroundColor: Colors.purple },
        segText: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
        segTextActive: { color: Colors.white },
        segDisabled: { opacity: 0.35 },
        alignRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 10, marginTop: 8 },
        alignToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.card },
        alignToggleText: { color: Colors.pink, fontSize: Font.size.xs, fontWeight: Font.weight.bold },
        alignBarWrap: { alignSelf: 'center', marginTop: 8 },
        center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
        centerTitle: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold, textAlign: 'center' },
        centerSub: { color: Colors.textSecondary, fontSize: Font.size.sm, textAlign: 'center', marginTop: 6 },
        centerBtns: { flexDirection: 'row', gap: 12, marginTop: 18 },
        ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderStrong },
        ghostText: { color: Colors.pink, fontSize: Font.size.sm, fontWeight: Font.weight.bold },
        fabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: Colors.pink },
        fabText: { color: Colors.white, fontSize: Font.size.sm, fontWeight: Font.weight.bold },
        body: { flex: 1 },
        lines: { paddingTop: TOP_PAD, paddingBottom: BOT_PAD, paddingHorizontal: 24 },
        line: { height: ROW_H, justifyContent: 'center' },
        lineActive: { backgroundColor: Colors.purple, borderRadius: Radius.md, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.pink },
        lineText: { color: Colors.textMuted, fontSize: Font.size.lg, fontWeight: Font.weight.medium, lineHeight: 26 },
        lineTextActive: { color: Colors.white, fontWeight: Font.weight.bold },
        syncBtn: { position: 'absolute', right: 16, bottom: 24, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.purple, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 9, elevation: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
        syncText: { color: Colors.white, fontSize: Font.size.xs, fontWeight: Font.weight.bold },
        plainBody: { padding: 24, paddingBottom: 60 },
        plainText: { color: Colors.text, fontSize: Font.size.md, lineHeight: 26 },
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        sheet: { backgroundColor: Colors.cardElevated, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, paddingTop: 20, paddingBottom: 40, paddingHorizontal: 20 },
        sheetTitle: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
        sheetSub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 8, lineHeight: 20 },
        input: { marginTop: 16, minHeight: 200, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderStrong, color: Colors.text, padding: 14, textAlignVertical: 'top', fontSize: Font.size.md, lineHeight: 22 },
        sheetBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 18 },
        tapHint: { color: Colors.textSecondary, fontSize: Font.size.xs, fontWeight: Font.weight.semibold, maxWidth: 220 },
      }),
    [Colors],
  );
};

export default function LyricsScreen() {
  const router = useRouter();
  const { Colors } = useTheme();
  const styles = useStyles();
  const song = useMusicStore((s) => s.activeSong);
  const cached = useMusicStore((s) => (s.activeSong ? s.lyrics[s.activeSong.id] : null));
  const position = useMusicStore((s) => s.position);
  const saveLyrics = useMusicStore((s) => s.saveLyrics);
  const seek = useMusicStore((s) => s.seek);

  const [doc, setDoc] = useState<LyricsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'synced' | 'plain'>('synced');
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [offset, setOffset] = useState(0);
  const [alignOpen, setAlignOpen] = useState(false);
  const scrollRef = useRef<FlatList<TimedLine>>(null);
  const lastScroll = useRef(-1);
  const [listH, setListH] = useState(0);

  const lines = useMemo<TimedLine[]>(() => (doc?.synced ? parseLrc(doc.synced) : []), [doc]);
  const plainLines = useMemo<string[]>(
    () => (doc?.plain ? doc.plain.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean) : []),
    [doc],
  );

  const load = (fresh: boolean) => {
    if (!song) return;
    lastScroll.current = -1;
    setFollow(true);
    // Use cache only if it already has real synced timestamps. Plain-only
    // cached entries are stale — the improved LRCLIB search may now find
    // a synced version, so re-fetch instead of locking in plain text forever.
    if (cached && !fresh && cached.synced) {
      setDoc(cached);
      setMode('synced');
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    setErrorDetail('');
    let alive = true;
    (async () => {
      try {
        const d = await fetchLyrics(song);
        if (!alive) return;
        if (d && (d.synced || d.plain)) {
          await saveLyrics(song.id, d);
          if (alive) {
            setDoc(d);
            setMode(d.synced ? 'synced' : 'plain');
          }
        } else {
          const reachable = await isLyricsServiceReachable();
          if (alive) {
            setDoc(null);
            setError(true);
            setErrorDetail(
              reachable
                ? 'No lyrics found online for this track. You can add your own below.'
                : 'Could not reach the lyrics service. Check your internet connection and try again.'
            );
          }
        }
      } catch {
        if (alive) {
          setDoc(null);
          setError(true);
          setErrorDetail('Something went wrong while fetching lyrics. Try again in a moment.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, cached]);

  useEffect(() => {
    if (!song) return;
    let alive = true;
    getLyricOffset(song.id).then((v) => {
      if (alive) setOffset(v);
    });
    return () => {
      alive = false;
    };
  }, [song?.id]);

  const applyOffset = (delta: number) => {
    if (!song) return;
    setOffset((prev) => {
      const next = clampOffset(prev + delta);
      setLyricOffset(song.id, next);
      return next;
    });
  };

  const resetOffset = () => {
    if (!song) return;
    setOffset(0);
    setLyricOffset(song.id, 0);
  };

  const [markMode, setMarkMode] = useState(false);
  const [marks, setMarks] = useState<Record<number, number>>({});

  const startMarking = () => { setMarks({}); setMarkMode(true); };

  const recordMark = async (lineIndex: number) => {
    const { position: t } = await getProgress();
    if (t > 0) setMarks((prev) => ({ ...prev, [lineIndex]: t }));
  };

  const saveMarks = async () => {
    if (!song || !doc?.plain) return;
    const count = Object.keys(marks).length;
    if (!count) { setMarkMode(false); return; }
    const lrc = plainLines
      .map((text, i) => (marks[i] != null ? `${formatLrcTimestamp(marks[i])}${text}` : null))
      .filter((x): x is string => x !== null)
      .join('\n');
    if (!lrc) { setMarkMode(false); return; }
    const d: LyricsSnapshot = { synced: lrc, plain: doc.plain, source: 'tapped' };
    await saveLyrics(song.id, d);
    setDoc(d);
    setMarks({});
    setMarkMode(false);
    setMode('synced');
  };

  const currentIndex = useMemo(() => {
    if (!lines.length) return -1;
    const adjusted = position + offset - SYNC_LINE_HOLD;
    for (let k = lines.length - 1; k >= 0; k--) {
      if (adjusted >= lines[k].time) return k;
    }
    return -1;
  }, [position, offset, lines]);

  useEffect(() => {
    if (!follow || !lines.length || currentIndex < 0 || !listH) return;
    const line = lines[currentIndex];
    const next = lines[currentIndex + 1];
    const span = next ? Math.max(0.05, next.time - line.time) : 5;
    const frac = Math.min(1, Math.max(0, ((position + offset) - line.time) / span));
    const target = Math.max(0, TOP_PAD + currentIndex * ROW_H + frac * ROW_H * 0.5 - listH * 0.4);
    if (Math.abs(target - lastScroll.current) < 0.5) return;
    lastScroll.current = target;
    scrollRef.current?.scrollToOffset({ offset: target, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, offset, follow, lines, currentIndex, listH]);

  const onLinePress = (line: TimedLine) => {
    setFollow(true);
    seek(Math.max(0, line.time - offset));
  };

  const submitManual = async () => {
    const text = manualText.trim();
    if (!text || !song) return;
    const d: LyricsSnapshot = { synced: null, plain: text, source: 'manual' };
    await saveLyrics(song.id, d);
    setDoc(d);
    setMode('plain');
    setManualOpen(false);
    setLoading(false);
    setError(false);
  };

  if (!song) {
    return (
      <Screen>
        <EmptyState icon="musical-notes" title="Nothing is playing" subtitle="Pick a song to see its lyrics." />
      </Screen>
    );
  }

  const canSynced = lines.length > 0;
  const hasDoc = !!doc && (!!doc.plain || !!doc.synced);

  return (
    <Screen edges={['top', 'bottom']} showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Back"><Icon name="arrow-back" size={22} color={Colors.text} /></Pressable>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>{song.title}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{song.artist}</Text>
        </View>
        <Pressable onPress={() => load(true)} style={[styles.headerBtn, loading && { opacity: 0.4 }]} accessibilityLabel="Refresh lyrics">
          {loading ? <ActivityIndicator size="small" color={Colors.pink} /> : <Icon name="refresh" size={20} color={Colors.text} />}
        </Pressable>
      </View>

      {hasDoc && doc?.synced ? (
        <View style={styles.seg}>
          <Pressable style={[styles.segBtn, mode === 'synced' && styles.segActive]} onPress={() => setMode('synced')} disabled={!canSynced} accessibilityLabel="Synced lyrics">
            <Text style={[styles.segText, mode === 'synced' && styles.segTextActive, !canSynced && styles.segDisabled]}>Synced</Text>
          </Pressable>
          <Pressable style={[styles.segBtn, mode === 'plain' && styles.segActive]} onPress={() => setMode('plain')} accessibilityLabel="Plain lyrics">
            <Text style={[styles.segText, mode === 'plain' && styles.segTextActive]}>Scrollable text</Text>
          </Pressable>
        </View>
      ) : null}

      {hasDoc && mode === 'synced' && canSynced ? (
        <View style={styles.alignRow}>
          <Pressable onPress={() => setAlignOpen((o) => !o)} style={styles.alignToggle} accessibilityLabel="Adjust lyrics alignment">
            <Icon name={alignOpen ? 'close' : 'options'} size={14} color={Colors.pink} />
            <Text style={styles.alignToggleText}>Align</Text>
          </Pressable>
          {alignOpen ? (
            <View style={styles.alignBarWrap}>
              <LyricAlignBar offset={offset} onChange={applyOffset} onReset={resetOffset} />
            </View>
          ) : null}
        </View>
      ) : null}

      {hasDoc && doc?.plain && !doc.synced ? (
        <View style={[styles.alignRow, { flexWrap: 'wrap', justifyContent: 'center' }]}>
          {markMode ? (
            <>
              <Text style={styles.tapHint}>Tap each line as it's sung · {Object.keys(marks).length} marked</Text>
              <Pressable onPress={saveMarks} style={styles.fabBtn} accessibilityLabel="Save tap timing">
                <Icon name="checkmark" size={14} color={Colors.white} />
                <Text style={styles.fabText}>Save</Text>
              </Pressable>
              <Pressable onPress={() => { setMarkMode(false); setMarks({}); }} style={styles.ghostBtn} accessibilityLabel="Cancel tap timing">
                <Text style={styles.ghostText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={startMarking} style={styles.ghostBtn} accessibilityLabel="Mark lines to sync lyrics">
              <Icon name="musical-notes" size={14} color={Colors.pink} />
              <Text style={styles.ghostText}>Make it synced</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.pink} />
          <Text style={styles.centerSub}>Searching the web for lyrics…</Text>
        </View>
      ) : !hasDoc ? (
        <View style={styles.center}>
          {error ? (
            <>
              <Icon name="cloud-offline-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.centerTitle}>No lyrics found</Text>
              <Text style={styles.centerSub}>{errorDetail || 'No lyrics found online for this track.'}</Text>
              <View style={styles.centerBtns}>
                <Pressable onPress={() => load(true)} style={styles.ghostBtn} accessibilityLabel="Try again">
                  <Icon name="refresh" size={16} color={Colors.pink} />
                  <Text style={styles.ghostText}>Try again</Text>
                </Pressable>
                <Pressable onPress={() => { setManualOpen(true); setManualText(''); }} style={styles.fabBtn} accessibilityLabel="Add lyrics">
                  <Icon name="add" size={16} color={Colors.white} />
                  <Text style={styles.fabText}>Add lyrics</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.centerSub}>Fetching lyrics for this track…</Text>
            </>
          )}
        </View>
      ) : mode === 'synced' && canSynced ? (
        <View style={styles.body} onLayout={(e) => setListH(e.nativeEvent.layout.height)}>
          <FlatList
            ref={scrollRef}
            data={lines}
            keyExtractor={(item, index) => `${index}`}
            extraData={`${currentIndex}|${offset}`}
            getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
            initialNumToRender={28}
            maxToRenderPerBatch={28}
            windowSize={11}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.lines}
            onScrollBeginDrag={() => setFollow(false)}
            renderItem={({ item, index }) => {
              const active = index === currentIndex;
              return (
                <Pressable onPress={() => onLinePress(item)} style={[styles.line, active && styles.lineActive]}>
                  <Text style={[styles.lineText, active && styles.lineTextActive]}>{item.text}</Text>
                </Pressable>
              );
            }}
          />
          {!follow ? (
            <Pressable onPress={() => { setFollow(true); lastScroll.current = -1; }} style={styles.syncBtn} accessibilityLabel="Keep lyrics in sync">
              <Icon name="sync" size={14} color={Colors.white} />
              <Text style={styles.syncText}>Back to live</Text>
            </Pressable>
          ) : null}
        </View>
      ) : markMode ? (
        <View style={styles.body}>
          <FlatList
            data={plainLines}
            keyExtractor={(_, index) => `${index}`}
            renderItem={({ item, index }) => {
              const marked = marks[index] != null;
              return (
                <Pressable onPress={() => recordMark(index)} style={[styles.line, marked && styles.lineActive]}>
                  <Text style={[styles.lineText, marked && styles.lineTextActive]}>{item}</Text>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.lines}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.plainBody}>
          <Text style={styles.plainText}>{doc?.plain}</Text>
        </ScrollView>
      )}

      <Modal transparent visible={manualOpen} animationType="slide" onRequestClose={() => setManualOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setManualOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Add lyrics</Text>
            <Text style={styles.sheetSub}>Paste the song lyrics below. They'll be saved on this device and shown as scrollable text.</Text>
            <TextInput
              style={styles.input}
              multiline
              autoFocus
              placeholder="Paste lyrics here…"
              placeholderTextColor={Colors.textMuted}
              value={manualText}
              onChangeText={setManualText}
            />
            <View style={styles.sheetBtns}>
              <Pressable onPress={() => setManualOpen(false)} style={styles.ghostBtn} accessibilityLabel="Cancel">
                <Text style={styles.ghostText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitManual} style={[styles.fabBtn, { paddingVertical: 12 }]} accessibilityLabel="Save lyrics">
                <Text style={styles.fabText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}