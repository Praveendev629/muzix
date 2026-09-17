import type { Song } from '@/types/music';

// ─── Tidal HiFi API Instances ─────────────────────────────────────────────
const TIDAL_HIFI_APIS = [
  'https://tidal.401658.xyz',
  'https://hifi-04ed2aaea09a.herokuapp.com',
  'https://eu-central.monochrome.tf',
  'https://us-west.monochrome.tf',
  'https://api.monochrome.tf',
  'https://monochrome-api.samidy.com',
  'https://tidal.squid.wtf',
];

const TIDAL_PUBLIC_TOKEN = 'txNoH4kkV41MfH25';
const TIDAL_SEARCH_BASE = 'https://api.tidal.com/v1/search/tracks';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TidalTrack {
  id: number;
  title: string;
  duration: number;
  isrc: string | null;
  explicit: boolean;
  audioQuality: string;
  album: {
    id: number;
    title: string;
    cover: string;
  };
  artists: { id: number; name: string }[];
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────

function httpGet(url: string, headers: Record<string, string> = {}): Promise<{ status: number; data: string }> {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      ...headers,
    },
  }).then((r) => r.text().then((d) => ({ status: r.status, data: d })));
}

// ─── Search via Tidal public API ───────────────────────────────────────────

export async function searchTidal(query: string, limit = 20): Promise<TidalTrack[]> {
  try {
    const url = `${TIDAL_SEARCH_BASE}?query=${encodeURIComponent(query)}&limit=${limit}&offset=0&countryCode=IN`;
    const res = await httpGet(url, { 'x-tidal-token': TIDAL_PUBLIC_TOKEN });
    if (res.status !== 200) return [];
    const json = JSON.parse(res.data);
    return json.items || [];
  } catch {
    return [];
  }
}

// ─── Get stream URL from HiFi API instances (with fallback) ───────────────

async function getStreamUrlFromInstance(apiUrl: string, trackId: number): Promise<string | null> {
  try {
    const url = `${apiUrl}/track/?id=${trackId}&quality=LOSSLESS`;
    const res = await httpGet(url);
    if (res.status !== 200) return null;
    const json = JSON.parse(res.data);
    if (Array.isArray(json) && json[0]?.OriginalTrackUrl) {
      return json[0].OriginalTrackUrl;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getTidalStreamUrl(trackId: number): Promise<string | null> {
  // Try each HiFi API instance
  for (const api of TIDAL_HIFI_APIS) {
    const url = await getStreamUrlFromInstance(api, trackId);
    if (url) return url;
  }
  return null;
}

// ─── Convert to Song type ──────────────────────────────────────────────────

export function tidalTrackToSong(track: TidalTrack, streamUrl: string): Song {
  const artist = track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';
  const album = track.album?.title || '';
  const artwork = track.album?.cover
    ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/640x640.jpg`
    : null;

  return {
    id: `tidal_${track.id}`,
    title: track.title,
    artist,
    album,
    duration: track.duration,
    uri: streamUrl,
    artwork,
    addedAt: Date.now(),
    playCount: 0,
    isFavorite: false,
  };
}
