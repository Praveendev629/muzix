import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { type IconName } from '@/components/Icon';
import MiniPlayer from '@/components/MiniPlayer';
import { useMusicStore } from '@/store/musicStore';
import { Font, useTheme } from '@/constants/theme';

const TABS: { active: IconName; inactive: IconName; label: string }[] = [
  { active: 'home', inactive: 'home-outline', label: 'Home' },
  { active: 'search', inactive: 'search-outline', label: 'Search' },
  { active: 'library', inactive: 'library-outline', label: 'Library' },
];

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        container: { backgroundColor: Colors.bgSecondary },
        bar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bgSecondary, paddingTop: 6, paddingBottom: 6 },
        tab: { flex: 1, alignItems: 'center', gap: 3 },
        iconWrap: { width: 40, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
        label: { color: Colors.textSecondary, fontSize: Font.size.xs, fontWeight: Font.weight.medium },
        labelActive: { color: Colors.pink, fontWeight: Font.weight.bold },
      }),
    [Colors],
  );
};

export default function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const { Colors } = useTheme();
  const styles = useStyles();
  const tabIndex = useMusicStore((s) => s.tabIndex);
  const setTab = useMusicStore((s) => s.setTab);
  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <MiniPlayer />
      <View style={styles.bar}>
        {TABS.map((tab, index) => {
          const isFocused = tabIndex === index;
          const onPress = () => {
            if (!isFocused) setTab(index);
          };
          return (
            <Pressable key={tab.label} onPress={onPress} style={styles.tab} accessibilityRole="tab">
              <View style={styles.iconWrap}>
                <Icon name={isFocused ? tab.active : tab.inactive} size={22} color={isFocused ? Colors.pink : Colors.textSecondary} />
              </View>
              <Text style={[styles.label, isFocused && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}