import React, { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import GlowButton from '@/components/GlowButton';
import Icon, { type IconName } from '@/components/Icon';
import Watermark from '@/components/Watermark';
import { requestAudioPermission } from '@/services/scanner';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font, Gradients, Radius } from '@/constants/theme';

const LOGO = require('../../assets/images/icon.png');

const SLIDES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'musical-notes', title: 'Your Music\nYour Vibe', body: 'Listen to your favorite songs, create playlists, and experience music like never before.' },
  { icon: 'cloud-offline', title: '100% Offline\nLocal Player', body: 'Everything works on your device. No account, no internet, no cloud — your music stays yours.' },
  { icon: 'headset', title: 'Background\nPlayback', body: 'Music keeps playing when you lock your screen, with real notification and headset controls.' },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const applySettings = useMusicStore((s) => s.applySettings);

  const next = () => {
    Haptics.selectionAsync();
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
    } else {
      finish();
    }
  };

  const finish = async () => {
    // Navigate first so the main UI always appears, even if persisting the
    // setting or the permission dialog misbehaves.
    try {
      await applySettings({ onboardingDone: true });
    } catch {
      // Ignore — worst case onboarding shows again next launch.
    }
    router.replace('/(tabs)');
    // Fire the permission request after navigating; the system dialog appears
    // over the home screen and can never block navigation.
    requestAudioPermission().catch(() => {});
  };

  return (
    <LinearGradient colors={Gradients.bgScreen} style={styles.fill}>
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            {i === 0 ? (
              <View style={styles.logoWrap}>
                <Image source={LOGO} style={styles.logo} />
              </View>
            ) : (
              <View style={styles.iconWrap}>
                <Icon name={s.icon} size={56} color={Colors.purpleBright} />
              </View>
            )}
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <GlowButton title={page === SLIDES.length - 1 ? 'Get Started' : 'Next'} onPress={next} icon={page === SLIDES.length - 1 ? 'rocket' : 'arrow-forward'} style={styles.btn} />
        <Text style={styles.skip} onPress={finish}>Skip</Text>
        <Watermark style={styles.watermark} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  logoWrap: { width: 170, height: 170, borderRadius: 40, marginBottom: 36 },
  logo: { width: 170, height: 170, borderRadius: 40 },
  iconWrap: { width: 150, height: 150, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(123,44,255,0.12)', borderWidth: 1, borderColor: Colors.border, marginBottom: 36 },
  title: { color: Colors.text, fontSize: Font.size.xxl, fontWeight: Font.weight.extrabold, textAlign: 'center', lineHeight: 36 },
  body: { color: Colors.textSecondary, fontSize: Font.size.md, textAlign: 'center', marginTop: 16, lineHeight: 24, maxWidth: 320 },
  footer: { alignItems: 'center', paddingBottom: 40, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textMuted },
  dotActive: { width: 26, backgroundColor: Colors.pink },
  btn: { alignSelf: 'stretch' },
  skip: { color: Colors.textSecondary, fontSize: Font.size.md, marginTop: 20, fontWeight: Font.weight.semibold },
  watermark: { marginTop: 24 },
});
