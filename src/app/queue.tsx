import React, { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, PanResponder, type PanResponderInstance, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import Artwork from '@/components/Artwork';
import SectionHeader from '@/components/SectionHeader';
import { useMusicStore } from '@/store/musicStore';
import { Font, useTheme } from '@/constants/theme';

const ROW_H = 64;

const useStyles = () => {
  const { Colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
        backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
        title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
        hint: { color: Colors.textMuted, fontSize: Font.size.xs, paddingHorizontal: 20, paddingBottom: 8 },
        empty: { alignItems: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 40 },
        emptyText: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
        emptySub: { color: Colors.textSecondary, fontSize: Font.size.md, textAlign: 'center' },
        list: { flex: 1 },
        listContent: { paddingBottom: 24 },
        row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, height: ROW_H, backgroundColor: Colors.transparent },
        dragging: { backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: 12, elevation: 10, shadowColor: Colors.pink, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
        grip: { width: 28, height: 48, alignItems: 'center', justifyContent: 'center' },
        main: { flex: 1 },
        songTitle: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
        songArtist: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
        arrowBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
      }),
    [Colors],
  );
};

export default function QueueScreen() {
  const { Colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const queue = useMusicStore((s) => s.queue);
  const activeSong = useMusicStore((s) => s.activeSong);
  const playSongs = useMusicStore((s) => s.playSongs);
  const removeFromQueue = useMusicStore((s) => s.removeFromQueue);
  const reorderQueue = useMusicStore((s) => s.reorderQueue);

  const activeIndex = activeSong ? queue.findIndex((q) => q.id === activeSong.id) : -1;
  const upNext = queue.filter((_, i) => i !== activeIndex);
  const fullIndex = (k: number) => (activeIndex >= 0 && k >= activeIndex ? k + 1 : k);

  const offsets = useRef<Animated.Value[]>([]);
  const pans = useRef(new Map<number, PanResponderInstance>());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragFrom = useRef(0);
  const dragTarget = useRef(0);

  const valueAt = (i: number) => {
    if (!offsets.current[i]) offsets.current[i] = new Animated.Value(0);
    return offsets.current[i];
  };

  const makePan = (k: number) => {
    const resetAll = () => offsets.current.forEach((v) => v?.setValue(0));
    const settle = (to: number) => {
      const from = dragFrom.current;
      const anims: Animated.CompositeAnimation[] = [];
      offsets.current.forEach((v, i) => {
        anims.push(
          Animated.spring(v, {
            toValue: i === from ? (to - from) * ROW_H : 0,
            useNativeDriver: true,
            bounciness: 6,
            speed: 24,
          }),
        );
      });
      Animated.parallel(anims).start(() => {
        if (from !== to) reorderQueue(fullIndex(from), fullIndex(to));
        resetAll();
        setDragIndex(null);
      });
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        dragFrom.current = k;
        dragTarget.current = k;
        setDragIndex(k);
      },
      onPanResponderMove: (_, g) => {
        const from = dragFrom.current;
        const len = upNext.length;
        const dy = Math.max(-from * ROW_H, Math.min((len - 1 - from) * ROW_H, g.dy));
        const to = Math.max(0, Math.min(len - 1, from + Math.round(dy / ROW_H)));
        dragTarget.current = to;
        valueAt(from).setValue(dy);
        for (let j = 0; j < len; j++) {
          if (j === from) continue;
          const shift = to > from ? (j > from && j <= to ? -ROW_H : 0) : j < from && j >= to ? ROW_H : 0;
          valueAt(j).setValue(shift);
        }
      },
      onPanResponderRelease: () => settle(dragTarget.current),
      onPanResponderTerminate: () => settle(dragFrom.current),
    });
  };

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="chevron-down" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Queue</Text>
        <View style={styles.backBtn} />
      </View>

      <SectionHeader title="Up Next" icon="list" />
      <Text style={styles.hint}>Hold the grip and drag up or down to move songs</Text>
      {upNext.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="musical-notes" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>The queue is empty</Text>
          <Text style={styles.emptySub}>Play a song or album to fill the queue.</Text>
        </View>
      ) : (
        <FlatList
          data={upNext}
          keyExtractor={(s) => s.id}
          renderItem={({ item, index }) => {
            const pan = pans.current.get(index) ?? pans.current.set(index, makePan(index)).get(index)!;
            const isDrag = dragIndex === index;
            return (
              <Animated.View
                style={[styles.row, isDrag && styles.dragging, { transform: [{ translateY: valueAt(index) }] }]}
              >
                <View style={styles.grip} {...pan.panHandlers} accessibilityLabel="Reorder handle">
                  <Icon name="reorder-three" size={20} color={isDrag ? Colors.pink : Colors.textMuted} />
                </View>
                <Artwork artwork={item.artwork} seed={item.album} size={46} radius={10} />
                <Pressable style={styles.main} onPress={() => playSongs(queue, fullIndex(index))}>
                  <Text numberOfLines={1} style={styles.songTitle}>{item.title}</Text>
                  <Text numberOfLines={1} style={styles.songArtist}>{item.artist}</Text>
                </Pressable>
                <Pressable onPress={() => removeFromQueue(fullIndex(index))} style={styles.arrowBtn} accessibilityLabel="Remove"><Icon name="close" size={18} color={Colors.danger} /></Pressable>
              </Animated.View>
            );
          }}
          getItemLayout={(_, i) => ({ length: ROW_H, offset: ROW_H * i, index: i })}
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}
    </Screen>
  );
}