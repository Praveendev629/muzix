import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon, { type IconName } from '@/components/Icon';
import Screen from '@/components/Screen';
import NeonCard from '@/components/NeonCard';
import Watermark from '@/components/Watermark';
import { useMusicStore } from '@/store/musicStore';
import { scanDeviceLibrary } from '@/services/library';
import { getStats } from '@/services/database';
import { Colors, Font, Radius } from '@/constants/theme';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIPS = [5, 10, 15, 30];
const THEMES = ['dark', 'light', 'system'] as const;
const ACCENTS = ['purplePink', 'bluePurple', 'redPurple'] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useMusicStore((s) => s.settings);
  const applySettings = useMusicStore((s) => s.applySettings);
  const refreshLibrary = useMusicStore((s) => s.refreshLibrary);
  const [stats, setStats] = useState({ songs: 0, albums: 0, artists: 0 });
  const [scanning, setScanning] = useState(false);

  React.useEffect(() => {
    getStats().then(setStats);
  }, []);

  const scan = async () => {
    setScanning(true);
    const result = await scanDeviceLibrary();
    setScanning(false);
    await refreshLibrary();
    Alert.alert('Scan complete', `${result.added} added, ${result.skipped} skipped, ${result.failed} failed.`);
  };

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="arrow-back" size={22} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Account" icon="person-circle">
          <Row>
            <Label>Your name</Label>
            <TextInput value={settings.name} onChangeText={(name) => applySettings({ name })} style={styles.input} placeholder="Enter your name" placeholderTextColor={Colors.textMuted} />
          </Row>
          <Row>
            <Label>Theme</Label>
            <Segmented options={THEMES} value={settings.theme} onSelect={(v) => applySettings({ theme: v })} labels={{ dark: 'Dark', light: 'Light', system: 'System' }} />
          </Row>
          <Row>
            <Label>Accent</Label>
            <Segmented options={ACCENTS} value={settings.accent} onSelect={(v) => applySettings({ accent: v })} labels={{ purplePink: 'Purple', bluePurple: 'Blue', redPurple: 'Red' }} />
          </Row>
        </Section>

        <Section title="Playback" icon="play-circle">
          <Row>
            <Label>Playback speed</Label>
            <Segmented options={SPEEDS} value={settings.playbackSpeed} onSelect={(v) => applySettings({ playbackSpeed: v })} labels={Object.fromEntries(SPEEDS.map((s) => [s, `${s}x`]))} />
          </Row>
          <Row>
            <Label>Skip duration (s)</Label>
            <Segmented options={SKIPS} value={settings.skipDuration} onSelect={(v) => applySettings({ skipDuration: v })} labels={Object.fromEntries(SKIPS.map((s) => [s, `${s}`]))} />
          </Row>
          <SwitchRow label="Gapless playback" value={settings.gapless} onChange={(v) => applySettings({ gapless: v })} />
          <SwitchRow label="Autoplay" value={settings.autoplay} onChange={(v) => applySettings({ autoplay: v })} />
          <SwitchRow label="Resume playback" value={settings.resumePlayback} onChange={(v) => applySettings({ resumePlayback: v })} />
        </Section>

        <Section title="Notifications" icon="notifications">
          <SwitchRow label="Show playback notification" value={settings.showNotifications} onChange={(v) => applySettings({ showNotifications: v })} />
          <SwitchRow label="Show artwork in notification" value={settings.showArtwork} onChange={(v) => applySettings({ showArtwork: v })} />
          <SwitchRow label="Media controls" value={settings.showMediaControls} onChange={(v) => applySettings({ showMediaControls: v })} />
          <SwitchRow label="Lock screen controls" value={settings.lockScreenControls} onChange={(v) => applySettings({ lockScreenControls: v })} />
        </Section>

        <Section title="Sound" icon="options">
          <Pressable style={styles.linkRow} onPress={() => router.push('/equalizer')}>
            <Label>Equalizer</Label>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.linkValue}>{settings.eqEnabled ? 'On' : 'Off'}</Text>
              <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/queue')}>
            <Label>Queue</Label>
            <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        </Section>

        <Section title="Storage" icon="folder-open">
          <Row>
            <Label>Songs</Label>
            <Text style={styles.linkValue}>{stats.songs}</Text>
          </Row>
          <Row>
            <Label>Albums</Label>
            <Text style={styles.linkValue}>{stats.albums}</Text>
          </Row>
          <Pressable style={styles.linkRow} onPress={scan} disabled={scanning}>
            <Label>{scanning ? 'Scanning...' : 'Rescan library'}</Label>
            <Icon name="refresh" size={18} color={Colors.textMuted} />
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/import-songs')}>
            <Label>Import music</Label>
            <Icon name="add" size={18} color={Colors.textMuted} />
          </Pressable>
        </Section>

        <Section title="Help & About" icon="information-circle">
          <Pressable style={styles.linkRow} onPress={() => router.push('/notifications')}>
            <Label>In-app notifications</Label>
            <Icon name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
          <Row>
            <Label>Version</Label>
            <Text style={styles.linkValue}>1.0.0</Text>
          </Row>
          <Text style={styles.about}>muzix is a fully offline, local-first music player. No internet, no cloud, no account — your music stays on your device.</Text>
        </Section>

        <Watermark style={{ marginTop: 12 }} />
      </ScrollView>
    </Screen>
  );
}

function Section({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={16} color={Colors.purpleBright} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <NeonCard style={styles.sectionCard}>{children}</NeonCard>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Label({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Label>{label}</Label>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.purple, false: Colors.card }} thumbColor={Colors.white} />
    </View>
  );
}

function Segmented<T extends string | number>({ options, value, onSelect, labels }: { options: readonly T[]; value: T; onSelect: (v: T) => void; labels: Record<string, string> }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Pressable key={o} style={[styles.segmentBtn, value === o && styles.segmentActive]} onPress={() => onSelect(o)}>
          <Text style={[styles.segmentText, value === o && styles.segmentTextActive]}>{labels[String(o)] ?? o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.bold, textTransform: 'uppercase', letterSpacing: 1 },
  sectionCard: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, gap: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, gap: 12 },
  label: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.medium, flexShrink: 1 },
  danger: { color: Colors.danger },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, color: Colors.text, paddingHorizontal: 12, height: 38, fontSize: Font.size.md, minWidth: 140 },
  linkValue: { color: Colors.textSecondary, fontSize: Font.size.sm },
  segment: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  segmentActive: { backgroundColor: Colors.purple },
  segmentText: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
  segmentTextActive: { color: Colors.white },
  about: { color: Colors.textSecondary, fontSize: Font.size.sm, lineHeight: 20, paddingVertical: 10 },
});
