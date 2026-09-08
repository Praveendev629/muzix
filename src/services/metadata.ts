/**
 * Pure-TypeScript audio metadata extractor.
 *
 * Reads ID3v2 (MP3), MP4/ilst (M4A/AAC), FLAC Vorbis comments and OGG Vorbis
 * comments from raw bytes. No native dependencies are required, so this works
 * with the managed Expo toolchain without extra gradle configuration.
 *
 * Every parser is defensive: on any failure it returns null and the caller falls
 * back to filename-derived metadata.
 */

export interface ParsedTags {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  trackNumber?: number;
  artwork?: Uint8Array;
  artworkMime?: string;
}

function utf8(buf: Uint8Array, start: number, end: number): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf.subarray(start, end));
  } catch {
    return '';
  }
}

function latin1(buf: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i++) out += String.fromCharCode(buf[i] & 0xff);
  return out;
}

/** Decode an ID3 text payload given its encoding byte. */
function decodeId3Text(buf: Uint8Array, start: number, end: number): string {
  if (start >= end) return '';
  const enc = buf[start];
  const body = buf.subarray(start + 1, end);
  if (enc === 0) return latin1(body, 0, body.length).replace(/\u0000.*$/, '');
  if (enc === 3) return utf8(body, 0, body.length).replace(/\u0000.*$/, '').trim();
  if (enc === 1 || enc === 2) {
    let offset = 0;
    let little = false;
    if (body.length >= 2 && body[0] === 0xff && body[1] === 0xfe) {
      little = true;
      offset = 2;
    } else if (body.length >= 2 && body[0] === 0xfe && body[1] === 0xff) {
      little = false;
      offset = 2;
    } else if (enc === 1) {
      little = true;
    }
    const out: number[] = [];
    for (let i = offset; i + 1 < body.length; i += 2) {
      const code = little ? body[i] | (body[i + 1] << 8) : (body[i] << 8) | body[i + 1];
      if (code === 0) break;
      out.push(code);
    }
    try {
      return String.fromCharCode(...out);
    } catch {
      return '';
    }
  }
  return '';
}

function syncsafe(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] & 0x7f) << 21) |
    ((buf[offset + 1] & 0x7f) << 14) |
    ((buf[offset + 2] & 0x7f) << 7) |
    (buf[offset + 3] & 0x7f)
  );
}

function be32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] & 0xff) << 24) |
    ((buf[offset + 1] & 0xff) << 16) |
    ((buf[offset + 2] & 0xff) << 8) |
    (buf[offset + 3] & 0xff)
  );
}

/* ------------------------------- MP3 ID3v2 ------------------------------- */

export function parseId3v2(buf: Uint8Array): ParsedTags | null {
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return null;
  const major = buf[3];
  const sizeBytes = buf.subarray(6, 10);
  const size = major >= 4 ? syncsafe(sizeBytes, 0) : be32(sizeBytes, 0);
  if (size <= 0 || size > 16 * 1024 * 1024) return null;
  let p = 10;
  const end = Math.min(buf.length, 10 + size);
  const tags: ParsedTags = {};
  while (p + 10 <= end) {
    const id = latin1(buf, p, p + 4);
    const frameSize = major >= 4 ? syncsafe(buf, p + 4) : be32(buf, p + 4);
    p += 10;
    if (frameSize <= 0 || p + frameSize > end) break;
    if (id.startsWith('T')) {
      const val = decodeId3Text(buf, p, p + frameSize).trim();
      if (!val) {
        p += frameSize;
        continue;
      }
      if (id === 'TIT2' && !tags.title) tags.title = val;
      else if (id === 'TPE1' && !tags.artist) tags.artist = val;
      else if (id === 'TALB' && !tags.album) tags.album = val;
      else if (id === 'TPE2' && !tags.albumArtist) tags.albumArtist = val;
      else if (id === 'TCON' && !tags.genre) tags.genre = val.replace(/^\(\d+\)/, '');
      else if (id === 'TRCK') {
        const num = parseInt(val.split('/')[0], 10);
        if (!isNaN(num)) tags.trackNumber = num;
      }
    } else if (id === 'APIC') {
      const enc = buf[p];
      let q = p + 1;
      let mime = '';
      while (q < end && buf[q] !== 0) {
        mime += String.fromCharCode(buf[q]);
        q++;
      }
      q++; // null
      q++; // picture type
      const descBytes = enc === 0 ? 1 : enc === 3 ? 1 : 2;
      while (q < end) {
        let isNull = false;
        if (descBytes === 1) isNull = buf[q] === 0;
        else if (q + 1 < end) isNull = buf[q] === 0 && buf[q + 1] === 0;
        if (isNull) {
          q += descBytes;
          break;
        }
        q += descBytes;
      }
      if (q < end) {
        tags.artwork = buf.slice(q, Math.min(p + frameSize, end));
        tags.artworkMime = mime || 'image/jpeg';
      }
    }
    p += frameSize;
  }
  return tags;
}

