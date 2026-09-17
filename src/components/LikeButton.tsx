import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { Font, useTheme } from '@/constants/theme';

const MINI_COUNT = 6;

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        item: { alignItems: 'center', gap: 6, padding: 8 },
        box: { width: 22, height: 22 },
        ring: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
        label: { color: Colors.textSecondary, fontSize: Font.size.xs, fontWeight: Font.weight.medium },
        half: { position: 'absolute', top: 0, left: 0, width: 11, height: 22, overflow: 'hidden' },
        leftInner: { width: 22, height: 22 },
        rightInner: { width: 22, height: 22, marginLeft: -11 },
        mini: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
      }),
    [Colors],
  );
};

interface LikeButtonProps {
  favorite: boolean;
  onToggle: () => void;
}

export default function LikeButton({ favorite, onToggle }: LikeButtonProps) {
  const { Colors } = useTheme();
  const styles = useStyles();
  const scale = useRef(new Animated.Value(1)).current;
  const breakV = useRef(new Animated.Value(0)).current;
  const minis = useRef(new Array(MINI_COUNT).fill(0).map(() => new Animated.Value(0))).current;
  const seeds = useRef(
    new Array(MINI_COUNT).fill(0).map(() => ({
      x: (Math.random() - 0.5) * 30,
      rise: 46 + Math.random() * 56,
      size: 10 + Math.random() * 6,
      delay: Math.random() * 170,
    }))
  ).current;

  const resetMinis = () => minis.forEach((m) => { m.stopAnimation(); m.setValue(0); });

  const handlePress = () => {
    if (favorite) {
      breakV.stopAnimation();
      breakV.setValue(0);
      Animated.timing(breakV, { toValue: 1, duration: 640, useNativeDriver: true }).start(() => breakV.setValue(0));
    } else {
      scale.stopAnimation();
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 110, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
      ]).start();

      resetMinis();
      Animated.parallel(
        minis.map((m, i) =>
          Animated.sequence([
            Animated.delay(seeds[i].delay),
            Animated.timing(m, { toValue: 1, duration: 950, useNativeDriver: true }),
          ])
        )
      ).start(() => resetMinis());
    }
    onToggle();
  };

  const breakOpacity = breakV.interpolate({ inputRange: [0, 0.06, 0.6, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Pressable style={styles.item} onPress={handlePress} accessibilityLabel="Like">
      <View style={styles.box}>
        <Animated.View style={[styles.ring, { transform: [{ scale }] }]}>
          <Icon name={favorite ? 'heart' : 'heart-outline'} size={22} color={favorite ? Colors.pink : Colors.text} />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.half,
            {
              opacity: breakOpacity,
              transform: [
                { translateX: breakV.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
                { translateY: breakV.interpolate({ inputRange: [0, 1], outputRange: [6, 58] }) },
                { rotate: '-20deg' },
              ],
            },
          ]}
        >
          <View style={styles.leftInner}><Icon name="heart" size={22} color={Colors.pink} /></View>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.half,
            {
              opacity: breakOpacity,
              transform: [
                { translateX: breakV.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) },
                { translateY: breakV.interpolate({ inputRange: [0, 1], outputRange: [10, 62] }) },
                { rotate: '20deg' },
              ],
            },
          ]}
        >
          <View style={styles.rightInner}><Icon name="heart" size={22} color={Colors.pink} /></View>
        </Animated.View>

        {minis.map((m, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.mini,
              {
                left: (22 - seeds[i].size) / 2 + seeds[i].x,
                top: 12 - seeds[i].size / 2,
                width: seeds[i].size,
                height: seeds[i].size,
                opacity: m.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                transform: [{ translateY: m.interpolate({ inputRange: [0, 1], outputRange: [0, -seeds[i].rise] }) }],
              },
            ]}
          >
            <Icon name="heart" size={seeds[i].size} color={Colors.pink} />
          </Animated.View>
        ))}
      </View>
      <Text style={styles.label}>Like</Text>
    </Pressable>
  );
}