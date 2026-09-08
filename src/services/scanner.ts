import { Query, MediaType, AssetField, requestPermissionsAsync, getPermissionsAsync } from 'expo-media-library';
import { File } from 'expo-file-system';
import * as DB from '@/services/database';
import * as Fs from '@/services/fs';
import { extractMetadata, supportedExtension, cleanTag } from '@/services/metadata';
import type { Song } from '@/types/music';

export interface ScanResult {
  added: number;
  updated: number;
  skipped: number;
  failed: number;
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

function buildSong(
  id: string,
  fileUri: string,
  fileName: string,
  duration: number,
  tags: Awaited<ReturnType<typeof extractMetadata>>
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
 * Scan all audio on the device via the media library (covers internal storage
 * and SD card) and import into muzix-managed storage.
 */
export async function scanDeviceLibrary(
  onProgress?: (done: number, total: number) => void
): Promise<ScanResult> {
  const result: ScanResult = { added: 0, updated: 0, skipped: 0, failed: 0 };
  let assets: any[] = [];
  try {
    assets = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
      .orderBy(AssetField.CREATION_TIME)
      .exe();
  } catch {
    return result;
  }

  const known = new Set((await DB.getAllSongs()).map((s) => s.id));

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    onProgress?.(i + 1, assets.length);
    try {
      const uri = await asset.getUri();
      const name = (await asset.getFilename()) || `track-${i}`;
      if (!supportedExtension(name)) {
        result.skipped++;
        continue;
      }
      const id = `dev_${hashCode(asset.id)}${extOf(name)}`;
      if (known.has(id)) {
        result.skipped++;
        continue;
      }
      let fileUri = Fs.managedFileUri(id);
      if (!Fs.managedFileExists(id)) {
        try {
          fileUri = await Fs.copyIntoManagedStorage(uri, id);
        } catch {
          result.failed++;
          continue;
        }
      }
      const duration = ((await asset.getDuration()) || 0) / 1000;
      const tags = await extractMetadata(fileUri, name);
      const song = buildSong(id, fileUri, name, duration, tags);
      await persistArtwork(song, tags?.artwork);
      await DB.upsertSongs([song]);
      known.add(id);
      result.added++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

/** Import files selected through the system document picker. */
export async function importFromPicker(
  picked: File[],
  onProgress?: (done: number, total: number) => void
): Promise<ScanResult> {
  const result: ScanResult = { added: 0, updated: 0, skipped: 0, failed: 0 };
  const known = new Set((await DB.getAllSongs()).map((s) => s.id));
  for (let i = 0; i < picked.length; i++) {
    const f = picked[i];
    onProgress?.(i + 1, picked.length);
    try {
      const name = f.name;
      if (!supportedExtension(name)) {
        result.skipped++;
        continue;
      }
      const id = `imp_${hashCode(f.uri)}${extOf(name)}`;
      if (known.has(id)) {
        result.skipped++;
        continue;
      }
      let fileUri = Fs.managedFileUri(id);
      if (!Fs.managedFileExists(id)) {
        try {
          fileUri = await Fs.copyIntoManagedStorage(f.uri, id);
        } catch {
          result.failed++;
          continue;
        }
      }
      const tags = await extractMetadata(fileUri, name);
      const song = buildSong(id, fileUri, name, 0, tags);
      await persistArtwork(song, tags?.artwork);
      await DB.upsertSongs([song]);
      known.add(id);
      result.added++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

async function persistArtwork(song: Song, artwork?: Uint8Array) {
  if (!artwork || artwork.length === 0) return;
  try {
    const name = `art_${hashCode(song.id)}.img`;
    const uri = await Fs.writeArtwork(artwork, name);
    if (uri) song.artwork = uri;
  } catch {
    /* ignore artwork errors */
  }
}

/** Build a deterministic neon gradient seed from a song. */
export function artworkSeed(song: Song): string {
  return `${song.album}|||${song.artist}|||${song.title}`;
}
