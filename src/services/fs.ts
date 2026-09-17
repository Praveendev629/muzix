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

/* ---------------- Reading bytes from content:// and file:// URIs --------------- */

function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Read the whole content provider file via the new expo-file-system API
 * (ContentProviderFile), which supports generic content:// URIs such as
 * MediaStore audio. The legacy readAsStringAsync only accepts SAF
 * ("content://com.android.externalstorage...") URIs and throws
 * "Unsupported scheme" for MediaStore URIs. Files larger than the cap are
 * returned as null so we never allocate a huge buffer just for tags.
 */
async function readWholeContent(uri: string, capBytes = 64 * 1024 * 1024): Promise<Uint8Array | null> {
  try {
    const f = new File(uri);
    const size = f.size;
    if (size != null && size > capBytes) return null;
    const bytes = await f.bytes();
    return bytes ?? null;
  } catch {
    return null;
  }
}

async function legacyReadBase64(
  uri: string,
  opts?: { position?: number; length?: number }
): Promise<Uint8Array | null> {
  try {
    const b64 = await (LegacyFS as any).readAsStringAsync(uri, {
      encoding: (LegacyFS as any).EncodingType.Base64,
      ...opts,
    });
    if (!b64) return null;
    if (b64.length > 4 * 1024 * 1024) {
      // Bound memory: only keep the leading bytes.
      return base64ToBytes(b64.slice(0, Math.ceil((opts?.length ?? 2 * 1024 * 1024) * 4 / 3)));
    }
    return base64ToBytes(b64);
  } catch {
    return null;
  }
}

/**
 * Read a bounded chunk from the start of a file:// or content:// URI.
 * Used to parse tags + embedded artwork without loading whole files.
 */
export async function readBytesFromUri(uri: string, maxBytes = 2 * 1024 * 1024): Promise<Uint8Array | null> {
  if (uri.startsWith('file://')) return readHead(uri, maxBytes);
  const whole = await readWholeContent(uri);
  if (!whole) return null;
  return whole.length <= maxBytes ? whole : whole.subarray(0, maxBytes);
}

/** Read a bounded chunk starting at `position` in a file:// or content:// URI. */
export async function readBytesRangeFromUri(
  uri: string,
  position: number,
  length: number
): Promise<Uint8Array | null> {
  if (uri.startsWith('file://')) {
    try {
      const f = new File(uri);
      if (!f.exists) return null;
      const size = f.size ?? 0;
      if (size <= 0) return null;
      return new Uint8Array(await f.slice(position, Math.min(position + length, size)).arrayBuffer());
    } catch {
      return null;
    }
  }
  const whole = await readWholeContent(uri);
  if (!whole || position >= whole.length) return null;
  return whole.subarray(position, Math.min(position + length, whole.length));
}

/** File size in bytes for a file:// or content:// URI, or null if unknown. */
export async function sizeOfUri(uri: string): Promise<number | null> {
  try {
    if (uri.startsWith('file://')) {
      const f = new File(uri);
      return f.exists ? (f.size ?? null) : null;
    }
    const info = await (LegacyFS as any).getInfoAsync(uri);
    return info && info.exists ? (info.size ?? null) : null;
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


