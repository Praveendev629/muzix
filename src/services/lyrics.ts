import type { LyricsSnapshot, Song } from '@/types/music';

/**
 * Lyrics providers backed by free, keyless APIs so we can fetch lyrics for as
 * many songs as possible:
 *  - LRCLIB (lrclib.net): synced LRC + plain lyrics.
 *  - Lyrics.ovh: plain lyrics fallback.
 *  - iTunes Search API: used to <discover> the real artist when the stored
 *    artist is missing/unknown (many device files are tagged as "Unknown
 *    Artist" or have titles like "Alan Walker, Monster").
 * Results are cached in SQLite so future opens are instant + fully offline.
 */

const LRCLIB = 'https://lrclib.net';
const OVH = 'https://api.lyrics.ovh/v1';
const ITUNES = 'https://itunes.apple.com/search';

const TIMEOUT_MS = 25000;
const UNKNOWN = /^(unknown|various|none|unknown\s*artist|\?+|-+)$/i;

/** Cooldown tracker — when LRCLIB returns 5xx we back off for 60 s. */
let lrclibCooldownUntil = 0;
function lrclibAvailable(): boolean {
  return Date.now() >= lrclibCooldownUntil;
}
function setLrclibCooldown() {
  lrclibCooldownUntil = Date.now() + 60_000;
}

/**
 * Minimum time (s) past a line's timestamp before the synced view commits to
 * the next line. LRC timestamps often tag the START of a line slightly before
 * the vocal actually lands, which makes the highlight "run ahead" into lines
 * whose words haven't been sung yet. Holding off for a beat keeps the readout
 * glued to what's actually playing instead of racing ahead.
 */
export const SYNC_LINE_HOLD = 0.25;

export interface TimedLine {
  time: number;
  text: string;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        },
      }),
      TIMEOUT_MS
    );
    if (!res.ok) {
      console.warn('[lyrics] HTTP', res.status, 'from', url.split('?')[0]);
      return null;
    }
    return await res.json();
  } catch (e: any) {
    console.warn('[lyrics] fetch failed:', url.split('?')[0], e?.message ?? e);
    return null;
  }
}

async function fetchJsonRetry(url: string, retries = 1): Promise<any | null> {
  for (let i = 0; i <= retries; i++) {
    const result = await fetchJson(url);
    if (result !== null) return result;
    // Exponential backoff: 2s, 4s, 8s...
    if (i < retries) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return null;
}

/** True when the lyrics API can be reached at all (even if the song has none). */
export async function isLyricsServiceReachable(): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch(`${LRCLIB}/api/get?artist_name=Alan%20Walker&track_name=Darkside`, { headers: { Accept: 'application/json' } }),
      5000
    );
    return !!res;
  } catch {
    return false;
  }
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Cleans a title/artist the same way as norm(), but also drops bracketed
 * annotation groups like "(Official Video)" / "[Album Ver.]" so "Butter
 * (Lyric video)" scores identically to "Butter".
 */
function cleanForScore(s: string) {
  return norm(s.replace(/\s*[\(\[][^)\]]*[\)\]]\s*/g, ' '));
}

