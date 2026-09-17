import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Icon, { type IconName } from '@/components/Icon';
import Screen from '@/components/Screen';
import Artwork from '@/components/Artwork';
import LikeButton from '@/components/LikeButton';
import TrackSlider from '@/components/TrackSlider';
import LyricAlignBar from '@/components/LyricAlignBar';
import { useMusicStore } from '@/store/musicStore';
import { RepeatMode } from '@/services/audio';
import { fetchLyrics, parseLrc, SYNC_LINE_HOLD, type TimedLine } from '@/services/lyrics';
import { clampOffset, getLyricOffset, setLyricOffset } from '@/services/lyricOffset';
import { Font, Radius, Shadow, useTheme } from '@/constants/theme';
import type { LyricsSnapshot, Song } from '@/types/music';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
        headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
        headerTitle: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.semibold, letterSpacing: 1 },
        content: { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 30 },
        artWrap: { width: LYRIC_BOX, height: LYRIC_BOX, marginTop: 8, marginBottom: 16 },
        face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, overflow: 'hidden', backfaceVisibility: 'hidden' },
        facePress: { flex: 1 },
        glow: { borderRadius: 40 },
        lyricFace: { flex: 1, backgroundColor: Colors.cardElevated, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 28, padding: 10 },
        lyricHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 2, paddingBottom: 6 },
        lyricHeadInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        lyricHeadText: { color: Colors.text, fontSize: Font.size.sm, fontWeight: Font.weight.bold, letterSpacing: 1 },
        lyricCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8 },
        lyricHint: { color: Colors.pink, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
        lyricScroll: { flex: 1 },
        lyricScrollContent: { flexGrow: 1, paddingVertical: 4, paddingHorizontal: 6 },
        lyricBoxLine: { height: LYRIC_ROW, color: Colors.textMuted, fontSize: Font.size.md, fontWeight: Font.weight.medium, lineHeight: 20, textAlignVertical: 'center' },
        lyricBoxLineActive: { color: Colors.purpleBright, fontWeight: Font.weight.bold },
        lyricPlain: { color: Colors.text, fontSize: Font.size.sm, lineHeight: 20 },
        lyricModes: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: 6, paddingBottom: 2 },
        lyricModeBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: Colors.borderStrong },
        lyricModeOn: { backgroundColor: Colors.purple, borderColor: Colors.purple },
        lyricModeText: { color: Colors.textSecondary, fontSize: Font.size.xs, fontWeight: Font.weight.semibold },
        lyricModeTextOn: { color: Colors.white },
        lyricAlignRow: { alignItems: 'center', justifyContent: 'center', paddingTop: 4, paddingBottom: 2 },
        title: { color: Colors.text, fontSize: Font.size.xl, fontWeight: Font.weight.bold, textAlign: 'center' },
        artist: { color: Colors.pink, fontSize: Font.size.md, marginTop: 6, fontWeight: Font.weight.medium },
        album: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 4 },
        controls: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 6, marginBottom: 12 },
        sideBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        repeatWrap: { alignItems: 'center', justifyContent: 'center' },
        toast: { position: 'absolute', top: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: Colors.cardElevated, borderWidth: 1, borderColor: Colors.borderStrong, elevation: 12, shadowColor: Colors.pink, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, zIndex: 20 },
        toastText: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
        skipBtn: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
        playBtn: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...Shadow.strong },
        actions: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 16 },
        actionItem: { alignItems: 'center', gap: 6, padding: 8 },
        actionLabel: { color: Colors.textSecondary, fontSize: Font.size.xs, fontWeight: Font.weight.medium },
        none: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
        noneText: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
        noneSub: { color: Colors.textSecondary, fontSize: Font.size.md },
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        sheet: { backgroundColor: Colors.cardElevated, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, paddingTop: 20, paddingBottom: 40 },
        sheetTitle: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold, paddingHorizontal: 20, paddingBottom: 12 },
        sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 15 },
        sheetLabel: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.medium },
        sheetClose: { marginTop: 24, alignItems: 'center' },
        sheetCloseText: { color: Colors.pink, fontSize: Font.size.md, fontWeight: Font.weight.bold },
      }),
    [Colors],
  );
};

