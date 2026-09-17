const BACKEND_URL = 'https://muzix-ytdl.onrender.com';

export interface YTSearchResult {
  videoId: string;
  title: string;
  artist: string;
  duration: string;
  durationSec: number;
  thumbnail: string;
  url: string;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function searchYouTube(query: string, limit = 40): Promise<YTSearchResult[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!res.ok) {
      // Fallback to local scraping
      return await searchYouTubeLocal(query, limit);
    }
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      return await searchYouTubeLocal(query, limit);
    }
    return data.results.map((r: any) => ({
      videoId: r.id,
      title: r.title,
      artist: r.artist,
      duration: formatDuration(r.duration || 0),
      durationSec: r.duration || 0,
      thumbnail: r.thumbnail,
      url: r.url,
    }));
  } catch {
    return await searchYouTubeLocal(query, limit);
  }
}

async function searchYouTubeLocal(query: string, limit = 40): Promise<YTSearchResult[]> {
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await res.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    if (!contents) return [];

    const results: YTSearchResult[] = [];

    for (const item of contents) {
      const video = item.videoRenderer;
      if (!video) continue;
      const videoId = video.videoId;
      if (!videoId) continue;

      const badges = video.badges || [];
      const isShort = badges.some((b: any) => b?.metadataBadgeRenderer?.label?.toLowerCase().includes('short'));
      if (isShort) continue;

      const title = video.title?.runs?.map((r: any) => r.text).join('') || '';
      const artist = video.ownerText?.runs?.[0]?.text || '';
      const durationText = video.lengthText?.simpleText || '';
      const thumbnail = video.thumbnail?.thumbnails?.pop()?.url || '';

      if (!title || !artist || !durationText) continue;

      const parts = durationText.split(':').map(Number);
      let durationSec = 0;
      if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
      else durationSec = parts[0] || 0;

      if (durationSec < 60 || durationSec > 600) continue;

      results.push({
        videoId, title, artist, duration: durationText, durationSec, thumbnail,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
      if (results.length >= limit) break;
    }
    return results;
  } catch (e) {
    console.warn('[youtube] Local search failed:', e);
    return [];
  }
}

export async function convertToMP3(youtubeUrl: string): Promise<{ audioUrl: string; title: string; cover: string } | null> {
  const { convertYouTubeToMP3 } = await import('@/services/converterService');
  return convertYouTubeToMP3(youtubeUrl);
}

export function ytResultToSong(result: YTSearchResult, audioUrl: string): import('@/types/music').Song {
  return {
    id: `yt_${result.videoId}`,
    title: result.title,
    artist: result.artist,
    album: 'YouTube',
    duration: result.durationSec,
    uri: audioUrl,
    artwork: result.thumbnail,
    addedAt: Date.now(),
    playCount: 0,
    isFavorite: false,
  };
}
