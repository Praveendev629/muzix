import type { Song } from '@/types/music';

const BASE_URL = 'https://saavn.sumit.co';

// ─── API Types ──────────────────────────────────────────────────────────────

interface SaavnImage {
  quality: string;
  url: string;
}

interface SaavnArtist {
  id: string;
  name: string;
  role?: string;
  image?: SaavnImage[];
}

interface SaavnSongRaw {
  id: string;
  name: string;
  type: string;
  year: string;
  duration: number;
  playCount: string;
  language: string;
  hasLyrics: boolean;
  url: string;
  album?: { id: string; name: string; url?: string };
  artists?: { primary?: SaavnArtist[]; featured?: SaavnArtist[] };
  image?: SaavnImage[];
  downloadUrl?: { quality: string; url: string }[];
}

interface SaavnSearchResponse {
  success: boolean;
  data: {
    total: number;
    start: number;
    results: SaavnSongRaw[];
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface JioSaavnResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artwork: string | null;
  streamUrl: string;
}

function parseImage(images?: SaavnImage[]): string | null {
  if (!images || images.length === 0) return null;
  const preferred = images.find((img) => img.quality === '500x500');
  const fallback = images[images.length - 1];
  return preferred?.url || fallback?.url || null;
}

function parseArtists(artists?: { primary?: SaavnArtist[] }): string {
  const primary = artists?.primary;
  if (primary && primary.length > 0) return primary.map((a) => a.name).join(', ');
  return 'Unknown Artist';
}

function getStreamUrl(urls?: { quality: string; url: string }[]): string | null {
  if (!urls || urls.length === 0) return null;
  const preferred = urls.find((u) => u.quality === '320kbps');
  const fallback = urls[urls.length - 1];
  return preferred?.url || fallback?.url || null;
}

export async function searchJioSaavn(query: string, limit = 20): Promise<JioSaavnResult[]> {
  try {
    console.log('[jiosaavn] Searching:', query);
    const res = await fetch(
      `${BASE_URL}/api/search/songs?query=${encodeURIComponent(query)}&page=1&limit=${limit}`,
    );
    const json: SaavnSearchResponse = await res.json();
    if (!json.success) {
      console.warn('[jiosaavn] API returned success=false');
      return [];
    }
    const results: JioSaavnResult[] = [];
    for (const item of json.data.results || []) {
      if (item.type !== 'song') continue;
      const streamUrl = getStreamUrl(item.downloadUrl);
      if (!streamUrl) continue;
      results.push({
        id: `saavn_${item.id}`,
        title: item.name || '',
        artist: parseArtists(item.artists),
        album: item.album?.name || '',
        duration: item.duration || 0,
        artwork: parseImage(item.image),
        streamUrl,
      });
    }
    console.log('[jiosaavn] Results:', results.length);
    return results;
  } catch (e: any) {
    console.warn('[jiosaavn] Search error:', e?.message);
    return [];
  }
}

export async function getJioSaavnSong(id: string): Promise<JioSaavnResult | null> {
  try {
    const rawId = id.replace('saavn_', '');
    const res = await fetch(`${BASE_URL}/api/songs/${rawId}`);
    const json = await res.json();
    if (!json.success || !json.data) return null;
    const item: SaavnSongRaw = Array.isArray(json.data) ? json.data[0] : json.data;
    const streamUrl = getStreamUrl(item.downloadUrl);
    if (!streamUrl) return null;
    return {
      id: `saavn_${item.id}`,
      title: item.name || '',
      artist: parseArtists(item.artists),
      album: item.album?.name || '',
      duration: item.duration || 0,
      artwork: parseImage(item.image),
      streamUrl,
    };
  } catch {
    return null;
  }
}

export interface JioSaavnArtist {
  id: string;
  name: string;
  artwork: string | null;
  songCount: number;
}

export interface JioSaavnPlaylist {
  id: string;
  name: string;
  artwork: string | null;
  songCount: number;
  description: string;
}

export async function searchJioSaavnArtists(query: string, limit = 10): Promise<JioSaavnArtist[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/search/artists?query=${encodeURIComponent(query)}&page=1&limit=${limit}`);
    const json = await res.json();
    if (!json.success) return [];
    return (json.data?.results || []).map((a: any) => ({
      id: `saavn_artist_${a.id}`,
      name: a.name || '',
      artwork: parseImage(a.image),
      songCount: a.songCount || 0,
    }));
  } catch {
    return [];
  }
}

export async function searchJioSaavnPlaylists(query: string, limit = 10): Promise<JioSaavnPlaylist[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/search/playlists?query=${encodeURIComponent(query)}&page=1&limit=${limit}`);
    const json = await res.json();
    if (!json.success) return [];
    return (json.data?.results || []).map((p: any) => ({
      id: `saavn_playlist_${p.id}`,
      name: p.name || '',
      artwork: parseImage(p.image),
      songCount: p.songCount || 0,
      description: p.description || '',
    }));
  } catch {
    return [];
  }
}

export async function getJioSaavnPlaylistSongs(playlistId: string): Promise<JioSaavnResult[]> {
  try {
    const rawId = playlistId.replace('saavn_playlist_', '');
    const res = await fetch(`${BASE_URL}/api/playlists/${rawId}`);
    const json = await res.json();
    if (!json.success) return [];
    return (json.data?.songs || []).map((item: SaavnSongRaw) => ({
      id: `saavn_${item.id}`,
      title: item.name || '',
      artist: parseArtists(item.artists),
      album: item.album?.name || '',
      duration: item.duration || 0,
      artwork: parseImage(item.image),
      streamUrl: getStreamUrl(item.downloadUrl) || '',
    }));
  } catch {
    return [];
  }
}

export async function getJioSaavnArtistSongs(artistId: string): Promise<JioSaavnResult[]> {
  try {
    const rawId = artistId.replace('saavn_artist_', '');
    const res = await fetch(`${BASE_URL}/api/artists/${rawId}/songs`);
    const json = await res.json();
    if (!json.success) return [];
    return (json.data?.songs || []).map((item: SaavnSongRaw) => ({
      id: `saavn_${item.id}`,
      title: item.name || '',
      artist: parseArtists(item.artists),
      album: item.album?.name || '',
      duration: item.duration || 0,
      artwork: parseImage(item.image),
      streamUrl: getStreamUrl(item.downloadUrl) || '',
    }));
  } catch {
    return [];
  }
}

export async function getJioSaavnLyrics(id: string): Promise<string | null> {
  try {
    const rawId = id.replace('saavn_', '');
    const res = await fetch(`${BASE_URL}/api/songs/${rawId}/lyrics`);
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
}

export function jiosaavnResultToSong(result: JioSaavnResult): Song {
  return {
    id: result.id,
    title: result.title,
    artist: result.artist,
    album: result.album,
    duration: result.duration,
    uri: result.streamUrl,
    artwork: result.artwork,
    addedAt: Date.now(),
    playCount: 0,
    isFavorite: false,
  };
}
