import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Icon, { type IconName } from '@/components/Icon';
import Screen from '@/components/Screen';
import Artwork from '@/components/Artwork';
import TrackSlider from '@/components/TrackSlider';
import { useMusicStore } from '@/store/musicStore';
import { RepeatMode } from '@/services/audio';
import { Colors, Font, Gradients, Radius, Shadow } from '@/constants/theme';
import type { Song } from '@/types/music';

export default function PlayerScreen() {
  const router = useRouter();
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
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.artWrap}>
          <LinearGradient colors={Gradients.artwork} style={[StyleSheet.absoluteFill, styles.glow, { opacity: 0.35 }]} />
          <Artwork artwork={song.artwork} seed={`${song.album}${song.artist}`} size={Math.min(360, 330)} radius={28} iconSize={110} />
        </View>

        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.artist}>{song.artist}</Text>
        {song.album && song.album !== 'Unknown Album' ? <Text style={styles.album}>{song.album}</Text> : null}

        <TrackSlider position={position} duration={duration} onSeek={seek} />

        <View style={styles.controls}>
          <Pressable onPress={() => setShuffle(!shuffle)} style={styles.sideBtn} accessibilityLabel="Shuffle">
            <Icon name="shuffle" size={22} color={shuffle ? Colors.pink : Colors.textSecondary} />
          </Pressable>
          <Pressable onPress={previous} style={styles.skipBtn} accessibilityLabel="Previous"><Icon name="play-skip-back" size={34} color={Colors.text} /></Pressable>
          <Pressable onPress={togglePlay} style={styles.playBtn} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
            <LinearGradient colors={Gradients.primary} style={StyleSheet.absoluteFill} />
            <Icon name={isPlaying ? 'pause' : 'play'} size={42} color={Colors.white} />
          </Pressable>
          <Pressable onPress={next} style={styles.skipBtn} accessibilityLabel="Next"><Icon name="play-skip-forward" size={34} color={Colors.text} /></Pressable>
          <Pressable onPress={() => setRepeat(repeat === RepeatMode.Off ? RepeatMode.Queue : repeat === RepeatMode.Queue ? RepeatMode.Track : RepeatMode.Off)} style={styles.sideBtn} accessibilityLabel="Repeat">
            <View style={styles.repeatWrap}>
              <Icon name={repeatIcon} size={22} color={repeat !== RepeatMode.Off ? Colors.pink : Colors.textSecondary} />
              {repeat === RepeatMode.Track ? <Text style={styles.repeatOne}>1</Text> : null}
            </View>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <ActionItem icon="musical-notes" label="Lyrics" onPress={() => setLyricsOpen(true)} />
          <ActionItem icon={song.isFavorite ? 'heart' : 'heart-outline'} label="Like" onPress={() => toggleFavorite(song.id)} />
          <ActionItem icon="albums" label="Playlist" onPress={() => router.push({ pathname: '/add-to-playlist', params: { songId: song.id } })} />
          <ActionItem icon="queue-music" label="Queue" onPress={() => router.push('/queue')} />
        </View>
      </ScrollView>

      <Modal transparent visible={lyricsOpen} animationType="slide" onRequestClose={() => setLyricsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLyricsOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Lyrics</Text>
            <Text style={styles.lyricsBody}>
              {song.title}{'\n'}by {song.artist}
              {'\n\n'}This is a fully offline player, so synced lyrics are only shown when they are embedded in the file metadata. No lyrics were found for this track.
            </Text>
            <Pressable onPress={() => setLyricsOpen(false)} style={styles.sheetClose}><Text style={styles.sheetCloseText}>Close</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  return (
    <Pressable style={styles.actionItem} onPress={onPress} accessibilityLabel={label}>
      <Icon name={icon} size={22} color={Colors.text} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.semibold, letterSpacing: 1 },
  content: { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 30 },
  artWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 28 },
  glow: { borderRadius: 40 },
  title: { color: Colors.text, fontSize: Font.size.xl, fontWeight: Font.weight.bold, textAlign: 'center' },
  artist: { color: Colors.pink, fontSize: Font.size.md, marginTop: 6, fontWeight: Font.weight.medium },
  album: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 6, marginBottom: 12 },
  sideBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  repeatWrap: { alignItems: 'center', justifyContent: 'center' },
  repeatOne: { position: 'absolute', top: -6, right: -8, color: Colors.pink, fontSize: Font.size.xs, fontWeight: Font.weight.bold },
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
  lyricsBody: { color: Colors.textSecondary, fontSize: Font.size.md, lineHeight: 24, paddingHorizontal: 20 },
  sheetClose: { marginTop: 24, alignItems: 'center' },
  sheetCloseText: { color: Colors.pink, fontSize: Font.size.md, fontWeight: Font.weight.bold },
});
