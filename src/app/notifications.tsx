import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon, { type IconName } from '@/components/Icon';
import Screen from '@/components/Screen';
import { addNotification, clearNotifications, getNotifications } from '@/services/database';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font } from '@/constants/theme';

const TYPE_META: Record<string, { icon: IconName; color: string }> = {
  now_playing: { icon: 'musical-notes', color: Colors.pink },
  playlist_updated: { icon: 'albums', color: Colors.purpleBright },
  import_complete: { icon: 'download', color: Colors.purple },
  new_release: { icon: 'sparkles', color: Colors.red },
  system: { icon: 'information-circle', color: Colors.textSecondary },
};

function timeAgo(at: number) {
  const diff = Date.now() - at;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const activeSong = useMusicStore((s) => s.activeSong);
  const [items, setItems] = React.useState<any[]>([]);

  const load = async () => setItems(await getNotifications());

  useEffect(() => {
    (async () => {
      const existing = await getNotifications();
      if (existing.length === 0) {
        await addNotification('now_playing', 'Now Playing', activeSong ? `${activeSong.title} is now playing` : 'Nothing is playing right now');
        await addNotification('playlist_updated', 'Playlist Updated', 'Your library has been refreshed');
        await addNotification('import_complete', 'Welcome to muzix', 'Add music to start listening offline');
      }
      load();
    })();
  }, [activeSong?.id]);

  const clear = async () => {
    await clearNotifications();
    load();
  };

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="arrow-back" size={22} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Notifications</Text>
        <Pressable onPress={clear} style={styles.backBtn} accessibilityLabel="Clear notifications"><Icon name="trash-outline" size={20} color={Colors.textSecondary} /></Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type] ?? TYPE_META.system;
          return (
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: meta.color + '22', borderColor: meta.color }]}>
                <Icon name={meta.icon} size={20} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowBody}>{item.body}</Text>
              </View>
              <Text style={styles.time}>{timeAgo(item.at)}</Text>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  content: { paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowTitle: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
  rowBody: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 3 },
  time: { color: Colors.textMuted, fontSize: Font.size.xs, alignSelf: 'flex-start', paddingTop: 4 },
});
