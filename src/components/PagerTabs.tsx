import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type NativeSyntheticEvent } from 'react-native';
import PagerView from 'react-native-pager-view';

interface PagerTabsProps {
  pages: React.ReactNode[];
  index: number;
  onChange: (index: number) => void;
}

/** WhatsApp-style swipe tabs built on the native ViewPager2 (react-native-pager-view).
 *  Children (e.g. the horizontal "Recently Played" row) get native nested-scroll
 *  handling, swipes are light and natural, and no JS gesture handler steals taps. */
export default function PagerTabs({ pages, index, onChange }: PagerTabsProps) {
  const ref = useRef<PagerView>(null);
  const lastIndexRef = useRef(index);

  useEffect(() => {
    if (lastIndexRef.current !== index) {
      lastIndexRef.current = index;
      ref.current?.setPage(index);
    }
  }, [index]);

  const onPageSelected = (e: NativeSyntheticEvent<{ position: number }>) => {
    const i = e.nativeEvent.position;
    if (i !== lastIndexRef.current) {
      lastIndexRef.current = i;
      onChange(i);
    }
  };

  return (
    <PagerView ref={ref} style={styles.viewport} initialPage={index} onPageSelected={onPageSelected}>
      {pages.map((page, i) => (
        <View key={i} style={styles.page}>
          {page}
        </View>
      ))}
    </PagerView>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, backgroundColor: '#05030A' },
  page: { flex: 1 },
});