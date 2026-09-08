import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import Artwork from '@/components/Artwork';
import SectionHeader from '@/components/SectionHeader';
import { useMusicStore } from '@/store/musicStore';
import { Colors, Font, Radius } from '@/constants/theme';

export default function QueueScreen() {
  const router = useRouter();
  const queue = useMusicStore((s) => s.queue);
  const activeSong = useMusicStore((s) => s.activeSong);
  const playSongs = useMusicStore((s) => s.playSongs);
  const removeFromQueue = useMusicStore((s) => s.removeFromQueue);

  const activeIndex = activeSong ? queue.findIndex((q) => q.id === activeSong.id) : -1;
  const upNext = queue.filter((_, i) => i !== activeIndex);

  const remove = (index: number) => removeFromQueue(index);

  return (
    <Screen showWatermark>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back"><Icon name="chevron-down" size={24} color={Colors.text} /></Pressable>
        <Text style={styles.title}>Queue</Text>
        <View style={styles.backBtn} />
      </View>

      <SectionHeader title="Up Next" icon="list" />
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
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Icon name="reorder-three" size={20} color={Colors.textMuted} />
              <Artwork artwork={item.artwork} seed={item.album} size={46} radius={10} />
              <Pressable style={{ flex: 1 }} onPress={() => playSongs(queue, queue.indexOf(item))}>
                <Text numberOfLines={1} style={styles.songTitle}>{item.title}</Text>
                <Text numberOfLines={1} style={styles.songArtist}>{item.artist}</Text>
              </Pressable>
              <Pressable onPress={() => remove(queue.indexOf(item))} style={styles.arrowBtn} accessibilityLabel="Remove"><Icon name="close" size={18} color={Colors.danger} /></Pressable>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 40 },
  emptyText: { color: Colors.text, fontSize: Font.size.lg, fontWeight: Font.weight.bold },
  emptySub: { color: Colors.textSecondary, fontSize: Font.size.md, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 8 },
  songTitle: { color: Colors.text, fontSize: Font.size.md, fontWeight: Font.weight.semibold },
  songArtist: { color: Colors.textSecondary, fontSize: Font.size.sm, marginTop: 2 },
  arrowBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
