import type { Song } from '@/types/music';

const GAANA_SEARCH_URL = 'https://gaana.com/apiv2';
const GAAANA_SONG_PAGE = 'https://gaana.com';
const JIOSAAVN_URL = 'https://saavn.sumit.co';

// ─── Gaana Search (HTML scraping - works without auth) ─────────────────────

function gaanaFetchPage(path: string): Promise<string> {
  return fetch(`${GAAANA_SONG_PAGE}${path}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
  }).then((r) => r.text());
}

function extractPreloadedState(html: string): any | null {
  const match = html.match(/id="preloaded-state"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GaanaSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artwork: string | null;
  seokey: string;
  language: string;
  trackId: string;
}

// ─── Search via Gaana HTML ─────────────────────────────────────────────────

export async function searchGaana(query: string): Promise<GaanaSearchResult[]> {
  try {
    console.log('[gaana] Searching:', query);
    const html = await gaanaFetchPage(`/search/${encodeURIComponent(query)}`);
    const state = extractPreloadedState(html);
    if (!state?.search?.searchAll?.data?.gr) {
      console.log('[gaana] No gr data found');
      return [];
    }

    const results: GaanaSearchResult[] = [];
    const gr = state.search.searchAll.data.gr;

    for (const group of gr) {
      if (!group.gd) continue;
      for (const item of group.gd) {
        if (item.ty !== 'Track') continue;
        results.push({
          id: `gaana_${item.id}`,
          title: item.ti || '',
          artist: item.sti || 'Unknown Artist',
          album: '',
          duration: 0,
          artwork: item.aw || null,
          seokey: item.seo || '',
          language: item.language || '',
          trackId: String(item.id),
        });
      }
    }

    console.log('[gaana] Results:', results.length);
    return results;
  } catch (e: any) {
    console.warn('[gaana] Search error:', e?.message);
    return [];
  }
}

// ─── Get stream URL via JioSaavn fallback ──────────────────────────────────

interface SaavnSong {
  id: string;
  name: string;
  duration: number;
  album?: { name: string };
  artists?: { primary?: { name: string }[] };
  image?: { url: string; quality: string }[];
  downloadUrl?: { url: string; quality: string }[];
}

async function searchSaavnForStream(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${JIOSAAVN_URL}/api/search/songs?query=${encodeURIComponent(query)}&page=1&limit=1`,
    );
    const json = await res.json();
    if (!json.success || !json.data?.results?.length) return null;
    const song: SaavnSong = json.data.results[0];
    const urls = song.downloadUrl || [];
    const preferred = urls.find((u) => u.quality === '320kbps');
    const fallback = urls[urls.length - 1];
    return preferred?.url || fallback?.url || null;
  } catch {
    return null;
  }
}

// ─── Get stream for Gaana result ───────────────────────────────────────────

export async function getGaanaStreamUrl(result: GaanaSearchResult): Promise<string | null> {
  // Use JioSaavn to find a matching stream for the same song
  const query = `${result.title} ${result.artist}`;
  return searchSaavnForStream(query);
}

// ─── Lyrics from Gaana page ───────────────────────────────────────────────

export async function getGaanaLyrics(seokey: string): Promise<string | null> {
  try {
    const html = await gaanaFetchPage(`/song/${seokey}`);
    const state = extractPreloadedState(html);
    if (state?.lyrics?.lyricsData?.lyrics) {
      return state.lyrics.lyricsData.lyrics;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Convert to Song type ──────────────────────────────────────────────────

export function gaanaResultToSong(result: GaanaSearchResult, streamUrl: string): Song {
  return {
    id: result.id,
    title: result.title,
    artist: result.artist,
    album: result.album || 'Gaana',
    duration: result.duration,
    uri: streamUrl,
    artwork: result.artwork,
    addedAt: Date.now(),
    playCount: 0,
    isFavorite: false,
  };
}