export default function PlayerScreen() {
  const router = useRouter();
  const { Colors, Gradients } = useTheme();
  const styles = useStyles();
  const activeSong = useMusicStore((s) => s.activeSong);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const position = useMusicStore((s) => s.position);
  const duration = useMusicStore((s) => s.duration);
  const shuffle = useMusicStore((s) => s.shuffle);
  const repeat = useMusicStore((s) => s.repeat);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const next = useMusicStore((s) => s.next);
  const previous = useMusicStore((s) => s.previous);
  const seek = useMusicStore((s) => s.seek);
  const setShuffle = useMusicStore((s) => s.setShuffle);
  const setRepeat = useMusicStore((s) => s.setRepeat);
  const toggleFavorite = useMusicStore((s) => s.toggleFavorite);
  const addToQueue = useMusicStore((s) => s.addToQueue);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<any>(null);

  const [flipOpen, setFlipOpen] = useState(false);
  const [lyricsEver, setLyricsEver] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const flipTo = (open: boolean) => {
    setFlipOpen(open);
    if (open) setLyricsEver(true);
    Animated.spring(flipAnim, { toValue: open ? 1 : 0, friction: 9, tension: 110, useNativeDriver: true }).start();
  };
  const frontSpin = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backSpin = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const showToast = (msg: string) => {
    setToast(msg);
    Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setToast(null));
    }, 2000);
  };

  const toggleRepeat = () => {
    const next = repeat === RepeatMode.Track ? RepeatMode.Off : RepeatMode.Track;
    setRepeat(next);
    showToast(next === RepeatMode.Track ? 'Repeat mode is on' : 'Repeat mode is off');
  };

  const toggleShuffle = () => {
    const next = !shuffle;
    setShuffle(next);
    showToast(next ? 'Shuffle is on' : 'Shuffle is off');
  };

  useEffect(() => {
    router.prefetch('/queue');
    router.prefetch('/add-to-playlist');
    router.prefetch('/lyrics');
  }, [router]);

  if (!activeSong) {
    return (
      <Screen>
        <View style={styles.none}>
          <Icon name="musical-notes" size={48} color={Colors.textMuted} />
          <Text style={styles.noneText}>Nothing is playing</Text>
          <Text style={styles.noneSub}>Pick a song from your library to start.</Text>
        </View>
      </Screen>
    );
  }

  const song = activeSong as Song;
  const repeatIcon: IconName = repeat === RepeatMode.Off ? 'repeat-outline' : 'repeat';

  const moreItems: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'heart', label: song.isFavorite ? 'Remove from Favorites' : 'Add to Favorites', onPress: () => toggleFavorite(song.id) },
    { icon: 'list', label: 'Add to queue', onPress: () => addToQueue(song) },
    { icon: 'albums', label: 'Add to playlist', onPress: () => router.push({ pathname: '/add-to-playlist', params: { songId: song.id } }) },
    { icon: 'disc', label: 'View album', onPress: () => router.push(`/album/${encodeURIComponent(`${song.album}|||${song.albumArtist ?? song.artist}`)}`) },
    { icon: 'person', label: 'View artist', onPress: () => router.push(`/artist/${encodeURIComponent(song.artist)}`) },
  ];

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityLabel="Back"><Icon name="chevron-down" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.headerTitle}>Now Playing</Text>
        <Pressable onPress={() => setMoreOpen(true)} style={styles.headerBtn} accessibilityLabel="More options"><Icon name="ellipsis-horizontal" size={22} color={Colors.text} /></Pressable>
      </View>

      {toast ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }]}>
          <Icon name="repeat" size={16} color={Colors.pink} />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.artWrap}>
          <Animated.View
            pointerEvents={flipOpen ? 'none' : 'auto'}
            style={[styles.face, { transform: [{ perspective: 1200 }, { rotateY: frontSpin }] }]}
          >
            <Pressable style={styles.facePress} onPress={() => flipTo(true)} accessibilityLabel="Show lyrics">
              <LinearGradient colors={Gradients.artwork} style={[StyleSheet.absoluteFill, styles.glow, { opacity: 0.35 }]} />
              <Artwork artwork={song.artwork} seed={`${song.album}${song.artist}`} size={LYRIC_BOX} radius={28} iconSize={110} />
            </Pressable>
          </Animated.View>
          <Animated.View
            pointerEvents={flipOpen ? 'auto' : 'none'}
            style={[styles.face, { transform: [{ perspective: 1200 }, { rotateY: backSpin }] }]}
          >
            {lyricsEver ? <LyricBox song={song} onFlipBack={() => flipTo(false)} /> : null}
          </Animated.View>
        </View>

        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.artist}>{song.artist}</Text>
        {song.album && song.album !== 'Unknown Album' ? <Text style={styles.album}>{song.album}</Text> : null}

        <TrackSlider position={position} duration={duration} onSeek={seek} />

        <View style={styles.controls}>
          <Pressable onPress={toggleShuffle} style={styles.sideBtn} accessibilityLabel="Shuffle">
            <Icon name="shuffle" size={22} color={shuffle ? Colors.pink : Colors.textSecondary} />
          </Pressable>
          <Pressable onPress={previous} style={styles.skipBtn} accessibilityLabel="Previous"><Icon name="play-skip-back" size={34} color={Colors.text} /></Pressable>
          <Pressable onPress={togglePlay} style={styles.playBtn} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
            <LinearGradient colors={Gradients.primary} style={StyleSheet.absoluteFill} />
            <Icon name={isPlaying ? 'pause' : 'play'} size={42} color={Colors.white} />
          </Pressable>
          <Pressable onPress={next} style={styles.skipBtn} accessibilityLabel="Next"><Icon name="play-skip-forward" size={34} color={Colors.text} /></Pressable>
          <Pressable onPress={toggleRepeat} style={styles.sideBtn} accessibilityLabel="Repeat">
            <View style={styles.repeatWrap}>
              <Icon name={repeatIcon} size={22} color={repeat !== RepeatMode.Off ? Colors.pink : Colors.textSecondary} />
            </View>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <ActionItem icon="musical-notes" label="Lyrics" onPress={() => router.push('/lyrics')} />
          <LikeButton favorite={song.isFavorite} onToggle={() => toggleFavorite(song.id)} />
          <ActionItem icon="albums" label="Playlist" onPress={() => router.push({ pathname: '/add-to-playlist', params: { songId: song.id } })} />
          <ActionItem icon="list" label="Queue" onPress={() => router.push('/queue')} />
        </View>
      </ScrollView>

      <Modal transparent visible={moreOpen} animationType="slide" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{song.title}</Text>
            {moreItems.map((m, i) => (
              <Pressable key={i} style={styles.sheetItem} onPress={() => { m.onPress(); setMoreOpen(false); }}>
                <Icon name={m.icon} size={20} color={Colors.textSecondary} />
                <Text style={styles.sheetLabel}>{m.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function ActionItem({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { Colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable style={styles.actionItem} onPress={onPress} accessibilityLabel={label}>
      <Icon name={icon} size={22} color={Colors.text} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const LYRIC_BOX = 330;
const LYRIC_ROW = 46;

function LyricBox({ song, onFlipBack }: { song: Song; onFlipBack: () => void }) {
  const { Colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const cached = useMusicStore((s) => s.lyrics[song.id]);
  const position = useMusicStore((s) => s.position);
  const saveLyrics = useMusicStore((s) => s.saveLyrics);
  const [doc, setDoc] = useState<LyricsSnapshot | null>(cached);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'synced' | 'plain'>('synced');
  const [offset, setOffset] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const lastIdx = useRef(-1);

  useEffect(() => {
    let alive = true;
    getLyricOffset(song.id).then((v) => {
      if (alive) setOffset(v);
    });
    return () => {
      alive = false;
    };
  }, [song.id]);

  const applyOffset = (delta: number) => {
    setOffset((prev) => {
      const next = clampOffset(prev + delta);
      setLyricOffset(song.id, next);
      return next;
    });
  };

  const resetOffset = () => {
    setOffset(0);
    setLyricOffset(song.id, 0);
  };

  useEffect(() => {
    setDoc(cached);
  }, [cached]);

  useEffect(() => {
    if (cached && cached.synced) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const d = await fetchLyrics(song);
        if (d && (d.synced || d.plain)) await saveLyrics(song.id, d);
        if (alive) setDoc(d && (d.synced || d.plain) ? d : null);
      } catch {
        if (alive) setDoc(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);

  const lines = useMemo<TimedLine[]>(() => (doc?.synced ? parseLrc(doc.synced) : []), [doc]);

  const idx = useMemo(() => {
    const adjusted = position + offset - SYNC_LINE_HOLD;
    for (let i = lines.length - 1; i >= 0; i--) if (adjusted >= lines[i].time) return i;
    return -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, offset, lines]);

  useEffect(() => {
    if (idx < 0 || idx === lastIdx.current) return;
    lastIdx.current = idx;
    scrollRef.current?.scrollTo({ y: Math.max(0, idx * LYRIC_ROW - 70), animated: true });
  }, [idx]);

  const hasText = !!doc && (!!doc.synced || !!doc.plain);

  return (
    <Pressable style={styles.lyricFace} onPress={onFlipBack}>
      <View style={styles.lyricHead}>
        <View style={styles.lyricHeadInner}>
          <Icon name="musical-notes" size={14} color={Colors.pink} />
          <Text style={styles.lyricHeadText}>LYRICS</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.lyricCenter}>
          <ActivityIndicator size="small" color={Colors.pink} />
        </View>
      ) : !hasText ? (
        <Pressable style={styles.lyricCenter} onPress={() => router.push('/lyrics')}>
          <Icon name="musical-notes" size={26} color={Colors.textMuted} />
          <Text style={styles.lyricHint}>Open full lyrics</Text>
        </Pressable>
      ) : mode === 'synced' && lines.length ? (
        <ScrollView ref={scrollRef} style={styles.lyricScroll} contentContainerStyle={styles.lyricScrollContent} showsVerticalScrollIndicator={false}>
          {lines.map((l, i) => (
            <Text key={i} style={[styles.lyricBoxLine, i === idx && styles.lyricBoxLineActive]}>{l.text}</Text>
          ))}
          <Pressable style={StyleSheet.absoluteFill} onPress={onFlipBack} accessibilityLabel="Hide lyrics" />
        </ScrollView>
      ) : (
        <ScrollView style={styles.lyricScroll} contentContainerStyle={styles.lyricScrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.lyricPlain}>{doc?.plain}</Text>
          <Pressable style={StyleSheet.absoluteFill} onPress={onFlipBack} accessibilityLabel="Hide lyrics" />
        </ScrollView>
      )}

      {hasText ? (
        <View style={styles.lyricModes}>
          <Pressable disabled={!lines.length} onPress={() => setMode('synced')} style={[styles.lyricModeBtn, mode === 'synced' && styles.lyricModeOn]}>
            <Text style={[styles.lyricModeText, mode === 'synced' && styles.lyricModeTextOn]}>Synced</Text>
          </Pressable>
          <Pressable onPress={() => setMode('plain')} style={[styles.lyricModeBtn, mode === 'plain' && styles.lyricModeOn]}>
            <Text style={[styles.lyricModeText, mode === 'plain' && styles.lyricModeTextOn]}>Scrollable text</Text>
          </Pressable>
        </View>
      ) : null}

      {hasText && mode === 'synced' && lines.length ? (
        <View style={styles.lyricAlignRow}>
          <LyricAlignBar offset={offset} onChange={applyOffset} onReset={resetOffset} />
        </View>
      ) : null}
    </Pressable>
  );
}