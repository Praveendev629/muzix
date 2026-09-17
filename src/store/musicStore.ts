import { create } from 'zustand';
import { Event, RepeatMode, State, TrackPlayer } from '@/services/audio';
import * as Audio from '@/services/audio';
import * as DB from '@/services/database';
import { scanDeviceLibrary, refreshMetadata, hasAudioPermission } from '@/services/library';
import type {
  AppNotification,
  AppSettings,
  EqualizerSettings,
  LyricsSnapshot,
  Playlist,
  Song,
} from '@/types/music';

interface MusicState {
  initialized: boolean;
  songs: Song[];
  playlists: Playlist[];
  recentIds: string[];
  mostPlayedIds: string[];
  searchHistory: string[];
  notifications: AppNotification[];
  settings: AppSettings;
  equalizer: EqualizerSettings;
  lyrics: Record<string, LyricsSnapshot>;

  queue: Song[];
  activeSong: Song | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  shuffleHistory: string[];
  tabIndex: number;

  init: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  applySongMetadata: (song: Song) => void;
  setTab: (index: number) => void;
  applySettings: (partial: Partial<AppSettings>) => Promise<void>;
  applyEqualizer: (eq: EqualizerSettings) => Promise<void>;

  playSongs: (songs: Song[], index: number) => Promise<void>;
  playNext: (song: Song) => Promise<void>;
  addToQueue: (song: Song, play?: boolean) => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  setShuffle: (v: boolean) => void;
  setRepeat: (m: RepeatMode) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  reorderQueue: (from: number, to: number) => Promise<void>;

  toggleFavorite: (songId: string) => Promise<void>;
  createPlaylist: (name: string, description?: string, songIds?: string[]) => Promise<string>;
  addToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  addSearch: (q: string) => Promise<void>;
  clearSearch: () => Promise<void>;
  saveLyrics: (songId: string, doc: LyricsSnapshot) => Promise<void>;
}

let listenersBound = false;

