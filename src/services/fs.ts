import { Directory, File, Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';

/** Root managed music directory inside app storage. */
export function musicDirectory(): Directory {
  const dir = new Directory(Paths.document, 'muzix-music');
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }
  return dir;
}

export function artworkDirectory(): Directory {
  const dir = new Directory(Paths.document, 'muzix-art');
  if (!dir.exists) {
    dir.create({ idempotent: true, intermediates: true });
  }
  return dir;
}

/**
 * Copy an arbitrary source URI (file://, content:// or SAF) into muzix-managed storage.
 * Returns the resulting file:// uri of the managed copy.
 */
export async function copyIntoManagedStorage(
  sourceUri: string,
  targetName: string
): Promise<string> {
  const dir = musicDirectory();
  const dest = new File(dir, targetName);
  if (dest.exists) return dest.uri;
  // Use legacy copyAsync which supports content:// and SAF on Android.
  await LegacyFS.copyAsync({ from: sourceUri, to: dest.uri });
  return dest.uri;
}

export function managedFileUri(name: string): string {
  return new File(musicDirectory(), name).uri;
}

export function managedFileExists(name: string): boolean {
  return new File(musicDirectory(), name).exists;
}

/** Read a bounded slice (bytes) of a local file for metadata parsing. */
export async function readHead(fileUri: string, bytes = 768 * 1024): Promise<Uint8Array> {
  try {
    const f = new File(fileUri);
    if (!f.exists) return new Uint8Array(0);
    const size = f.size ?? 0;
    const buf = await f.slice(0, Math.min(bytes, size)).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return new Uint8Array(0);
  }
}

/** Read the final slice (bytes) of a local file (used for trailing moov atoms). */
export async function readTail(fileUri: string, bytes = 768 * 1024): Promise<Uint8Array> {
  try {
    const f = new File(fileUri);
    if (!f.exists) return new Uint8Array(0);
    const size = f.size ?? 0;
    if (size <= bytes) return readHead(fileUri, size);
    const buf = await f.slice(size - bytes, size).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return new Uint8Array(0);
  }
}

export async function writeArtwork(artData: Uint8Array, name: string): Promise<string | null> {
  try {
    const dir = artworkDirectory();
    const f = new File(dir, name);
    if (!f.exists) f.write(artData);
    return f.uri;
  } catch {
    return null;
  }
}

export async function clearManagedMusic() {
  const dir = musicDirectory();
  if (dir.exists) {
    for (const entry of dir.list()) {
      try {
        entry.delete();
      } catch {
        /* ignore */
      }
    }
  }
}

/** Read a bounded slice (bytes) of a local file for metadata parsing. */
export async function readHead(fileUri: string, bytes = 768 * 1024): Promise<Uint8Array> {
  try {
    const f = new File(fileUri);
    if (!f.exists) return new Uint8Array(0);
    const size = f.size ?? 0;
    const buf = await f.slice(0, Math.min(bytes, size)).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return new Uint8Array(0);
  }
}

/** Read the final slice (bytes) of a local file (used for trailing moov atoms). */
export async function readTail(fileUri: string, bytes = 768 * 1024): Promise<Uint8Array> {
  try {
    const f = new File(fileUri);
    if (!f.exists) return new Uint8Array(0);
    const size = f.size ?? 0;
    if (size <= bytes) return readHead(fileUri, size);
    const buf = await f.slice(size - bytes, size).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return new Uint8Array(0);
  }
}

export async function writeArtwork(artData: Uint8Array, name: string): Promise<string | null> {
  try {
    const dir = artworkDirectory();
    const f = new File(dir, name);
    if (!f.exists) f.write(artData);
    return f.uri;
  } catch {
    return null;
  }
}
