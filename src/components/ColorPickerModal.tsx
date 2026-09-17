import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import Icon from '@/components/Icon';
import { Font, Radius, useTheme } from '@/constants/theme';
import { makePalette } from '@/constants/theme';
import { hslToHex, hexToRgb, rgbToHsl } from '@/utils/color';
import type { AppSettings } from '@/types/music';

export interface ColorToken {
  key: string;
  label: string;
  color: string;
}

interface Props {
  visible: boolean;
  title: string;
  kind: 'theme' | 'accent';
  tokens: ColorToken[];
  settings: AppSettings;
  onApply: (colors: Record<string, string>) => void;
  onRestoreDefaults?: () => void;
  onClose: () => void;
}

const PRESETS: string[] = [
  '#7B2CFF', '#A855F7', '#FF1493', '#FF007F', '#E01E4C', '#FF1744',
  '#FF6D00', '#FFB300', '#FFEA00', '#00C853', '#00B7EB', '#2E5BFF',
  '#2979FF', '#00ACC1', '#5C6BC0', '#8E24AA', '#37474F', '#BDBCBC',
  '#F4F2FA', '#FFFFFF', '#0A0613', '#110C1D',
];

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        sheet: { backgroundColor: Colors.cardElevated, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, paddingTop: 16, maxHeight: '88%' },
        swipe: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderStrong, alignSelf: 'center', marginBottom: 10 },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
        title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
        closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
        tokensRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, flexWrap: 'wrap' },
        token: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
        tokenActive: { borderColor: Colors.pink },
        tokenDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
        tokenLabel: { color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
        tokenLabelActive: { color: Colors.text },
        swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, marginTop: 16 },
        swatch: { width: 56, height: 56, borderRadius: Radius.md, borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', marginBottom: 4 },
        hexBox: { flex: 1 },
        hexInput: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, color: Colors.text, paddingHorizontal: 12, height: 40, fontSize: Font.size.md, textTransform: 'uppercase' },
        hexLabel: { color: Colors.textMuted, fontSize: Font.size.xs, marginTop: 4 },
        sliderWrap: { paddingHorizontal: 20, marginTop: 14 },
        sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        sliderLabel: { width: 74, color: Colors.textSecondary, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
        sliderTrack: { flex: 1 },
        presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 16 },
        preset: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
        preview: { marginHorizontal: 20, marginTop: 16, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 14 },
        previewTitle: { fontSize: Font.size.sm, fontWeight: Font.weight.semibold, marginBottom: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
        previewCard: { borderRadius: Radius.md, padding: 10, borderWidth: 1 },
        previewAccent: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8, alignSelf: 'flex-start' },
        previewAccentText: { color: Colors.white, fontSize: Font.size.sm, fontWeight: Font.weight.bold },
        actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 18 },
        restoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 16 },
        cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
        applyBtn: { flex: 1, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
        btnLabel: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.bold },
        applyLabel: { color: Colors.white, fontSize: Font.size.md, fontWeight: Font.weight.bold },
        restoreLabel: { color: Colors.danger, fontSize: Font.size.sm, fontWeight: Font.weight.semibold },
        body: { paddingBottom: 8 },
      }),
    [Colors],
  );
};

function normalize(hex: string | undefined): string | null {
  if (!hex) return null;
  let h = hex.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#([0-9a-fA-F]{3})$/.test(h)) {
    const [a, b, c] = h.slice(1).split('');
    h = `#${a}${a}${b}${b}${c}${c}`;
  }
  if (!/^#([0-9a-fA-F]{6})$/.test(h)) return null;
  return h.toLowerCase();
}