/** End time (s) of the last timed line in an LRC string (0 when none). */
function lastTimestamp(lrc: string): number {
  const lines = parseLrc(lrc);
  return lines.length ? lines[lines.length - 1].time : 0;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return Math.max(m, n);
  const dp = new Array(n + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * Ranks LRCLIB search candidates. Submissions that carry real synced timestamps
 * are ALWAYS preferred over plain-text-only ones — even if the plain match has
 * a slightly better title/artist — because only real timestamps can sync. Among
 * candidates of the same kind, artist/title similarity dominates, with duration
 * used to prefer the entry synced against the SAME master as the local file
 * (album vs radio edit, live, remix...).
 */
function candidateScore(it: any, artist: string, title: string, wantDuration: number): number {
  const wantArtist = cleanForScore(artist);
  const wantTitle = cleanForScore(title);
  const a = cleanForScore(it.artistName ?? '');
  const t = cleanForScore(it.trackName ?? '');
  if (!t) return Infinity;
  let score = levenshtein(wantTitle, t);
  if (wantArtist) score += levenshtein(wantArtist, a) * 0.6;
  if (wantDuration > 0 && it.duration > 0) {
    const d = Math.abs(it.duration - wantDuration);
    score += d < 2 ? 0 : d < 6 ? 0.6 : d < 12 ? 1.6 : 3.5;
  }
  // Timeline-coverage check: a synced track that never reaches ~75% of the
  // song's real duration is the wrong edit/version (intro cut, radio edit,
  // instrumental outro mismatch...). Prefer masters whose last line lands
  // near the file's duration so the "words come" at the right moments.
  if (wantDuration > 0) {
    const lastTime = lastTimestamp(it.syncedLyrics ?? '');
    const cover = lastTime / wantDuration;
    if (cover > 0) {
      if (cover < 0.5) score += 8;
      else if (cover < 0.7) score += 4;
      else if (cover >= 0.75 && cover <= 1.3) score -= 2.5;
      else if (cover > 1.4) score += 6;
    }
  }
  if (wantArtist && a === wantArtist && t === wantTitle) score -= 5;
  return score;
}

function pickBest(list: any[], artist: string, title: string, wantDuration: number): any {
  const hasSynced = list.some((it) => typeof it.syncedLyrics === 'string' && it.syncedLyrics.trim());
  const pool = hasSynced
    ? list.filter((it) => typeof it.syncedLyrics === 'string' && it.syncedLyrics.trim())
    : list;
  let best: any = null;
  let bestScore = Infinity;
  for (const it of pool) {
    const score = candidateScore(it, artist, title, wantDuration);
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

function toSnapshot(item: any, source: string): LyricsSnapshot | null {
  const synced = typeof item.syncedLyrics === 'string' && item.syncedLyrics.trim() ? item.syncedLyrics : null;
  const plain = typeof item.plainLyrics === 'string' && item.plainLyrics.trim() ? item.plainLyrics : null;
  const lyrics = plain ?? synced;
  return lyrics ? { synced, plain: lyrics, source } : null;
}

async function lrclibGet(artist: string, title: string, wantDuration = 0): Promise<any | null> {
  if (!lrclibAvailable()) return null;
  const url = `${LRCLIB}/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
  console.log('[lyrics] lrclibGet URL:', url);
  const exact = await fetchJsonRetry(url);
  if (!exact?.trackName) {
    if (exact === null) setLrclibCooldown();
    return null;
  }
  if (wantDuration > 0 && exact.duration > 0 && Math.abs(exact.duration - wantDuration) > 2.5) {
    return null;
  }
  return exact;
}

async function lrclibSearch(artist: string, title: string, wantDuration = 0): Promise<any | null> {
  if (!lrclibAvailable()) return null;
  const qs = artist
    ? `${LRCLIB}/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    : `${LRCLIB}/api/search?track_name=${encodeURIComponent(title)}`;
  console.log('[lyrics] lrclibSearch URL:', qs);
  let list = await fetchJsonRetry(qs);
  console.log('[lyrics] lrclibSearch result:', Array.isArray(list) ? list.length : list);
  if (!Array.isArray(list) || !list.length) {
    if (list === null) setLrclibCooldown();
    const q2 = `${LRCLIB}/api/search?q=${encodeURIComponent(`${artist ? `${artist} ` : ''}${title}`)}`;
    console.log('[lyrics] lrclibSearch fallback q:', q2);
    list = await fetchJsonRetry(q2);
    console.log('[lyrics] lrclibSearch fallback result:', Array.isArray(list) ? list.length : list);
    if (list === null) setLrclibCooldown();
  }
  if (!Array.isArray(list) || !list.length) return null;
  const best = pickBest(list, artist, title, wantDuration);
  console.log('[lyrics] pickBest:', best?.artistName, '/', best?.trackName, 'synced:', !!best?.syncedLyrics);
  return best;
}

async function ovhLyrics(artist: string, title: string): Promise<string | null> {
  const d = await fetchJson(`${OVH}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
  if (d?.lyrics && typeof d.lyrics === 'string' && d.lyrics.trim()) return d.lyrics;
  return null;
}

async function itunesLookup(title: string): Promise<Array<{ artist: string; title: string }>> {
  const d = await fetchJson(`${ITUNES}?term=${encodeURIComponent(title)}&media=music&entity=song&limit=8`);
  const results = Array.isArray(d?.results) ? d.results : [];
  return results
    .filter((r: any) => typeof r?.trackName === 'string' && typeof r?.artistName === 'string')
    .map((r: any) => ({ artist: r.artistName, title: r.trackName }));
}

/**
 * Builds candidate (artist, title) pairs from a song's stored tags + filename.
 * File imports often lose tags, so a title like "Alan Walker, Monster" or
 * "Alan Walker - Monster" gets split back into a real artist + title.
 */
/**
 * Strips common bracketed annotations and trailing source tags from titles so
 * that LRCLIB search can match the bare track name.  E.g.
 *   "Arabic Kuthu (From \"Beast\")" → "Arabic Kuthu"
 *   "Vaathi Coming (Tamil)" → "Vaathi Coming"
 */
function stripTitleAnnotations(title: string): string {
  return title
    .replace(/\s*[\(\[][^)\]]*[\)\]]\s*/g, ' ')   // drop (…)/[…] groups
    .replace(/\s*[-–—|]\s*(Official|Lyric|Audio|Video|Teaser|Trailer|HD|4K|Remix|Live|Cover|Tamil|Telugu|Hindi|Hindi dubbed).*$/i, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function candidatePairs(song: Song): Array<{ artist: string; title: string }> {
  const pairs: Array<{ artist: string; title: string }> = [];
  const seen = new Set<string>();
  const push = (artist: string, title: string) => {
    const a = artist.trim();
    const t = title.trim();
    if (!t) return;
    const key = norm(`${a}|${t}`);
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({ artist: a, title: t });
    }
  };

  const artistKnown = !!song.artist.trim() && !UNKNOWN.test(song.artist.trim());
  if (artistKnown) push(song.artist, song.title);

  // Strip annotations from the title — LRCLIB entries rarely include them.
  const bare = stripTitleAnnotations(song.title);
  if (bare !== song.title) {
    if (artistKnown) push(song.artist, bare);
    push('', bare);
  }

  const m = song.title.trim().match(/^(.+?)[\s]*(?:,|[-–—|])\s*(.+)$/);
  if (m && m[1] && m[2]) {
    const a = m[1].trim();
    const t = m[2].trim();
    push(a, t);
    const bareT = stripTitleAnnotations(t);
    if (bareT !== t) push(a, bareT);
    if (artistKnown && norm(a) !== norm(song.artist)) push(song.artist, t);
    if (artistKnown && norm(a) !== norm(song.artist) && bareT !== t) push(song.artist, bareT);
    if (!artistKnown) { push('', t); if (bareT !== t) push('', bareT); }
  }
  if (!artistKnown) push('', song.title);

  return pairs;
}

/**
 * Looks up lyrics for a song across every available source. Real synced LRC
 * (LRCLIB `syncedLyrics`) is chased across every candidate artist/title pair
 * before settling for plain text: exact LRCLIB -> LRCLIB search (synced
 * preferred, artist- or title-only) -> iTunes disambiguation -> LRCLIB plain ->
 * Lyrics.ovh plain. Returns null when nothing matched.
 */
export async function fetchLyrics(song: Song): Promise<LyricsSnapshot | null> {
  const pairs = candidatePairs(song);
  console.log('[lyrics] fetchLyrics start', song.title, song.artist, 'pairs:', pairs.length);
  // Keeps the best plain-text-only hit so we never lose it while hunting for a
  // synced version of the same track.
  let bestPlain: LyricsSnapshot | null = null;
  const adopt = (item: any): LyricsSnapshot | null => {
    if (!item) return null;
    const snap = toSnapshot(item, 'lrclib');
    if (!snap) return null;
    if (snap.synced) {
      console.log('[lyrics] adopt: got SYNCED from', item.artistName, '/', item.trackName);
      return snap;
    }
    if (!bestPlain) bestPlain = snap;
    return null;
  };

  // 1. LRCLIB for each candidate pair — exact get first (simpler, often faster),
  //    then search (many candidates, prefers synced). Artist-less candidates
  //    still run a title-only search.
  for (const p of pairs) {
    if (p.artist) {
      console.log('[lyrics] lrclibGet:', p.artist, p.title);
      const hit = adopt(await lrclibGet(p.artist, p.title, song.duration));
      if (hit) return hit;
    }
    console.log('[lyrics] searching LRCLIB:', p.artist, p.title);
    const srch = adopt(await lrclibSearch(p.artist, p.title, song.duration));
    if (srch) return srch;
  }

  // 2. No usable artist at all (e.g. "Unknown Artist") — ask iTunes to
  //    identify the track, then retry LRCLIB with the real artist.
  if (!pairs.some((p) => p.artist)) {
    console.log('[lyrics] no artist known, trying iTunes lookup');
    const searchTitle = pairs.map((p) => p.title).find(Boolean) || song.title;
    const tracks = await itunesLookup(searchTitle);
    console.log('[lyrics] iTunes results:', tracks.length);
    for (const t of tracks.slice(0, 3)) {
      const srch = adopt(await lrclibSearch(t.artist, t.title, song.duration));
      if (srch) return srch;
      const hit = adopt(await lrclibGet(t.artist, t.title, song.duration));
      if (hit) return hit;
    }
  }

  // 3. Nothing synced found — settle for the best LRCLIB plain text.
  if (bestPlain) {
    console.log('[lyrics] falling back to bestPlain (lrclib)');
    return bestPlain;
  }

  // 4. Lyrics.ovh plain text as a last resort.
  const ovhSeen = new Set<string>();
  for (const p of [...pairs].slice(0, 3)) {
    if (!p.artist) continue;
    const key = norm(`${p.artist}|${p.title}`);
    if (ovhSeen.has(key)) continue;
    ovhSeen.add(key);
    console.log('[lyrics] trying OVH:', p.artist, p.title);
    const plain = await ovhLyrics(p.artist, p.title);
    if (plain) {
      console.log('[lyrics] got OVH plain');
      return { synced: null, plain, source: 'ovh' };
    }
  }

  console.log('[lyrics] all sources failed for', song.title);
  return null;
}

/** Parses LRC text (with [mm:ss.xx] markers) into lines ordered by time. */
export function parseLrc(lrc: string): TimedLine[] {
  const out: TimedLine[] = [];
  const marker = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  for (const raw of lrc.split(/\r?\n/)) {
    const text = raw.replace(marker, '').trim();
    if (!text) continue;
    marker.lastIndex = 0;
    let m: RegExpExecArray | null;
    const times: number[] = [];
    while ((m = marker.exec(raw)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const fracRaw = m[3] || '0';
      const frac = parseInt(fracRaw, 10) / Math.pow(10, fracRaw.length);
      times.push(min * 60 + sec + frac);
    }
    for (const t of times) out.push({ time: t, text });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/**
 * Renders an LRC timestamp like `[01:23.45]` for a time in seconds. Only used
 * when saving user-marked tap alignment, so every generated line gets a real
 * timestamp instead of an even-spaced guess.
 */
export function formatLrcTimestamp(sec: number): string {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec - Math.floor(sec)) * 100);
  return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}]`;
}

export function formatTime(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}