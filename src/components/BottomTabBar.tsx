import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { type IconName } from '@/components/Icon';
import MiniPlayer from '@/components/MiniPlayer';
import { Colors, Font } from '@/constants/theme';

const ICONS: Record<string, { active: IconName; inactive: IconName; label: string }> = {
  index: { active: 'home', inactive: 'home-outline', label: 'Home' },
  search: { active: 'search', inactive: 'search-outline', label: 'Search' },
  library: { active: 'library', inactive: 'library-outline', label: 'Library' },
  profile: { active: 'person', inactive: 'person-outline', label: 'Profile' },
};

export default function BottomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <MiniPlayer />
      <View style={styles.bar}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const conf = ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline', label: route.name };
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          const label = options.tabBarLabel !== undefined ? options.tabBarLabel : conf.label;
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tab} accessibilityRole="tab">
              <View style={[styles.iconWrap, isFocused && styles.iconActive]}>
                <Icon name={isFocused ? conf.active : conf.inactive} size={22} color={isFocused ? Colors.pink : Colors.textSecondary} />
              </View>
              <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.bgSecondary },
  bar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bgSecondary, paddingTop: 6, paddingBottom: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { width: 40, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconActive: { backgroundColor: 'rgba(255,20,147,0.14)' },
  label: { color: Colors.textSecondary, fontSize: Font.size.xs, fontWeight: Font.weight.medium },
  labelActive: { color: Colors.pink, fontWeight: Font.weight.bold },
});
