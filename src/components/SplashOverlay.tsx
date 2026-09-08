import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Font, Gradients } from '@/constants/theme';

const LOGO = require('../../assets/images/icon.png');

/** Animated splash with logo scale-in + glow + tagline. */
export default function SplashOverlay() {
  const scale = useRef(new Animated.Value(0.8)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(title, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(tagline, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })).start();
  }, [scale, glow, title, tagline, spin]);

  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.fill}>
      <LinearGradient colors={Gradients.bgScreen} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.logoWrap, { opacity: glow, transform: [{ scale }, { rotate: rot }] }]}>
        <Image source={LOGO} style={styles.logo} />
      </Animated.View>
      <Animated.Text style={[styles.title, { opacity: title }]}>muzix</Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: tagline }]}>Feel Every Beat</Animated.Text>
      <View style={styles.loader}>
        <ActivityDot />
        <ActivityDot delay={120} />
        <ActivityDot delay={240} />
      </View>
    </View>
  );
}

function ActivityDot({ delay = 0 }: { delay?: number }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: -8, duration: 320, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [y, delay]);
  return <Animated.View style={[styles.dot, { transform: [{ translateY: y }] }]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { width: 150, height: 150, borderRadius: 34, marginBottom: 30 },
  logo: { width: 150, height: 150, borderRadius: 34 },
  title: { color: Colors.text, fontSize: Font.size.xxxl, fontWeight: Font.weight.extrabold, letterSpacing: 1 },
  tagline: { color: Colors.pink, fontSize: Font.size.md, fontWeight: Font.weight.medium, marginTop: 8, letterSpacing: 2 },
  loader: { flexDirection: 'row', gap: 8, marginTop: 34 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.purpleBright },
});