/* ------------------------------ MP4 / ilst ------------------------------ */

interface Atom {
  type: string;
  start: number; // start of data (after header)
  size: number; // total atom size incl header
}

function parseAtoms(buf: Uint8Array, offset: number, limit: number): Atom[] {
  const atoms: Atom[] = [];
  let p = offset;
  while (p + 8 <= limit) {
    const size = be32(buf, p);
    const type = latin1(buf, p + 4, p + 8);
    if (size === 0) break; // extends to end; stop to be safe
    if (size < 8 || p + size > limit) break;
    atoms.push({ type, start: p + 8, size });
    p += size;
  }
  return atoms;
}

export function parseMp4(head: Uint8Array, tail: Uint8Array): ParsedTags | null {
  const search = (buf: Uint8Array): ParsedTags | null => {
    const top = parseAtoms(buf, 0, buf.length);
    const moov = top.find((a) => a.type === 'moov');
    if (!moov) return null;
    const moovChildren = parseAtoms(buf, moov.start, moov.start + moov.size);
    const udta = moovChildren.find((a) => a.type === 'udta');
    if (!udta) return null;
    const udtaChildren = parseAtoms(buf, udta.start, udta.start + udta.size);
    const meta = udtaChildren.find((a) => a.type === 'meta');
    if (!meta) return null;
    // meta atom has a 4-byte version/flags before children
    const ilst = parseAtoms(buf, meta.start + 4, meta.start + meta.size).find((a) => a.type === 'ilst');
    if (!ilst) return null;
    const children = parseAtoms(buf, ilst.start, ilst.start + ilst.size);
    const tags: ParsedTags = {};
    for (const child of children) {
      const dataAtoms = parseAtoms(buf, child.start, child.start + child.size);
      const data = dataAtoms.find((a) => a.type === 'data');
      if (!data) continue;
      const payloadStart = data.start + 8; // skip type + locale
      const payloadEnd = data.start + data.size;
      if (payloadEnd <= payloadStart) continue;
      const payload = buf.subarray(payloadStart, payloadEnd);
      if (child.type === '\u00A9nam' && !tags.title) tags.title = utf8(payload, 0, payload.length).trim();
      else if (child.type === '\u00A9ART' && !tags.artist) tags.artist = utf8(payload, 0, payload.length).trim();
      else if (child.type === 'aART' && !tags.albumArtist) tags.albumArtist = utf8(payload, 0, payload.length).trim();
      else if (child.type === '\u00A9alb' && !tags.album) tags.album = utf8(payload, 0, payload.length).trim();
      else if (child.type === '\u00A9gen' && !tags.genre) tags.genre = utf8(payload, 0, payload.length).trim();
      else if (child.type === 'trkn') {
        if (payload.length >= 6) tags.trackNumber = (payload[2] << 8) | payload[3];
      } else if (child.type === 'covr') {
        const jpeg = payload.length > 3 && payload[0] === 0xff && payload[1] === 0xd8;
        tags.artwork = payload.slice();
        tags.artworkMime = jpeg ? 'image/jpeg' : 'image/png';
      }
    }
    return tags;
  };
  const fromTail = search(tail);
  if (fromTail) return fromTail;
  return search(head);
}

/* -------------------------------- FLAC -------------------------------- */

function le32(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | ((buf[offset + 3] << 24) >>> 0);
}

export function parseFlac(buf: Uint8Array): ParsedTags | null {
  if (buf.length < 4 || latin1(buf, 0, 4) !== 'fLaC') return null;
  let p = 4;
  const tags: ParsedTags = {};
  let guard = 0;
  while (p + 4 <= buf.length && guard++ < 128) {
    const header = buf[p];
    const last = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const len = (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3];
    p += 4;
    if (p + len > buf.length) break;
    if (type === 4) {
      const c = parseVorbisComments(buf.subarray(p, p + len));
      if (c.title) tags.title = c.title;
      if (c.artist) tags.artist = c.artist;
      if (c.album) tags.album = c.album;
      if (c.albumArtist) tags.albumArtist = c.albumArtist;
      if (c.genre) tags.genre = c.genre;
      if (c.trackNumber) tags.trackNumber = c.trackNumber;
    } else if (type === 6) {
      const pic = parsePictureBlock(buf.subarray(p, p + len));
      if (pic) {
        tags.artwork = pic.data;
        tags.artworkMime = pic.mime;
      }
    }
    p += len;
    if (last) break;
  }
  return tags;
}

