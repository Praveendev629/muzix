import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import NeonCard from '@/components/NeonCard';
import GlowButton from '@/components/GlowButton';
import EmptyState from '@/components/EmptyState';
import { hasAudioPermission, requestAudioPermission, importFromPicker, scanDeviceLibrary } from '@/services/scanner';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font } from '@/constants/theme';

export default function ImportScreen() {
  const router = useRouter();
  const refreshLibrary = useMusicStore((s) => s.refreshLibrary);
  const songs = useMusicStore((s) => s.songs);
  const [granted, setGranted] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    hasAudioPermission().then(setGranted);
  }, []);

  const grant = async () => {
    const ok = await requestAudioPermission();
    setGranted(ok);
  };

  const pickFiles = async () => {
    try {
      const res = await File.pickFileAsync({ multipleFiles: true, mimeTypes: 'audio/*' });
      if (res.canceled || !res.result) return;
      setWorking(true);
      setProgress(`Importing 0 / ${res.result.length}`);
      const result = await importFromPicker(res.result, (done, total) => setProgress(`Importing ${done} / ${total}`));
      setWorking(false);
      await refreshLibrary();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProgress(`${result.added} songs added to your library`);
      if (result.added > 0) router.replace('/(tabs)/library');
    } catch {
      setWorking(false);
      setProgress('Import failed. Please try again.');
    }
  };

  const scanDevice = async () => {
    setWorking(true);
    setProgress('Scanning device for audio...');
    const result = await scanDeviceLibrary((d, t) => setProgress(`Scanning ${d} / ${t}`));
    setWorking(false);
    await refreshLibrary();
    setProgress(`Scan complete: ${result.added} added, ${result.skipped} skipped.`);
  };

  if (!granted) {
    return (
      <Screen showWatermark>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="chevron-down" size={24} color={Colors.text} /></Pressable>
          <Text style={styles.title}>Add Music</Text>
          <View style={styles.backBtn} />
        </View>
        <EmptyState icon="lock-closed" title="Allow muzix to access your music" subtitle="Your music stays on your device. muzix only needs access to find and play your audio files." buttonTitle="Grant Permission" onButton={grant} />
      </Screen>
    );
  }

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="chevron-down" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Add Music</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.libraryCount}>{songs.length} songs in your library</Text>

        <NeonCard style={styles.card} glow>
          <Icon name="musical-notes" size={28} color={Colors.purpleBright} />
          <Text style={styles.cardTitle}>Import files</Text>
          <Text style={styles.cardBody}>Pick audio files from any folder on your device. MP3, M4A, AAC, WAV, FLAC and OGG are supported.</Text>
          <GlowButton title="Add Music" icon="add" onPress={pickFiles} disabled={working} style={styles.btn} />
        </NeonCard>

        <NeonCard style={styles.card}>
          <Icon name="scan" size={28} color={Colors.magenta} />
          <Text style={styles.cardTitle}>Scan device</Text>
          <Text style={styles.cardBody}>Automatically discover all audio files stored on your device and import them into muzix.</Text>
          <GlowButton title="Scan device" icon="refresh" onPress={scanDevice} disabled={working} style={styles.btn} />
        </NeonCard>

        {progress ? (
          <View style={styles.progressRow}>
            <Icon name="sync" size={16} color={Colors.pink} />
            <Text style={styles.progressText}>{progress}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  content: { padding: 20, paddingBottom: 40 },
  libraryCount: { color: Colors.textSecondary, fontSize: Font.size.md, textAlign: 'center', marginBottom: 20 },
  card: { padding: 20, marginBottom: 16, alignItems: 'center' },
  cardTitle: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold, marginTop: 12 },
  cardBody: { color: Colors.textSecondary, fontSize: Font.size.sm, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  btn: { marginTop: 18, alignSelf: 'stretch' },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  progressText: { color: Colors.pink, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
});
