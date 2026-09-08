import Slider from '@react-native-community/slider';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import NeonCard from '@/components/NeonCard';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font, Radius } from '@/constants/theme';
import type { EqualizerSettings, EqPreset } from '@/types/music';

const PRESETS: { name: EqPreset; gains: number[] }[] = [
  { name: 'Normal', gains: [0, 0, 0, 0, 0] },
  { name: 'Pop', gains: [-1, 2, 4, 2, -1] },
  { name: 'Rock', gains: [5, 3, -2, -1, 3] },
  { name: 'Jazz', gains: [3, 1, -1, 2, 3] },
  { name: 'Classical', gains: [4, 2, 0, -1, 2] },
  { name: 'Custom', gains: [0, 0, 0, 0, 0] },
];

const BANDS = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];

export default function EqualizerScreen() {
  const router = useRouter();
  const equalizer = useMusicStore((s) => s.equalizer);
  const applyEqualizer = useMusicStore((s) => s.applyEqualizer);
  const [local, setLocal] = useState<EqualizerSettings>(equalizer);

  const update = (patch: Partial<EqualizerSettings>) => setLocal((prev) => ({ ...prev, ...patch }));

  const applyPreset = (name: EqPreset) => {
    const p = PRESETS.find((x) => x.name === name)!;
    setLocal((prev) => ({ ...prev, preset: name, gains: [...p.gains] }));
  };

  const save = () => applyEqualizer(local);

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => { save(); router.back(); }} style={styles.backBtn} accessibilityLabel="Back"><Icon name="chevron-down" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Equalizer</Text>
        <Pressable onPress={save} style={styles.doneBtn}><Text style={styles.doneText}>Save</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <NeonCard style={styles.card} glow>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.cardTitle}>Equalizer</Text>
              <Text style={styles.cardSub}>Enhance your sound</Text>
            </View>
            <Switch value={local.enabled} onValueChange={(v) => update({ enabled: v })} trackColor={{ true: Colors.purple, false: Colors.card }} thumbColor={Colors.white} />
          </View>
          <Text style={styles.note}>Note: the current background audio engine does not expose a system-level DSP equalizer, so these settings control the equalizer UI and are saved for the native audio implementation.</Text>
        </NeonCard>

        <Text style={styles.section}>Presets</Text>
        <View style={styles.chips}>
          {PRESETS.map((p) => (
            <Pressable key={p.name} style={[styles.chip, local.preset === p.name && styles.chipActive]} onPress={() => applyPreset(p.name)}>
              <Text style={[styles.chipText, local.preset === p.name && styles.chipTextActive]}>{p.name}</Text>
            </Pressable>
          ))}
        </View>

        <NeonCard style={styles.bandsCard}>
          {BANDS.map((band, i) => (
            <View key={band} style={styles.bandRow}>
              <Text style={styles.bandLabel}>{band}</Text>
              <Slider
                style={{ flex: 1, height: 34 }}
                minimumValue={-10}
                maximumValue={10}
                step={1}
                value={local.gains[i] ?? 0}
                onValueChange={(v) => {
                  const g = [...local.gains];
                  g[i] = v;
                  update({ gains: g, preset: 'Custom' });
                }}
                minimumTrackTintColor={Colors.pink}
                maximumTrackTintColor="rgba(255,255,255,0.15)"
                thumbTintColor={Colors.pink}
              />
              <Text style={styles.bandValue}>{local.gains[i] >= 0 ? '+' : ''}{local.gains[i]?.toFixed(0)} dB</Text>
            </View>
          ))}
        </NeonCard>

        <NeonCard style={styles.bandsCard}>
          <View style={styles.bassRow}>
            <Text style={styles.bandLabel}>Bass Boost</Text>
            <Slider
              style={{ flex: 1, height: 34 }}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              value={local.bassBoost}
              onValueChange={(v) => update({ bassBoost: v })}
              minimumTrackTintColor={Colors.purpleBright}
              maximumTrackTintColor="rgba(255,255,255,0.15)"
              thumbTintColor={Colors.purpleBright}
            />
            <Text style={styles.bandValue}>{Math.round(local.bassBoost * 100)}%</Text>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.bandLabel}>Virtualizer</Text>
            <Switch value={local.virtualizer} onValueChange={(v) => update({ virtualizer: v })} trackColor={{ true: Colors.purple, false: Colors.card }} thumbColor={Colors.white} />
          </View>
        </NeonCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  doneBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  doneText: { color: Colors.pink, fontWeight: Font.weight.bold },
  content: { padding: 20, paddingBottom: 40 },
  card: { padding: 18, marginBottom: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  cardSub: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 3 },
  note: { color: Colors.textMuted, fontSize: Font.size.xs, lineHeight: 16, marginTop: 12 },
  section: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.semibold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.purple, borderColor: Colors.borderStrong },
  chipText: { color: Colors.textSecondary, fontWeight: Font.weight.semibold, fontSize: Font.size.sm },
  chipTextActive: { color: Colors.white },
  bandsCard: { padding: 16, marginBottom: 18 },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bandLabel: { width: 74, color: Colors.text, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
  bandValue: { width: 52, textAlign: 'right', color: Colors.textSecondary, fontSize: Font.size.xs, fontVariant: ['tabular-nums'] },
  bassRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
