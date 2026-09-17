import { convertYouTubeToMP3 } from '@/services/converterService';

interface CacheEntry {
  audioUrl: string;
  title: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry | null>>();

let isProcessing = false;
const queue: string[] = [];
const listeners = new Map<string, ((entry: CacheEntry | null) => void)[]>();

function notifyListeners(youtubeUrl: string, entry: CacheEntry | null) {
  const cbs = listeners.get(youtubeUrl);
  if (cbs) {
    cbs.forEach((cb) => cb(entry));
    listeners.delete(youtubeUrl);
  }
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  while (queue.length > 0) {
    const url = queue.shift()!;
    if (cache.has(url) || pending.has(url)) continue;

    const promise = (async (): Promise<CacheEntry | null> => {
      try {
        console.log('[convQueue] Converting:', url);
        const result = await convertYouTubeToMP3(url);
        console.log('[convQueue] Result:', JSON.stringify(result)?.substring(0, 200));
        if (result?.audioUrl) {
          const entry: CacheEntry = {
            audioUrl: result.audioUrl,
            title: result.title,
            timestamp: Date.now(),
          };
          cache.set(url, entry);
          notifyListeners(url, entry);
          console.log('[convQueue] Cached:', result.audioUrl.substring(0, 100));
          return entry;
        }
      } catch (e) {
        console.warn('[convQueue] Failed:', e);
      }
      console.warn('[convQueue] No audio URL for:', url);
      notifyListeners(url, null);
      return null;
    })();

    pending.set(url, promise);
    await promise;
    pending.delete(url);
  }

  isProcessing = false;
}

export function enqueueConversion(youtubeUrl: string): void {
  if (cache.has(youtubeUrl) || pending.has(youtubeUrl) || queue.includes(youtubeUrl)) return;
  queue.push(youtubeUrl);
  processQueue();
}

export function enqueueMultiple(urls: string[]): void {
  urls.forEach(enqueueConversion);
}

export function getCachedAudio(youtubeUrl: string): CacheEntry | null {
  const entry = cache.get(youtubeUrl);
  return entry || null;
}

export function isCached(youtubeUrl: string): boolean {
  return cache.has(youtubeUrl);
}

export function waitForConversion(
  youtubeUrl: string,
  timeoutMs = 60000
): Promise<CacheEntry | null> {
  const cached = cache.get(youtubeUrl);
  if (cached) return Promise.resolve(cached);

  const pendingReq = pending.get(youtubeUrl);
  if (pendingReq) return pendingReq;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const cbs = listeners.get(youtubeUrl);
      if (cbs) {
        const idx = cbs.indexOf(cb);
        if (idx >= 0) cbs.splice(idx, 1);
      }
      resolve(cache.get(youtubeUrl) || null);
    }, timeoutMs);

    const cb = (entry: CacheEntry | null) => {
      clearTimeout(timer);
      resolve(entry);
    };

    const existing = listeners.get(youtubeUrl) || [];
    existing.push(cb);
    listeners.set(youtubeUrl, existing);

    enqueueConversion(youtubeUrl);
  });
}

export function clearCache(): void {
  cache.clear();
  pending.clear();
  queue.length = 0;
  listeners.clear();
}

export function getCacheSize(): number {
  return cache.size;
}
