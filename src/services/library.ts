import { Query, MediaType, AssetField, requestPermissionsAsync, getPermissionsAsync } from 'expo-media-library';
import * as DB from '@/services/database';
import * as Fs from '@/services/fs';
import { supportedExtension, cleanTag, extractMetadataFromUri, type ParsedTags } from '@/services/metadata';
import type { Song } from '@/types/music';
import type { DocumentPickerAsset } from 'expo-document-picker';

export interface ScanResult {
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  /** How many of the skipped entries were already imported with the same URI. */
  duplicate: number;
  /** How many were skipped because their filename had an unsupported extension. */
  unsupported: number;
}

/** Simple stable hash used to build managed filenames. */
function hashCode(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i) : '';
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

/** Build a Song from a managed local file + parsed tags. */
function buildSong(
  id: string,
  fileUri: string,
  fileName: string,
  duration: number,
  tags: ParsedTags | null
): Song {
  const title = cleanTag(tags?.title) || fileName.replace(/\.[^/.]+$/, '') || 'Unknown Title';
  const artist = cleanTag(tags?.artist) || 'Unknown Artist';
  const album = cleanTag(tags?.album) || 'Unknown Album';
  return {
    id,
    title,
    artist,
    album,
    albumArtist: cleanTag(tags?.albumArtist),
    genre: cleanTag(tags?.genre),
    duration,
    trackNumber: tags?.trackNumber,
    uri: fileUri,
    artwork: null,
    fileName,
    addedAt: Date.now(),
    playCount: 0,
    isFavorite: false,
  };
}

export async function requestAudioPermission(): Promise<boolean> {
  try {
    const res = await requestPermissionsAsync(false, ['audio']);
    return res.granted;
  } catch {
    return false;
  }
}

export async function hasAudioPermission(): Promise<boolean> {
  try {
    const res = await getPermissionsAsync(false, ['audio']);
    return res.granted;
  } catch {
    return false;
  }
}

/**
 * Query audio assets using the new Query API.
 * Falls back to the legacy getAssetsAsync if the Query API is unavailable.
 */
async function queryAudioAssets(): Promise<any[]> {
  try {
    const assets = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
      .orderBy(AssetField.CREATION_TIME)
      .exe();
    if (assets && assets.length > 0) return assets;
  } catch {
    // Query API may not be available on all platforms/versions, fall through.
  }

  // Fallback: try the legacy getAssetsAsync approach
  try {
    const mod = require('expo-media-library');
    if (typeof mod.getAssetsAsync === 'function') {
      let allAssets: any[] = [];
      let hasNext = true;
      let cursor: string | undefined;
      while (hasNext) {
        const opts: any = { mediaType: 'audio', sortBy: 'creationTime', first: 200 };
        if (cursor) opts.after = cursor;
        const page = await mod.getAssetsAsync(opts);
        allAssets = allAssets.concat(page.assets || []);
        hasNext = page.hasNextPage;
        cursor = page.endCursor;
      }
      return allAssets;
    }
  } catch {
    // Legacy also unavailable.
  }

  return [];
}

/**
 * Extract the playable URI from an asset (handles both new Query API
 * assets with getUri() method and legacy assets with .uri property).
 *
 * IMPORTANT: on scoped-storage Android (10+), the new Query API's getUri()
 * resolves the deprecated MediaStore DATA column to a file:// path that can no
 * longer be read directly, so every copy/read from it fails. The asset's id IS
 * the MediaStore content:// URI and stays readable under READ_MEDIA_AUDIO, so it
 * is preferred whenever it looks like one.
 */
async function getAssetUri(asset: any): Promise<string> {
  const id = asset.id;
  if (typeof id === 'string' && id.startsWith('content://')) return id;
  if (typeof asset.getUri === 'function') {
    try {
      const uri = await asset.getUri();
      if (uri) return uri;
    } catch {
      // fall through
    }
  }
  if (asset.uri) return asset.uri;
  return '';
}

async function getAssetFilename(asset: any, fallback: string): Promise<string> {
  if (typeof asset.getFilename === 'function') return (await asset.getFilename()) || fallback;
  if (asset.filename) return asset.filename || fallback;
  return fallback;
}

