/** Shared domain types for muzix. */

export interface Song {
  id: string; // unique library id (asset id / uri hash)
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  genre?: string;
  duration: number; // seconds
  trackNumber?: number;
  uri: string; // playable uri (file / content / asset)
  artwork?: string | null; // optional artwork uri
  fileName?: string;
  addedAt: number;
  playCount: number;
  lastPlayed?: number;
  isFavorite: boolean;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  songCount: number;
  duration: number;
  artwork?: string | null;
  songs: Song[];
}

export interface Artist {
  id: string;
  name: string;
  songCount: number;
  albumCount: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string | null;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
}

export interface RecentEntry {
  songId: string;
  playedAt: number;
}

export interface SearchHistoryEntry {
  query: string;
  at: number;
}

export interface AppSettings {
  name: string; // greeting name
  theme: 'dark' | 'light' | 'system';
  accent: 'purplePink' | 'bluePurple' | 'redPurple';
  showNotifications: boolean;
  showArtwork: boolean;
  showMediaControls: boolean;
  lockScreenControls: boolean;
  resumePlayback: boolean;
  autoplay: boolean;
  skipDuration: number;
  playbackSpeed: number;
  crossfade: number;
  gapless: boolean;
  onboardingDone: boolean;
  eqEnabled: boolean;
  eqPreset: EqPreset;
}

export type EqPreset = 'Normal' | 'Pop' | 'Rock' | 'Jazz' | 'Classical' | 'Custom';

export interface EqualizerSettings {
  enabled: boolean;
  preset: EqPreset;
  gains: number[]; // 5 bands dB
  bassBoost: number; // 0..1
  virtualizer: boolean;
}

export interface AppNotification {
  id: string;
  type: 'now_playing' | 'playlist_updated' | 'import_complete' | 'new_release' | 'system';
  title: string;
  body: string;
  at: number;
}

export interface QueueItem {
  song: Song;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface Stats {
  totalSongs: number;
  totalPlaylists: number;
  totalFavorites: number;
  totalAlbums: number;
  totalArtists: number;
  hoursPlayed: number;
}
