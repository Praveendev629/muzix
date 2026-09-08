import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Artwork from '@/components/Artwork';
import EqualizerBars from '@/components/EqualizerBars';
import Icon, { type IconName } from '@/components/Icon';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font, Radius } from '@/constants/theme';
import type { Song } from '@/types/music';

interface MenuItem {
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
}

interface SongRowProps {
  song: Song;
  onPress?: (song: Song) => void;
  active?: boolean;
  showArtwork?: boolean;
  playlistId?: string;
  subtitle?: string;
}

export default function SongRow({ song, onPress, active = false, showArtwork = true, playlistId, subtitle }: SongRowProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const store = useMusicStore();

  const handlePress = () => {
    if (onPress) onPress(song);
    else store.playSongs(store.songs, store.songs.findIndex((s) => s.id === song.id));
  };

  const openMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuOpen(true);
  };

  const items: MenuItem[] = [
    { label: 'Play next', icon: 'play-skip-forward', onPress: () => { store.playNext(song); setMenuOpen(false); } },
    { label: 'Add to queue', icon: 'list', onPress: () => { store.addToQueue(song); setMenuOpen(false); } },
    { label: 'Add to playlist', icon: 'albums', onPress: () => { setMenuOpen(false); router.push({ pathname: '/add-to-playlist', params: { songId: song.id } }); } },
    {
      label: song.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      icon: song.isFavorite ? 'heart-dislike' : 'heart',
      onPress: () => { store.toggleFavorite(song.id); setMenuOpen(false); },
    },
    { label: 'View album', icon: 'disc', onPress: () => { setMenuOpen(false); router.push(`/album/${encodeURIComponent(`${song.album}|||${song.albumArtist ?? song.artist}`)}`); } },
    { label: 'View artist', icon: 'person', onPress: () => { setMenuOpen(false); router.push(`/artist/${encodeURIComponent(song.artist)}`); } },
    { label: 'Share', icon: 'share-social', onPress: () => setMenuOpen(false) },
  ];

  if (playlistId) {
    items.push({
      label: 'Remove from playlist',
      icon: 'trash',
      destructive: true,
      onPress: () => { store.removeFromPlaylist(playlistId, song.id); setMenuOpen(false); },
    });
  }

  return (
    <>
      <Pressable onPress={handlePress} onLongPress={openMenu} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityLabel={`${song.title}, by ${song.artist}`}>
        {showArtwork ? <Artwork artwork={song.artwork} seed={`${song.album}${song.artist}`} size={52} /> : null}
        <View style={styles.info}>
          <Text numberOfLines={1} style={[styles.title, active && styles.activeTitle]}>{song.title}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{subtitle ?? song.artist}</Text>
        </View>
        <View style={styles.right}>
          {active ? <EqualizerBars size={14} /> : null}
          <Icon name="ellipsis-horizontal" size={18} color={Colors.textSecondary} onPress={openMenu} />
        </View>
      </Pressable>

      <Modal transparent visible={menuOpen} animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Artwork artwork={song.artwork} seed={song.album} size={44} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.sheetTitle}>{song.title}</Text>
                <Text numberOfLines={1} style={styles.subtitle}>{song.artist}</Text>
              </View>
              <Icon name="close" size={20} color={Colors.textSecondary} onPress={() => setMenuOpen(false)} />
            </View>
            <View style={styles.divider} />
            {items.map((item, idx) => (
              <Pressable key={idx} style={styles.menuItem} onPress={item.onPress} accessibilityLabel={item.label}>
                <Icon name={item.icon} size={20} color={item.destructive ? Colors.danger : Colors.textSecondary} />
                <Text style={[styles.menuLabel, item.destructive && { color: Colors.danger }]}>{item.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  pressed: { backgroundColor: 'rgba(123,44,255,0.08)' },
  info: { flex: 1 },
  title: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
  activeTitle: { color: Colors.pink },
  subtitle: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.cardElevated, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, paddingBottom: 40, paddingTop: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  sheetTitle: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.bold },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  menuLabel: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.medium },
});