async function getAssetDuration(asset: any): Promise<number> {
  if (typeof asset.getDuration === 'function') return ((await asset.getDuration()) || 0) / 1000;
  if (typeof asset.duration === 'number') return asset.duration / 1000;
  return 0;
}

function getAssetId(asset: any): string {
  if (asset.id) return asset.id;
  return String(Math.random());
}

/**
 * Scan all audio on the device via the media library and import into
 * muzix-managed storage (incremental: skips already-imported files).
 */
export async function scanDeviceLibrary(onProgress?: (done: number, total: number) => void): Promise<ScanResult> {
  const result: ScanResult = { added: 0, updated: 0, skipped: 0, failed: 0, duplicate: 0, unsupported: 0 };
  let assets: any[] = [];
  try {
    assets = await queryAudioAssets();
  } catch {
    return result;
  }

  let known: Map<string, Song> = new Map();
  try {
    known = new Map((await DB.getAllSongs()).map((s) => [s.id, s]));
  } catch {
    // DB not ready — treat the library as empty.
  }

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    onProgress?.(i + 1, assets.length);
    try {
      const uri = await getAssetUri(asset);
      if (!uri) {
        result.failed++;
        continue;
      }
      const name = await getAssetFilename(asset, `track${i}`);
      if (!supportedExtension(name)) {
        result.unsupported++;
        result.skipped++;
        continue;
      }
      const id = `dev_${hashCode(getAssetId(asset))}_${extOf(name)}`;
      const existing = known.get(id);
      const duration = await getAssetDuration(asset);
      if (existing && existing.uri === uri) {
        if (needsMetadata(existing)) {
          // Already imported but with filename-only tags: try to enrich it now.
          const tags = await extractMetadataFromUri(uri, name);
          const song = buildSong(id, uri, name, duration, tags);
          await persistArtwork(song, tags?.artwork, tags?.artworkMime);
          if (song.artist !== existing.artist || song.album !== existing.album || song.artwork !== existing.artwork) {
            song.playCount = existing.playCount ?? 0;
            await DB.upsertSongs([song]);
            known.set(id, song);
            result.updated++;
            continue;
          }
        }
        // Already imported with the exact same URI and complete tags.
        result.duplicate++;
        result.skipped++;
        continue;
      }
      // Play directly from the device's content:// URI (readable under
      // READ_MEDIA_AUDIO). No copy step — scoped storage and unreadable file
      // paths can't break the scan.
      const tags = await extractMetadataFromUri(uri, name);
      const song = buildSong(id, uri, name, duration, tags);
      await persistArtwork(song, tags?.artwork, tags?.artworkMime);
      await DB.upsertSongs([song]);
      known.set(id, song);
      if (existing) result.updated++;
      else result.added++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

/** Import files selected through the system document picker. */
export async function importFromPicker(
  picked: DocumentPickerAsset[],
  onProgress?: (done: number, total: number) => void
): Promise<ScanResult> {
  const result: ScanResult = { added: 0, updated: 0, skipped: 0, failed: 0, duplicate: 0, unsupported: 0 };
  let known: Set<string> = new Set();
  try {
    known = new Set((await DB.getAllSongs()).map((s) => s.id));
  } catch {
    // DB not ready yet — fall back to an empty known set instead of aborting
    // the whole import with a generic "Import failed".
  }
  for (let i = 0; i < picked.length; i++) {
    const f = picked[i];
    onProgress?.(i + 1, picked.length);
    try {
      const name = f.name;
      if (!name || !supportedExtension(name)) {
        result.unsupported++;
        result.skipped++;
        continue;
      }
      const id = `imp_${hashCode(f.uri)}${extOf(name)}`;
      if (known.has(id)) {
        result.skipped++;
        continue;
      }
      // Play directly from the picker's content:// URI (expo-document-picker
      // grants persistent read access). No copy step to fail on.
      const tags = await extractMetadataFromUri(f.uri, name);
      const song = buildSong(id, f.uri, name, 0, tags);
      await persistArtwork(song, tags?.artwork, tags?.artworkMime);
      await DB.upsertSongs([song]);
      known.add(id);
      result.added++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

/**
 * Import a single audio file straight from a raw URI (content:// or file://).
 * Used when another app does "open with muzix". Best-effort: copies into
 * managed storage when possible, but still returns a playable song (from the
 * original URI) even if the copy, tag read, artwork or DB write fails.
 */
export async function importUri(uri: string, name?: string): Promise<Song | null> {
  if (!uri) return null;
  try {
    let fileName = name || '';
    if (!fileName) {
      const last = uri.split('/').pop() || 'incoming';
      try {
        fileName = decodeURIComponent(last);
      } catch {
        fileName = last;
      }
    }
    fileName = sanitizeName(fileName) || 'incoming';
    const ext = extOf(fileName) || '.mp3';
    const id = `open_${hashCode(uri)}${ext}`;
    const tags = await extractMetadataFromUri(uri, fileName);
    const song = buildSong(id, uri, fileName, 0, tags);
    try {
      await persistArtwork(song, tags?.artwork, tags?.artworkMime);
      await DB.upsertSongs([song]);
    } catch {
      // playback still possible without DB persistence
    }
    return song;
  } catch {
    return null;
  }
}

async function persistArtwork(song: Song, artwork?: Uint8Array, mime?: string) {
  if (!artwork || artwork.length === 0) return;
  try {
    const ext = mime === 'image/png' ? '.png' : mime && mime.includes('jpeg') ? '.jpg' : '.jpg';
    const name = `art_${hashCode(song.id)}${ext}`;
    const uri = await Fs.writeArtwork(artwork, name);
    if (uri) song.artwork = uri;
  } catch {
    /* ignore artwork errors */
  }
}

/** True when a song is missing embedded tag info (or was stored before tag
 * extraction existed) and should have its metadata re-read from the file. */
function needsMetadata(s: Song): boolean {
  // U+FFFD leak marks rows written by an older M4A parser that read 8 bytes
  // past each text/artwork payload into the neighbouring atom. Re-read them.
  const leak = /\uFFFD/.test(`${s.title}${s.artist}${s.album}`);
  return leak || s.artist === 'Unknown Artist' || s.album === 'Unknown Album' || !s.artwork || s.artwork.endsWith('.img');
}

/**
 * Re-read embedded tags + artwork for every song that is missing metadata and
 * persist whatever is found. Purely incremental: songs that already have an
 * artist and artwork are left untouched. Returns how many songs were updated.
 *
 * DB writes are best-effort (expo-sqlite on this device rejects execAsync once
 * the shared handle has been in use), so each updated song is also delivered
 * through `onUpdated` so callers can update their in-memory state directly and
 * the UI reflects the metadata immediately, regardless of persistence.
 */
export async function refreshMetadata(
  onProgress?: (done: number, total: number) => void,
  onUpdated?: (song: Song) => void
): Promise<number> {
  let songs: Song[] = [];
  try {
    songs = await DB.getAllSongs();
  } catch {
    return 0;
  }
  const todo = songs.filter(needsMetadata);
  if (todo.length === 0) return 0;
  let changed = 0;
  for (let i = 0; i < todo.length; i++) {
    onProgress?.(i + 1, todo.length);
    const s = todo[i];
    try {
      const fileName = s.fileName || (s.uri.split('/').pop() || '');
      const tags = await extractMetadataFromUri(s.uri, fileName);
      if (!tags) continue;
      const updated = buildSong(s.id, s.uri, fileName, s.duration, tags);
      await persistArtwork(updated, tags.artwork, tags.artworkMime);
      const changedSomething =
        updated.title !== s.title || updated.artist !== s.artist || updated.album !== s.album || updated.artwork !== s.artwork;
      if (changedSomething) {
        changed++;
        onUpdated?.(updated);
        DB.upsertSongs([updated]).catch(() => {
          // Best-effort: the in-memory update above already fixed the UI.
        });
      }
    } catch {
      // One bad file must not stall the whole backfill.
    }
  }
  return changed;
}


