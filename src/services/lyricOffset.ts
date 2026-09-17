import { getLyricOffsets, saveLyricOffset } from '@/services/database';

/**
 * Per-song lyric alignment offsets, loaded from SQLite on first use and kept in
 * memory afterwards. A positive offset means "the synced lines are early, nudge
 * them forward in time"; a negative offset means "lines are late".
 */

const cache: Record<string, number> = {};
let loaded = false;
let loading: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = getLyricOffsets()
      .then((map) => {
        Object.assign(cache, map);
      })
      .catch(() => {
        // Table empty or DB busy — fall back to all-zero offsets.
      })
      .finally(() => {
        loaded = true;
      });
  }
  return loading;
}

export function clampOffset(raw: number): number {
  const v = Math.min(30, Math.max(-30, Math.round(raw * 10) / 10));
  return Math.abs(v) < 0.05 ? 0 : v;
}

export async function getLyricOffset(songId: string): Promise<number> {
  await ensureLoaded();
  return cache[songId] ?? 0;
}

export async function setLyricOffset(songId: string, offset: number): Promise<void> {
  const v = clampOffset(offset);
  cache[songId] = v;
  await saveLyricOffset(songId, v);
}