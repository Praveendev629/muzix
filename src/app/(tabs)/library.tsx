import React, { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import Artwork from '@/components/Artwork';
import SongRow from '@/components/SongRow';
import EmptyState from '@/components/EmptyState';
import GlowButton from '@/components/GlowButton';
import { useMusicStore, albumsOf, artistsOf } from '@/store/musicStore';
import { Colors, Font, Radius } from '@/constants/theme';
import type { Playlist, Song } from '@/types/music';

type Tab = 'playlists' | 'songs' | 'artists' | 'albums';
const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'playlists', label: 'Playlists', icon: 'list' },
  { key: 'songs', label: 'Songs', icon: 'musical-notes' },
  { key: 'artists', label: 'Artists', icon: 'people' },
  { key: 'albums', label: 'Albums', icon: 'albums' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const songs = useMusicStore((s) => s.songs);
  const playlists = useMusicStore((s) => s.playlists);
  const createPlaylist = useMusicStore((s) => s.createPlaylist);
  const deletePlaylist = useMusicStore((s) => s.deletePlaylist);
  const renamePlaylist = useMusicStore((s) => s.renamePlaylist);
  const playSongs = useMusicStore((s) => s.playSongs);
  const activeSong = useMusicStore((s) => s.activeSong);
  const [tab, setTab] = useState<Tab>('playlists');
  const [menuPlaylist, setMenuPlaylist] = useState<Playlist | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');

  const albums = albumsOf(songs);
  const artists = artistsOf(songs);
  const likedCount = songs.filter((s) => s.isFavorite).length;

  const playlistSongs = (p: Playlist): Song[] => p.songIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean) as Song[];

  const confirmCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    await createPlaylist(name);
    setCreateOpen(false);
  };

  const confirmRename = async () => {
    if (!menuPlaylist) return;
    const name = renameName.trim();
    if (name) await renamePlaylist(menuPlaylist.id, name);
    setRenameOpen(false);
  };

  const playPlaylist = (p: Playlist, shuffle = false) => {
    const list = playlistSongs(p);
    if (!list.length) return;
    playSongs(shuffle ? [...list].sort(() => Math.random() - 0.5) : list, 0);
  };

  const renderPlaylist = ({ item }: { item: Playlist }) => (
    <Pressable style={styles.playlistRow} onPress={() => router.push(`/playlist/${encodeURIComponent(item.id)}`)}>
      <Artwork artwork={item.artwork} seed={item.name} size={54} radius={16} iconSize={22} />
      <View style={{ flex: 1 }}>
        <Text style={styles.playlistName}>{item.name}</Text>
        <Text style={styles.sub}>{item.songIds.length} songs</Text>
      </View>
      <Pressable onPress={() => setMenuPlaylist(item)}>
        <Icon name="ellipsis-horizontal" size={18} color={Colors.textSecondary} />
      </Pressable>
    </Pressable>
  );

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn} accessibilityLabel="Settings">
          <Icon name="settings-outline" size={22} color={Colors.text} />
        </Pressable>
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Icon name={t.icon} size={16} color={active ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'playlists' && (
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          renderItem={renderPlaylist}
          ListHeaderComponent={
            <Pressable style={styles.likedRow} onPress={() => router.push('/liked-songs')}>
              <View style={styles.likedIcon}><Icon name="heart" size={26} color={Colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playlistName}>Liked Songs</Text>
                <Text style={styles.sub}>{likedCount} songs</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={Colors.textSecondary} />
            </Pressable>
          }
          ListEmptyComponent={<EmptyState icon="list" title="No playlists yet" subtitle="Create your first playlist to organise your music." buttonTitle="Create Playlist" onButton={() => setCreateOpen(true)} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {tab === 'songs' && (
        <FlatList
          data={songs}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <SongRow song={item} active={activeSong?.id === item.id} />}
          ListEmptyComponent={<EmptyState icon="musical-notes" title="No music yet" subtitle="Add your first song to start listening." buttonTitle="Add Music" onButton={() => router.push('/import-songs')} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {tab === 'artists' && (
        <FlatList
          data={artists}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <Pressable style={styles.playlistRow} onPress={() => router.push(`/artist/${encodeURIComponent(item.id)}`)}>
              <View style={styles.artistAvatar}><Icon name="person" size={24} color={Colors.purpleBright} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.playlistName}>{item.name}</Text>
                <Text style={styles.sub}>{item.songCount} songs · {item.albumCount} albums</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={Colors.textSecondary} />
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="people" title="No artists yet" />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {tab === 'albums' && (
        <FlatList
          data={albums}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <Pressable style={styles.playlistRow} onPress={() => router.push(`/album/${encodeURIComponent(item.id)}`)}>
              <Artwork artwork={item.artwork} seed={item.id} size={54} radius={12} iconSize={22} />
              <View style={{ flex: 1 }}>
                <Text style={styles.playlistName}>{item.name}</Text>
                <Text style={styles.sub}>{item.artist} · {item.songCount} songs</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={Colors.textSecondary} />
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="albums" title="No albums yet" />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {tab === 'playlists' ? (
        <View style={styles.fabWrap}>
          <GlowButton title="Create Playlist" icon="add" onPress={() => setCreateOpen(true)} style={styles.fab} />
        </View>
      ) : null}

      <Modal transparent visible={!!menuPlaylist} animationType="slide" onRequestClose={() => setMenuPlaylist(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuPlaylist(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{menuPlaylist?.name}</Text>
            <SheetItem icon="play" label="Play" onPress={() => { if (menuPlaylist) playPlaylist(menuPlaylist); setMenuPlaylist(null); }} />
            <SheetItem icon="shuffle" label="Shuffle play" onPress={() => { if (menuPlaylist) playPlaylist(menuPlaylist, true); setMenuPlaylist(null); }} />
            <SheetItem icon="create" label="Rename" onPress={() => { if (menuPlaylist) { setRenameName(menuPlaylist.name); setRenameOpen(true); } setMenuPlaylist(null); }} />
            <SheetItem icon="trash" label="Delete playlist" destructive onPress={() => { if (menuPlaylist) deletePlaylist(menuPlaylist.id); setMenuPlaylist(null); }} />
          </Pressable>
        </Pressable>
      </Modal>

      <TextInputModal visible={createOpen} title="New Playlist" placeholder="Playlist name" value={createName} onChangeText={setCreateName} onCancel={() => setCreateOpen(false)} onConfirm={confirmCreate} />
      <TextInputModal visible={renameOpen} title="Rename Playlist" placeholder="Playlist name" value={renameName} onChangeText={setRenameName} onCancel={() => setRenameOpen(false)} onConfirm={confirmRename} />
    </Screen>
  );
}

function SheetItem({ icon, label, onPress, destructive }: { icon: any; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable style={styles.sheetItem} onPress={onPress}>
      <Icon name={icon} size={20} color={destructive ? Colors.danger : Colors.textSecondary} />
      <Text style={[styles.sheetLabel, destructive && { color: Colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function TextInputModal({ visible, title, placeholder, value, onChangeText, onCancel, onConfirm }: { visible: boolean; title: string; placeholder: string; value: string; onChangeText: (t: string) => void; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.center}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>{title}</Text>
          <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.textMuted} style={styles.input} autoFocus />
          <View style={styles.dialogActions}>
            <Pressable onPress={onCancel} style={styles.dialogBtn}><Text style={styles.dialogCancel}>Cancel</Text></Pressable>
            <Pressable onPress={onConfirm} style={styles.dialogBtn}><Text style={styles.dialogConfirm}>Save</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.purple, borderColor: Colors.borderStrong },
  tabText: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
  tabTextActive: { color: Colors.white },
  listContent: { paddingBottom: 120 },
  likedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginHorizontal: 20, marginBottom: 10, borderRadius: Radius.md, backgroundColor: 'rgba(255,20,147,0.10)', borderWidth: 1, borderColor: Colors.borderStrong },
  likedIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.pink },
  playlistRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  playlistName: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
  sub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
  artistAvatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(123,44,255,0.16)', borderWidth: 1, borderColor: Colors.border },
  fabWrap: { position: 'absolute', bottom: 24, left: 20, right: 20 },
  fab: {},
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.cardElevated, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, paddingTop: 16, paddingBottom: 40 },
  sheetTitle: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold, paddingHorizontal: 20, paddingBottom: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 15 },
  sheetLabel: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.medium },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 30 },
  dialog: { alignSelf: 'stretch', backgroundColor: Colors.cardElevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 20 },
  dialogTitle: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold, marginBottom: 16 },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, color: Colors.text, paddingHorizontal: 14, height: 46, fontSize: Font.size.md },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  dialogBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  dialogCancel: { color: Colors.textSecondary, fontWeight: Font.weight.semibold },
  dialogConfirm: { color: Colors.pink, fontWeight: Font.weight.bold },
});
