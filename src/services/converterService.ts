const BACKEND_URL = 'https://muzix-ytdl.onrender.com';

export async function ensureBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { timeout: 5000 } as any);
    return res.ok;
  } catch {
    return false;
  }
}

export async function convertYouTubeToMP3(youtubeUrl: string): Promise<{ audioUrl: string; title: string; cover: string } | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/audio?url=${encodeURIComponent(youtubeUrl)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.audioUrl) {
      return { audioUrl: data.audioUrl, title: data.title || '', cover: '' };
    }
    return null;
  } catch (e) {
    console.warn('[converter] Failed:', e);
    return null;
  }
}