function parseVorbisComments(buf: Uint8Array): ParsedTags {
  const tags: ParsedTags = {};
  let p = 0;
  if (p + 4 > buf.length) return tags;
  const vendorLen = le32(buf, p);
  p += 4 + vendorLen;
  if (p + 4 > buf.length) return tags;
  const count = le32(buf, p);
  p += 4;
  for (let i = 0; i < count && p + 4 <= buf.length; i++) {
    const len = le32(buf, p);
    p += 4;
    if (p + len > buf.length) break;
    const entry = latin1(buf, p, p + len);
    const eq = entry.indexOf('=');
    if (eq > 0) {
      const key = entry.slice(0, eq).toUpperCase();
      const val = entry.slice(eq + 1);
      if (key === 'TITLE' && !tags.title) tags.title = val;
      else if (key === 'ARTIST' && !tags.artist) tags.artist = val;
      else if (key === 'ALBUM' && !tags.album) tags.album = val;
      else if (key === 'ALBUMARTIST' && !tags.albumArtist) tags.albumArtist = val;
      else if (key === 'GENRE' && !tags.genre) tags.genre = val;
      else if (key === 'TRACKNUMBER') {
        const n = parseInt(val.split('/')[0], 10);
        if (!isNaN(n)) tags.trackNumber = n;
      }
    }
    p += len;
  }
  return tags;
}

function parsePictureBlock(buf: Uint8Array): { data: Uint8Array; mime: string } | null {
  if (buf.length < 8) return null;
  let p = 4; // picture type
  const mimeLen = le32(buf, p);
  p += 4;
  if (p + mimeLen > buf.length) return null;
  const mime = latin1(buf, p, p + mimeLen);
  p += mimeLen;
  const descLen = le32(buf, p);
  p += 4 + descLen;
  if (p + 4 > buf.length) return null;
  p += 12; // width, height, depth, colors
  const dataLen = le32(buf, p);
  p += 4;
  if (p + dataLen > buf.length || dataLen <= 0) return null;
  return { data: buf.slice(p, p + dataLen), mime: mime || 'image/jpeg' };
}

/* -------------------------------- OGG -------------------------------- */

export function parseOgg(buf: Uint8Array): ParsedTags | null {
  // find 0x03 'vorbis' comment header then parse comments
  let idx = -1;
  for (let i = 0; i + 7 < buf.length; i++) {
    if (buf[i] === 0x03 && latin1(buf, i + 1, i + 7) === 'vorbis') {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;
  return parseVorbisComments(buf.subarray(idx + 7));
}

/* ------------------------------ Public API ------------------------------ */

const EXT = {
  mp3: '.mp3',
  m4a: '.m4a',
  aac: '.aac',
  m4b: '.m4b',
  mp4: '.mp4',
  flac: '.flac',
  ogg: '.ogg',
  oga: '.oga',
  wav: '.wav',
};

export function supportedExtension(name: string): boolean {
  const n = name.toLowerCase();
  return Object.values(EXT).some((e) => n.endsWith(e));
}

export function detectFormat(name: string): 'mp3' | 'm4a' | 'flac' | 'ogg' | 'wav' | 'unknown' {
  const n = name.toLowerCase();
  if (n.endsWith('.mp3')) return 'mp3';
  if (n.endsWith('.m4a') || n.endsWith('.m4b') || n.endsWith('.mp4') || n.endsWith('.aac')) return 'm4a';
  if (n.endsWith('.flac')) return 'flac';
  if (n.endsWith('.ogg') || n.endsWith('.oga')) return 'ogg';
  if (n.endsWith('.wav')) return 'wav';
  return 'unknown';
}

/**
 * Extract metadata from a local file path (must be file://).
 * Returns parsed tags, or null if nothing could be read.
 */
export async function extractMetadata(fileUri: string, fileName: string): Promise<ParsedTags | null> {
  const format = detectFormat(fileName);
  if (format === 'unknown') return null;
  try {
    const { readHead, readTail } = await import('./fs');
    const head = await readHead(fileUri);
    if (head.length === 0) return null;
    if (format === 'mp3') return parseId3v2(head);
    if (format === 'flac') return parseFlac(head);
    if (format === 'ogg') return parseOgg(head);
    if (format === 'm4a') {
      const tail = await readTail(fileUri);
      return parseMp4(head, tail);
    }
    return null;
  } catch {
    return null;
  }
}

/** Clean a tag string for display. */
export function cleanTag(value?: string): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  return v.replace(/\u0000/g, '').trim() || undefined;
}