export default function ColorPickerModal({ visible, title, kind, tokens, settings, onApply, onRestoreDefaults, onClose }: Props) {
  const { Colors } = useTheme();
  const styles = useStyles();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string>(tokens[0]?.key ?? '');
  const [hsl, setHsl] = useState({ h: 270, s: 1, l: 0.55 });
  const [hexInput, setHexInput] = useState('');

  useEffect(() => {
    if (!visible) return;
    const init: Record<string, string> = {};
    tokens.forEach((t) => (init[t.key] = t.color));
    setDraft(init);
    setSelected(tokens[0]?.key ?? '');
    const c = tokens[0]?.color ?? '#000000';
    setHsl(rgbToHsl(hexToRgb(c)));
    setHexInput(c.toUpperCase());
  }, [visible, title]);

  // The color currently being edited, recomputed from the HSL sliders.
  const editedColor = useMemo(() => hslToHex(hsl), [hsl]);
  const previewTitle = kind === 'theme' ? 'Custom theme' : 'Custom accent';

  const pickToken = (key: string) => {
    setSelected(key);
    const c = normalize(draft[key] ?? editedColor) ?? editedColor;
    setHsl(rgbToHsl(hexToRgb(c)));
    setHexInput(c.toUpperCase());
  };

  const commit = (color: string) => {
    const c = normalize(color) ?? editedColor;
    setHsl(rgbToHsl(hexToRgb(c)));
    setHexInput(c.toUpperCase());
    setDraft((d) => ({ ...d, [selected]: c }));
  };

  const updateChannel = (channel: 'h' | 's' | 'l', value: number) => {
    const next = { ...hsl, [channel]: value };
    setHsl(next);
    const c = hslToHex(next);
    setHexInput(c.toUpperCase());
    setDraft((d) => ({ ...d, [selected]: c }));
  };

  const changeHex = (raw: string) => {
    setHexInput(raw.toUpperCase());
    const c = normalize(raw);
    if (c) {
      setHsl(rgbToHsl(hexToRgb(c)));
      setDraft((d) => ({ ...d, [selected]: c }));
    }
  };

  // Live preview built from the draft colors.
  const preview = useMemo(() => {
    if (kind === 'theme') {
      const draftTheme = { bg: draft.bg ?? '#05030A', card: draft.card ?? '#110C1D', text: draft.text ?? '#FFFFFF' };
      return makePalette('custom', settings.accent, { theme: draftTheme, accent: settings.customAccent });
    }
    const base = draft.base ?? '#7B2CFF';
    return makePalette(settings.theme === 'custom' ? 'custom' : settings.theme, 'custom', {
      theme: settings.customTheme,
      accent: { base },
    });
  }, [kind, draft, settings]);

  const apply = () => {
    const clean: Record<string, string> = {};
    for (const t of tokens) clean[t.key] = normalize(draft[t.key] ?? t.color) ?? t.color;
    onApply(clean);
    onClose();
  };

  // The Modal keeps children mounted in JS even while hidden, so nothing may
  // run until it is actually shown (draft/hex state is seeded on open).
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.swipe} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close"><Icon name="close" size={18} color={Colors.text} /></Pressable>
          </View>
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.tokensRow}>
              {tokens.map((t) => {
                const active = t.key === selected;
                const color = normalize(draft[t.key] ?? t.color) ?? t.color;
                return (
                  <Pressable key={t.key} style={[styles.token, active && styles.tokenActive]} onPress={() => pickToken(t.key)} accessibilityLabel={t.label}>
                    <View style={[styles.tokenDot, { backgroundColor: color }]} />
                    <Text style={[styles.tokenLabel, active && styles.tokenLabelActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.swatchRow}>
              <View>
                <LinearGradient
                  colors={kind === 'theme' ? [preview.bg, preview.card] : [preview.purpleBright, preview.pink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.swatch}
                />
                <Text style={{ color: Colors.textMuted, fontSize: Font.size.xs, textAlign: 'center' }}>Preview</Text>
              </View>
              <View style={styles.hexBox}>
                <TextInput
                  value={hexInput}
                  onChangeText={changeHex}
                  style={styles.hexInput}
                  placeholder="#AABBCC"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <Text style={styles.hexLabel}>Hex value — type or pick below</Text>
              </View>
            </View>

            <View style={styles.sliderWrap}>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Hue</Text>
                <Slider
                  style={styles.sliderTrack}
                  minimumValue={0}
                  maximumValue={360}
                  step={1}
                  value={hsl.h}
                  minimumTrackTintColor={Colors.pink}
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor={Colors.white}
                  onValueChange={(v) => updateChannel('h', v)}
                />
              </View>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Vividness</Text>
                <Slider
                  style={styles.sliderTrack}
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  value={hsl.s * 100}
                  minimumTrackTintColor={Colors.pink}
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor={Colors.white}
                  onValueChange={(v) => updateChannel('s', v / 100)}
                />
              </View>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Brightness</Text>
                <Slider
                  style={styles.sliderTrack}
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  value={hsl.l * 100}
                  minimumTrackTintColor={Colors.pink}
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor={Colors.white}
                  onValueChange={(v) => updateChannel('l', v / 100)}
                />
              </View>
            </View>

            <View style={styles.presets}>
              {PRESETS.map((c) => {
                const active = normalize(draft[selected]) === normalize(c);
                return (
                  <Pressable key={c} onPress={() => commit(c)} accessibilityLabel={c}>
                    <View style={[styles.preset, { backgroundColor: c }, active && { borderWidth: 2, borderColor: Colors.white }]} />
                  </Pressable>
                );
              })}
            </View>

            {/* Live preview panel */}
            <View style={styles.preview}>
              <Text style={{ color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.bold }}>{previewTitle}</Text>
              <Text style={{ color: Colors.textMuted, fontSize: Font.size.sm, marginTop: 2 }}>Live sample of your theme</Text>
              <View style={[styles.previewCard, { backgroundColor: preview.bg, borderColor: preview.border }]}>
                <View style={{ borderRadius: Radius.sm, padding: 10, backgroundColor: preview.card, borderWidth: 1, borderColor: preview.borderStrong }}>
                  <Text style={{ color: preview.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold }}>This is how it looks</Text>
                  <Text style={{ color: preview.textSecondary, fontSize: Font.size.sm, marginTop: 2 }}>Secondary text sits here</Text>
                </View>
                <View style={[styles.previewAccent, { backgroundColor: preview.purple }]}>
                  <Text style={styles.previewAccentText}>Accent</Text>
                </View>
              </View>
            </View>

            {onRestoreDefaults && (
              <Pressable style={styles.restoreRow} onPress={() => { onRestoreDefaults(); onClose(); }} accessibilityLabel="Restore app theme">
                <Icon name="refresh" size={16} color={Colors.danger} />
                <Text style={styles.restoreLabel}>Restore app theme</Text>
              </Pressable>
            )}
            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.btnLabel}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.applyBtn, { backgroundColor: preview.purple }]} onPress={apply}>
                <Text style={styles.applyLabel}>Apply & pick</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}