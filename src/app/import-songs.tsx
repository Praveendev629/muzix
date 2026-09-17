import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import NeonCard from '@/components/NeonCard';
import GlowButton from '@/components/GlowButton';
import EmptyState from '@/components/EmptyState';
import { hasAudioPermission, requestAudioPermission, importFromPicker, scanDeviceLibrary, type ScanResult } from '@/services/library';
import { useMusicStore } from '@/store/musicStore';
import { Font, useTheme } from '@/constants/theme';

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
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
      }),
    [Colors],
  );
};

export default function ImportScreen() {
  const { Colors } = useTheme();
  const styles = useStyles();
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
    let result: ScanResult;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        multiple: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      setWorking(true);
      setProgress(`Importing 0 / ${res.assets.length}`);
      result = await importFromPicker(res.assets, (done, total) => setProgress(`Importing ${done} / ${total}`));
    } catch (e: any) {
      setWorking(false);
      setProgress(e?.message ? `Import failed: ${e.message}` : 'Import failed. Please try again.');
      return;
    }
    setWorking(false);
    try {
      await refreshLibrary();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Refresh is best-effort; the songs are already in the DB.
    }
    setProgress(`${result.added} songs added to your library`);
    if (result.added > 0) router.replace('/(tabs)/library');
  };

  const scanDevice = async () => {
    let result: ScanResult;
    setWorking(true);
    setProgress('Scanning device for audio...');
    try {
      result = await scanDeviceLibrary((d, t) => setProgress(`Scanning ${d} / ${t}`));
    } catch (e: any) {
      setWorking(false);
      setProgress(e?.message ? `Scan failed: ${e.message}` : 'Scan failed. Please try again.');
      return;
    }
    setWorking(false);
    try {
      await refreshLibrary();
    } catch {
      // Refresh is best-effort.
    }
    setProgress(
      `Scan complete: ${result.added} added, ${result.updated} updated, ${result.failed} failed, ${result.skipped} skipped` +
        (result.duplicate > 0 ? ` (${result.duplicate} already in library)` : '') +
        (result.unsupported > 0 ? ` (${result.unsupported} unsupported format)` : '')
    );
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