export const useMusicStore = create<MusicState>((set, get) => ({
  initialized: false,
  songs: [],
  playlists: [],
  recentIds: [],
  mostPlayedIds: [],
  searchHistory: [],
  notifications: [],
  settings: {
    name: 'Praveen',
    theme: 'dark',
    accent: 'purplePink',
    customTheme: null,
    customAccent: null,
    showNotifications: true,
    showArtwork: true,
    showMediaControls: true,
    lockScreenControls: true,
    resumePlayback: false,
    autoplay: true,
    skipDuration: 15,
    playbackSpeed: 1,
    crossfade: 0,
    gapless: false,
    onboardingDone: false,
    eqEnabled: false,
    eqPreset: 'Normal',
  },
  equalizer: { enabled: false, preset: 'Normal', gains: [0, 0, 0, 0, 0], bassBoost: 0, virtualizer: false },
  lyrics: {},
  queue: [],
  activeSong: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: RepeatMode.Off,
  shuffleHistory: [],
  tabIndex: 0,

  init: async () => {
    if (get().initialized) return;
    // Audio setup must never block the UI: ensureSetup has its own timeout,
    // and this is wrapped so an unexpected failure can't stall startup.
    try {
      await Audio.ensureSetup();
    } catch {
      // Ignored — playback calls retry internally; the app must still open.
    }
    try {
      if (!listenersBound) {
        listenersBound = true;
        bindListeners();
      }
      const [settings, equalizer, playlists, searchHistory, notifications] = await Promise.all([
        DB.getSettings(),
        DB.getEqualizer(),
        DB.getPlaylists(),
        DB.getSearchHistory(),
        DB.getNotifications(),
      ]);
      set({ settings, equalizer, playlists, searchHistory, notifications });
    } catch {
      // Keep defaults if the local DB is unavailable; never stall the UI.
    }
    try {
      await get().refreshLibrary();
    } catch {
      // Library can stay empty; the user can rescan from the UI.
    }
    // Mark initialized so the splash screen dismisses immediately.
    set({ initialized: true });

    // Background work: scan device audio (non-blocking).
    (async () => {
      try {
        const currentSongs = get().songs;
        const hasDeviceSongs = currentSongs.some((s) => s.id.startsWith('dev_'));
        const hasContentSongs = currentSongs.some((s) => s.id.startsWith('dev_') && s.uri?.startsWith('content://'));
        // Scan when there are no device songs at all, or when the stored ones are
        // stale (older builds stored copy-based file:// URIs that no longer play).
        if (!hasContentSongs) {
          const hasPermission = await hasAudioPermission();
          if (hasPermission) {
            try {
              await scanDeviceLibrary();
              await get().refreshLibrary();
            } catch {
              // Scan may fail; the library stays as-is.
            }
          }
        }
        // Purge any bundled sample songs left over from older builds so the
        // library only ever contains device audio.
        const stale = get().songs.filter((s) => s.id.startsWith('sample_'));
        if (stale.length) {
          await DB.deleteSongs(stale.map((s) => s.id));
          await get().refreshLibrary();
        }
        // Backfill embedded tags + artwork for songs that were imported before
        // tag extraction existed (or whose head read failed). Applies updates
        // in-memory immediately (DB persistence is best-effort because
        // expo-sqlite on this device rejects writes once the handle has been
        // in use — see upsertSongs). Idempotent: only songs missing
        // artist/artwork are re-read.
        try {
          await refreshMetadata(undefined, (song) => get().applySongMetadata(song));
        } catch {
          // Ignore — the user can also trigger a rescan from Settings.
        }
      } catch {
        // Ignore — user can rescan from the UI.
      }
    })();
  },

  refreshLibrary: async () => {
    let songs: Song[] = [];
    let playlists: Playlist[] = [];
    let recentIds: string[] = [];
    let mostPlayedIds: string[] = [];
    let lyrics: Record<string, LyricsSnapshot> = {};
    try {
      await serial(async () => {
        try {
          songs = await DB.getAllSongs();
        } catch {
          // Songs stay empty if the query fails; other UI still renders.
        }
        try {
          playlists = await DB.getPlaylists();
        } catch {
          // Keep whatever is already loaded.
        }
        try {
          recentIds = await DB.getRecent();
        } catch {
          recentIds = [];
        }
        try {
          mostPlayedIds = await DB.getMostPlayed();
        } catch {
          mostPlayedIds = [];
        }
        try {
          lyrics = await DB.getAllLyrics();
        } catch {
          // No lyrics cache is fine; the lyrics screen fetches on demand.
        }
      });
    } catch {
      // A serialization failure must never stall the UI.
    }
    set({ songs, playlists, recentIds, mostPlayedIds, lyrics });
  },

  applySongMetadata: (song) => {
    set((st) => {
      const idx = st.songs.findIndex((s) => s.id === song.id);
      if (idx === -1) return {};
      const songs = st.songs.slice();
      songs[idx] = song;
      return { songs };
    });
  },

  setTab: (index) => {
    set({ tabIndex: index });
  },

  applySettings: async (partial) => {
    const settings = { ...get().settings, ...partial };
    await DB.saveSettings(partial);
    set({ settings });
  },

  applyEqualizer: async (equalizer) => {
    await DB.saveEqualizer(equalizer);
    set({ equalizer });
  },

  playSongs: async (songs, index) => {
    const target = songs[index] ?? songs[0];
    if (!target) return;
    userInitiatedThisSession = true;
    // Mirror audio.ts: the touched song goes first so TrackPlayer's smart
    // active-track event (fired during add()) matches what the UI already shows.
    const queue = [target, ...songs.filter((s) => s.id !== target.id)];
    set({ queue, activeSong: target });
    // Record on intent BEFORE playback so a tap is always reflected in Recently
    // Played even if the native TrackPlayer call hiccups mid-flight.
    try {
      await recordPlayAndRefresh(target);
    } catch {
      // Recording must never break playback.
    }
    try {
      await Audio.playSongs(songs, index);
      // Loading a fresh queue can reset the native repeat mode; re-apply it so
      // repeat keeps looping even after switching songs or starting a new list.
      const activeRepeat = get().repeat;
      if (activeRepeat !== RepeatMode.Off) await Audio.setRepeatMode(activeRepeat);
    } catch {
      // A playback hiccup must never toast or throw.
    }
  },

  playNext: async (song) => {
    const { queue, activeSong } = get();
    const at = activeSong ? queue.findIndex((s) => s.id === activeSong.id) : -1;
    const insertAt = at >= 0 ? at + 1 : queue.length;
    const nextQueue = [...queue];
    nextQueue.splice(insertAt, 0, song);
    set({ queue: nextQueue });
    await Audio.playNext(song, insertAt);
  },

  addToQueue: async (song, play) => {
    const queue = [...get().queue, song];
    set({ queue });
    await Audio.addToQueue(song, play);
  },

  togglePlay: async () => {
    await Audio.togglePlay();
  },

  next: async () => {
    const { queue, shuffle, activeSong, repeat, shuffleHistory } = get();
    if (queue.length === 0) return;
    userInitiatedThisSession = true;
    if (shuffle && queue.length > 1) {
      // True shuffle: don't replay anything heard this cycle until every song
      // in the queue has played once. This stops "tap next" from randomly
      // re-hitting a song that just played while unplayed songs get skipped.
      const hist = shuffleHistory.filter((id) => queue.some((s) => s.id === id));
      let candidates = queue.filter((s) => s.id !== activeSong?.id && !hist.includes(s.id));
      if (candidates.length === 0) {
        candidates = queue.filter((s) => s.id !== activeSong?.id);
        if (candidates.length) set({ shuffleHistory: [] });
      }
      if (candidates.length) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const target = queue.findIndex((s) => s.id === pick.id);
        // Native skip: TrackPlayer's queue order matches the store queue, and
        // skipping never rebuilds — so no flash of the first library song.
        set((st) => ({ activeSong: pick, shuffleHistory: [...st.shuffleHistory.filter((id) => id !== pick.id), pick.id] }));
        await Audio.skipTo(target);
        return;
      }
    }
    const current = activeSong ? queue.findIndex((s) => s.id === activeSong.id) : -1;
    let target = current + 1;
    if (target >= queue.length) {
      if (repeat === RepeatMode.Queue) target = 0;
      else return;
    }
    if (target < 0) target = 0;
    // Optimistically show the target track; the track-change event syncs the UI.
    // Always skip directly to the exact index: with repeat=Queue the previous
    // Audio.next() trick (skip current+1) blew past the end of the native queue,
    // so the screen showed the wrapped track while the audio stayed put.
    set({ activeSong: queue[target] ?? null });
    await Audio.skipTo(target);
  },

  previous: async () => {
    const { queue, shuffle, activeSong, position, repeat } = get();
    userInitiatedThisSession = true;
    if (shuffle && queue.length > 1) {
      const others = queue.filter((s) => s.id !== activeSong?.id);
      if (others.length) {
        const pick = others[Math.floor(Math.random() * others.length)];
        const target = queue.findIndex((s) => s.id === pick.id);
        set({ activeSong: pick });
        await Audio.skipTo(target);
        return;
      }
    }
    if (position > 3) {
      await Audio.seekTo(0);
      set({ position: 0 });
      return;
    }
    if (queue.length === 0) return;
    const current = activeSong ? queue.findIndex((s) => s.id === activeSong.id) : -1;
    let target = current - 1;
    if (target < 0) {
      if (repeat === RepeatMode.Queue) target = queue.length - 1;
      else target = 0;
    }
    set({ activeSong: queue[target] ?? null });
    await Audio.previous();
  },

  seek: async (seconds) => {
    set({ position: seconds });
    await Audio.seekTo(seconds);
  },

  setShuffle: (v) => {
    // Reset the shuffle history any time shuffle toggles so a new cycle starts.
    if (get().shuffle !== v) set({ shuffle: v, shuffleHistory: [] });
  },

  setRepeat: async (m) => {
    set({ repeat: m });
    await Audio.setRepeatMode(m);
  },

  removeFromQueue: async (index) => {
    const { queue, activeSong } = get();
    if (index < 0 || index >= queue.length) return;
    const removed = queue[index];
    if (activeSong && removed.id === activeSong.id) return; // Never drop the playing track.
    // Keep the native TrackPlayer queue in lockstep so store indices (used by
    // shuffle skips and queue edits) always map to the same native track.
    set({ queue: queue.filter((_, i) => i !== index) });
    await Audio.removeFromQueue(index);
  },

  reorderQueue: async (from, to) => {
    const { queue } = get();
    if (from === to) return;
    if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
    const nextQueue = [...queue];
    const [song] = nextQueue.splice(from, 1);
    nextQueue.splice(to, 0, song);
    set({ queue: nextQueue });
    await Audio.moveInQueue(from, to);
  },

  toggleFavorite: async (songId) => {
    const songs = get().songs.map((s) => (s.id === songId ? { ...s, isFavorite: !s.isFavorite } : s));
    const target = songs.find((s) => s.id === songId);
    if (target) await DB.setFavorite(songId, target.isFavorite);
    set({ songs });
    if (get().activeSong?.id === songId) {
      set({ activeSong: target ?? null });
    }
  },

  createPlaylist: async (name, description, songIds) => {
    const id = `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const playlist: Playlist = {
      id,
      name,
      description,
      artwork: null,
      songIds: songIds ?? [],
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
    };
    set((st) => ({ playlists: [...st.playlists, playlist] }));
    try {
      await DB.createPlaylist(name, description, songIds, id);
    } catch {
      // Best-effort persistence: the in-memory playlist above is already live.
    }
    return id;
  },

  addToPlaylist: async (playlistId, songId) => {
    set((st) => ({
      playlists: st.playlists.map((p) =>
        p.id !== playlistId || p.songIds.includes(songId)
          ? p
          : { ...p, songIds: [...p.songIds, songId], updatedAt: Date.now() }
      ),
    }));
    try {
      await DB.addSongToPlaylist(playlistId, songId);
    } catch {
      // Best-effort persistence; the in-memory update above is already live.
    }
  },

  removeFromPlaylist: async (playlistId, songId) => {
    set((st) => ({
      playlists: st.playlists.map((p) =>
        p.id !== playlistId ? p : { ...p, songIds: p.songIds.filter((x) => x !== songId), updatedAt: Date.now() }
      ),
    }));
    try {
      await DB.removeSongFromPlaylist(playlistId, songId);
    } catch {
      // Best-effort persistence; the in-memory update above is already live.
    }
  },

  deletePlaylist: async (id) => {
    set((st) => ({ playlists: st.playlists.filter((p) => p.id !== id) }));
    try {
      await DB.deletePlaylist(id);
    } catch {
      // Best-effort persistence; the in-memory removal above is already live.
    }
  },

  renamePlaylist: async (id, name) => {
    set((st) => ({ playlists: st.playlists.map((p) => (p.id === id ? { ...p, name } : p)) }));
    try {
      await DB.renamePlaylist(id, name);
    } catch {
      // Best-effort persistence; the in-memory rename above is already live.
    }
  },

  addSearch: async (q) => {
    await DB.addSearchHistory(q);
    const searchHistory = await DB.getSearchHistory();
    set({ searchHistory });
  },

  clearSearch: async () => {
    await DB.clearSearchHistory();
    set({ searchHistory: [] });
  },

  saveLyrics: async (songId, doc) => {
    try {
      await DB.saveLyrics(songId, doc);
    } catch {
      // The in-memory cache still works for this session if the write fails.
    }
    set((st) => ({ lyrics: { ...st.lyrics, [songId]: doc } }));
  },
}));

let lastPlayRecord = { id: '', at: 0 };
let userInitiatedThisSession = false;
// The TrackPlayer service restores its previous queue a few moments after app
// start and fires an ActiveTrackChanged for the restored track, which never
// actually played in this session. That restore event always lands in the
// first moments after the listeners are bound, so a short window ignores only
// it — everything after is a genuine in-session play.
const listenerStart = Date.now();

// expo-sqlite (SDK 57) intermittently throws a NullPointerException when
// multiple `prepareAsync` calls land on the same database concurrently (known
// upstream bug). Every DB operation here runs through one promise queue so no
// two statements can be prepared at the same time.
let dbChain: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = dbChain.then(task, task);
  dbChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Record a play and update Recently Played. The UI list is updated from
 * in-memory state FIRST (newest song at the top) so it always reflects the
 * playing song instantly; the database write is best-effort persistence
 * (expo-sqlite can reject concurrently-prepared statements, which must never
 * block the UI). A short dedupe window stops the same track from being counted
 * twice when both `playSongs` and the player event fire for one tap.
 */
async function recordPlayAndRefresh(song: Song) {
  const now = Date.now();
  const skipCount = song.id === lastPlayRecord.id && now - lastPlayRecord.at < 3000;
  lastPlayRecord = { id: song.id, at: now };

  await serial(async () => {
    const store = useMusicStore.getState();
    // In-memory Recently Played: bring the just-played song to the front.
    const recentIds = [song.id, ...store.recentIds.filter((x) => x !== song.id)];
    if (!skipCount) {
      try {
        await DB.recordPlay(song.id);
      } catch {
        // Persistence is best-effort; the in-memory list is already correct.
      }
    }
    let mostPlayedIds = store.mostPlayedIds;
    try {
      mostPlayedIds = await DB.getMostPlayed();
    } catch {
      // Keep the current list if the query hiccups.
    }
    const songs = store.songs.map((s) =>
      s.id === song.id && !skipCount ? { ...s, playCount: (s.playCount ?? 0) + 1 } : s
    );
    useMusicStore.setState({ songs, recentIds, mostPlayedIds, activeSong: song });
  });
}

function bindListeners() {
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event: any) => {
    const id = event.track?.id as string | undefined;
    if (!id) return;
    // Ignore the queue TrackPlayer restores when its service starts: that track
    // never actually played in this session, and recording it would fake a play.
    if (Date.now() - listenerStart < 5000) return;
    const s = useMusicStore.getState();
    const song = s.queue.find((x) => x.id === id) || s.songs.find((x) => x.id === id);
    if (song) {
      // Shuffle-aware auto-advance. When a track ends TrackPlayer moves to the
      // next position in the native queue (the plain library order), so the
      // freshly-started song differs from the store's activeSong. Manual skips
      // (player / mini player / notification) set activeSong to their target
      // first, so a matching id means we initiated this change. Redirect any
      // song we didn't pick to a random unplayed one while shuffle is on.
      if (s.shuffle && s.activeSong?.id !== id && s.queue.length > 1) {
        const hist = s.shuffleHistory.filter((xid) => s.queue.some((q) => q.id === xid));
        let candidates = s.queue.filter((q) => q.id !== id && q.id !== s.activeSong?.id && !hist.includes(q.id));
        if (candidates.length === 0) {
          candidates = s.queue.filter((q) => q.id !== id && q.id !== s.activeSong?.id);
          if (candidates.length) useMusicStore.setState({ shuffleHistory: [] });
        }
        if (candidates.length) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          const target = s.queue.findIndex((q) => q.id === pick.id);
          useMusicStore.setState((st) => ({
            activeSong: pick,
            shuffleHistory: [...st.shuffleHistory.filter((xid) => xid !== pick.id), pick.id],
          }));
          try {
            await Audio.skipTo(target);
          } catch {
            // Ignore — the native player keeps whatever it had.
          }
          return;
        }
      }
      userInitiatedThisSession = true;
      try {
        await recordPlayAndRefresh(song);
      } catch {
        // Never break playback because of a tracking hiccup.
      }
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackState, async (event: any) => {
    const playing = event.state === State.Playing;
    useMusicStore.setState({ isPlaying: playing });
    if (!playing) return;
    // Playback actually started (from a tap, the mini-player, or the media
    // notification) — track the active song so it lands in Recently Played even
    // when it was restored by TrackPlayer after an app restart.
    const s = useMusicStore.getState();
    let song: Song | null = null;
    const track = await Audio.getActiveTrack();
    if (track) song = s.songs.find((x) => x.id === track.id) || s.queue.find((x) => x.id === track.id) || (track as Song);
    if (song) {
      userInitiatedThisSession = true;
      try {
        await recordPlayAndRefresh(song);
      } catch {
        // Never break on a tracking hiccup.
      }
    }
  });

  setInterval(async () => {
    const s = useMusicStore.getState();
    if (!s.activeSong) return;
    const progress = await Audio.getProgress();
    useMusicStore.setState({ position: progress.position, duration: progress.duration });
  }, 500);
}

/** Derived grouping helpers. */
export function albumsOf(songs: Song[]) {
  const map = new Map<string, Song[]>();
  for (const s of songs) {
    const key = `${s.album}|||${s.albumArtist ?? s.artist}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).map(([key, list]) => {
    const [name, artist] = key.split('|||');
    return { id: key, name, artist, songs: list, songCount: list.length, duration: list.reduce((a, b) => a + b.duration, 0), artwork: list[0]?.artwork ?? null };
  });
}

export function artistsOf(songs: Song[]) {
  const map = new Map<string, Song[]>();
  for (const s of songs) {
    if (!map.has(s.artist)) map.set(s.artist, []);
    map.get(s.artist)!.push(s);
  }
  return Array.from(map.entries()).map(([name, list]) => ({
    id: name,
    name,
    songCount: list.length,
    albumCount: new Set(list.map((s) => s.album)).size,
  }));
}
