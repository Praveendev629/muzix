import React from 'react';
import { View } from 'react-native';
import BottomTabBar from '@/components/BottomTabBar';
import PagerTabs from '@/components/PagerTabs';
import { useMusicStore } from '@/store/musicStore';
import HomeScreen from './index';
import SearchScreen from './search';
import LibraryScreen from './library';

export default function TabsLayout() {
  const tabIndex = useMusicStore((s) => s.tabIndex);
  const setTab = useMusicStore((s) => s.setTab);

  return (
    <View style={{ flex: 1, backgroundColor: '#05030A' }}>
      <PagerTabs
        index={tabIndex}
        onChange={setTab}
        pages={[<HomeScreen key="home" />, <SearchScreen key="search" />, <LibraryScreen key="library" />]}
      />
      <BottomTabBar />
    </View>
  );
}