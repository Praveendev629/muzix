import { create } from 'zustand';
import { Event, RepeatMode, State, TrackPlayer } from '@/services/audio';
import * as Audio from '@/services/audio';
import * as DB from '@/services/database';
import { seedSampleLibrary } from '@/services/library';
import type {
  AppNotification,
  AppSettings,
  EqualizerSettings,
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

  queue: Song[];
  activeSong: Song | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;

  init: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
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
  removeFromQueue: (index: number) => void;

  toggleFavorite: (songId: string) => Promise<void>;
  createPlaylist: (name: string, description?: string, songIds?: string[]) => Promise<string>;
  addToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  addSearch: (q: string) => Promise<void>;
  clearSearch: () => Promise<void>;
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
  queue: [],
  activeSong: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: RepeatMode.Off,

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
      // Seed sample library if no songs exist
      const currentSongs = get().songs;
      if (currentSongs.length === 0) {
        await seedSampleLibrary();
        await get().refreshLibrary();
      }
    } catch {
      // Library can stay empty; the user can rescan from the UI.
    }
    set({ initialized: true });
  },

  refreshLibrary: async () => {
    const [songs, playlists, recentIds, mostPlayedIds] = await Promise.all([
      DB.getAllSongs(),
      DB.getPlaylists(),
      DB.getRecent(),
      DB.getMostPlayed(),
    ]);
    set({ songs, playlists, recentIds, mostPlayedIds });
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
    const queue = [...songs];
    set({ queue, activeSong: queue[index] ?? null });
    await Audio.playSongs(songs, index);
  },

  playNext: async (song) => {
    await Audio.playNext(song);
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
    const { queue, shuffle, activeSong } = get();
    if (shuffle && queue.length > 1) {
      const others = queue.filter((s) => s.id !== activeSong?.id);
      if (others.length) {
        const pick = others[Math.floor(Math.random() * others.length)];
        await Audio.playSongs(queue, queue.findIndex((s) => s.id === pick.id));
        return;
      }
    }
    await Audio.next();
  },

  previous: async () => {
    await Audio.previous();
  },

  seek: async (seconds) => {
    set({ position: seconds });
    await Audio.seekTo(seconds);
  },

  setShuffle: (v) => {
    set({ shuffle: v });
  },

  setRepeat: async (m) => {
    set({ repeat: m });
    await Audio.setRepeatMode(m);
  },

  removeFromQueue: (index) => {
    const queue = get().queue.filter((_, i) => i !== index);
    set({ queue });
  },

  toggleFavorite: async (songId) => {
    const songs = get().songs.map((s) => (s.id === songId ? { ...s, isFavorite: !s.isFavorite } : s));
    const target = songs.find((s) => s.id === songId);
    if (target) await DB.setFavorite(songId, target.isFavorite);
    set({ songs });
  },

  createPlaylist: async (name, description, songIds) => {
    const id = await DB.createPlaylist(name, description, songIds);
    const playlists = await DB.getPlaylists();
    set({ playlists });
    return id;
  },

  addToPlaylist: async (playlistId, songId) => {
    await DB.addSongToPlaylist(playlistId, songId);
    const playlists = await DB.getPlaylists();
    set({ playlists });
  },

  removeFromPlaylist: async (playlistId, songId) => {
    await DB.removeSongFromPlaylist(playlistId, songId);
    const playlists = await DB.getPlaylists();
    set({ playlists });
  },

  deletePlaylist: async (id) => {
    await DB.deletePlaylist(id);
    const playlists = await DB.getPlaylists();
    set({ playlists });
  },

  renamePlaylist: async (id, name) => {
    await DB.renamePlaylist(id, name);
    const playlists = await DB.getPlaylists();
    set({ playlists });
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
}));

function bindListeners() {
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event: any) => {
    const id = event.track?.id as string | undefined;
    if (!id) return;
    const s = useMusicStore.getState();
    const song = s.queue.find((x) => x.id === id) || s.songs.find((x) => x.id === id);
    if (song) {
      useMusicStore.setState({ activeSong: song });
      DB.recordPlay(song.id).catch(() => {});
      const recentIds = await DB.getRecent();
      useMusicStore.setState({ recentIds });
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackState, (event: any) => {
    useMusicStore.setState({ isPlaying: event.state === State.Playing });
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
