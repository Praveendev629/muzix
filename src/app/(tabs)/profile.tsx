import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon, { type IconName } from '@/components/Icon';
import Screen from '@/components/Screen';
import NeonCard from '@/components/NeonCard';
import { useMusicStore } from '@/store/musicStore';
import { getStats, getTotalDuration } from '@/services/database';
import { Colors, Font, Radius } from '@/constants/theme';

const SECTIONS: { icon: IconName; label: string; target: string }[] = [
  { icon: 'person-circle', label: 'Account', target: '/settings' },
  { icon: 'play-circle', label: 'Playback', target: '/settings' },
  { icon: 'notifications', label: 'Notifications', target: '/settings' },
  { icon: 'color-palette', label: 'Appearance', target: '/settings' },
  { icon: 'folder-open', label: 'Storage', target: '/settings' },
  { icon: 'help-circle', label: 'Help & Support', target: '/settings' },
  { icon: 'information-circle', label: 'About', target: '/settings' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const settings = useMusicStore((s) => s.settings);
  const songs = useMusicStore((s) => s.songs);
  const playlists = useMusicStore((s) => s.playlists);
  const [stats, setStats] = React.useState({ songs: 0, albums: 0, artists: 0 });
  const [hours, setHours] = React.useState(0);

  React.useEffect(() => {
    getStats().then(setStats);
    getTotalDuration().then((d) => setHours(d / 3600));
  }, [songs.length]);

  const favorites = songs.filter((s) => s.isFavorite).length;

  return (
    <Screen showWatermark>
      <ScrollView contentContainerStyle={styles.content}>
        <NeonCard style={styles.card} glow>
          <View style={styles.avatar}><Icon name="person" size={44} color={Colors.white} /></View>
          <Text style={styles.name}>{settings.name}</Text>
          <Text style={styles.email}>{settings.name.toLowerCase().replace(/\s+/g, '.')}@muzix.app</Text>
          <View style={styles.statsRow}>
            <Stat value={stats.songs} label="Songs" />
            <Stat value={playlists.length} label="Playlists" />
            <Stat value={favorites} label="Favorites" />
            <Stat value={hours.toFixed(1)} label="Hours" />
          </View>
        </NeonCard>

        <View style={styles.section}>
          {SECTIONS.map((s) => (
            <Pressable key={s.label} style={styles.row} onPress={() => router.push(s.target)} accessibilityRole="button">
              <View style={styles.rowIcon}><Icon name={s.icon} size={20} color={Colors.purpleBright} /></View>
              <Text style={styles.rowLabel}>{s.label}</Text>
              <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  card: { padding: 24, alignItems: 'center' },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.purple, borderWidth: 2, borderColor: Colors.borderStrong, marginBottom: 14 },
  name: { color: Colors.text, fontSize: Font.size.xl, fontWeight: Font.weight.bold },
  email: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 24 },
  stat: { alignItems: 'center' },
  statValue: { color: Colors.white, fontSize: Font.size.lg, fontWeight: Font.weight.extrabold },
  statLabel: { color: Colors.textSecondary, fontSize: Font.size.xs, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  section: { marginTop: 24, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(123,44,255,0.12)' },
  rowLabel: { flex: 1, color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.medium },
});
