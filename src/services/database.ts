import * as SQLite from 'expo-sqlite';
import type { AppSettings, EqPreset, EqualizerSettings, LyricsSnapshot, Playlist, Song } from '@/types/music';

let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  // Single-flight open so concurrent callers cannot race on the share.
  if (!opening) {
    opening = SQLite.openDatabaseAsync('muzix.db', { useNewConnection: true }).then(async (d) => {
      await init(d);
      return d;
    });
  }
  try {
    db = await opening;
  } finally {
    opening = null;
  }
  if (!db) throw new Error('database unavailable');
  return db;
}

/**
 * expo-sqlite (SDK 57) caches NativeDatabase connections by database name and
 * keeps returning the cached handle even after it has been closed, so once a
 * handle dies (intermittent NullPointerException from prepareAsync/execAsync)
 * every subsequent operation on that name would fail forever — including
 * "fresh" connections opened without { useNewConnection: true }. Any operation
 * that rejects is therefore retried against a freshly-opened connection, which
 * genuinely recovers instead of reusing the dead cached handle.
 */
export async function withRetry<T>(
  task: (d: SQLite.SQLiteDatabase) => Promise<T>,
  attempt = 0
): Promise<T> {
  try {
    const d = await getDb();
    return await task(d);
  } catch (e) {
    if (attempt === 0) {
      try {
        await db?.closeAsync();
      } catch {
        // The old handle may already be dead; ignore.
      }
      db = null;
      return withRetry(task, 1);
    }
    throw e;
  }
}

async function init(d: SQLite.SQLiteDatabase) {
  await d.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT NOT NULL,
      album_artist TEXT,
      genre TEXT,
      duration REAL NOT NULL DEFAULT 0,
      track_number INTEGER,
      uri TEXT NOT NULL,
      artwork TEXT,
      file_name TEXT,
      added_at INTEGER NOT NULL,
      play_count INTEGER NOT NULL DEFAULT 0,
      last_played INTEGER
    );

    CREATE TABLE IF NOT EXISTS favorites (
      song_id TEXT PRIMARY KEY,
      added_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      artwork TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlist_id TEXT NOT NULL,
      song_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (playlist_id, song_id)
    );

    CREATE TABLE IF NOT EXISTS recent (
      song_id TEXT NOT NULL,
      played_at INTEGER NOT NULL,
      PRIMARY KEY (song_id, played_at)
    );

    CREATE TABLE IF NOT EXISTS search_history (
      query TEXT PRIMARY KEY,
      at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lyrics (
      song_id TEXT PRIMARY KEY,
      synced TEXT,
      plain TEXT,
      source TEXT NOT NULL DEFAULT '',
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lyric_offsets (
      song_id TEXT PRIMARY KEY,
      offset REAL NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
    CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
    CREATE INDEX IF NOT EXISTS idx_recent_time ON recent(played_at);
  `);

  await ensureColumns(d);
}

/**
 * Older installs may have tables created before columns were added to the
 * schema (e.g. last_played, play_count). SQLite's "IF NOT EXISTS" won't add
 * those columns, so queries that reference them throw "no such column".
 * Backfill any missing columns so pre-existing databases keep working.
 */
async function ensureColumns(d: SQLite.SQLiteDatabase) {
  await ensureColumn(d, 'songs', 'play_count', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(d, 'songs', 'last_played', 'INTEGER');
  await ensureColumn(d, 'songs', 'album_artist', 'TEXT');
  await ensureColumn(d, 'songs', 'genre', 'TEXT');
  await ensureColumn(d, 'songs', 'duration', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn(d, 'songs', 'track_number', 'INTEGER');
  await ensureColumn(d, 'songs', 'uri', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(d, 'songs', 'artwork', 'TEXT');
  await ensureColumn(d, 'songs', 'file_name', 'TEXT');
  await ensureColumn(d, 'songs', 'added_at', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(d, 'playlists', 'description', 'TEXT');
  await ensureColumn(d, 'playlists', 'artwork', 'TEXT');
  await ensureColumn(d, 'playlists', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
}

async function ensureColumn(
  d: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  ddl: string
) {
  try {
    const cols = await d.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === column)) {
      await d.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  } catch {
    // Column already present or table missing — either way nothing to do.
  }
}

/* ----------------------------- Songs ----------------------------- */

function mapSong(row: any): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    albumArtist: row.album_artist ?? undefined,
    genre: row.genre ?? undefined,
    duration: row.duration ?? 0,
    trackNumber: row.track_number ?? undefined,
    uri: row.uri,
    artwork: row.artwork ?? null,
    fileName: row.file_name ?? undefined,
    addedAt: row.added_at,
    playCount: row.play_count ?? 0,
    lastPlayed: row.last_played ?? undefined,
    isFavorite: false,
  };
}

export async function getAllSongs(): Promise<Song[]> {
  const d = await getDb();
  const favs = new Set(
    (await d.getAllAsync<{ song_id: string }>('SELECT song_id FROM favorites')).map((r) => r.song_id)
  );
  const rows = await d.getAllAsync<any>('SELECT * FROM songs ORDER BY title COLLATE NOCASE ASC');
  return rows.map((r) => ({ ...mapSong(r), isFavorite: favs.has(r.id) }));
}

export async function upsertSongs(songs: Song[]) {
  await withRetry(async (d) => {
    for (const s of songs) {
      await d.runAsync(
        `INSERT INTO songs (id, title, artist, album, album_artist, genre, duration, track_number, uri, artwork, file_name, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, artist=excluded.artist, album=excluded.album,
           album_artist=excluded.album_artist, genre=excluded.genre, duration=excluded.duration,
           track_number=excluded.track_number, uri=excluded.uri, artwork=excluded.artwork,
           file_name=excluded.file_name`,
        s.id,
        s.title,
        s.artist,
        s.album,
        s.albumArtist ?? null,
        s.genre ?? null,
        s.duration,
        s.trackNumber ?? null,
        s.uri,
        s.artwork ?? null,
        s.fileName ?? null,
        s.addedAt
      );
    }
  });
}

export async function deleteSongs(ids: string[]) {
  await withRetry(async (d) => {
    for (const id of ids) {
      await d.runAsync('DELETE FROM songs WHERE id = ?', id);
      await d.runAsync('DELETE FROM favorites WHERE song_id = ?', id);
      await d.runAsync('DELETE FROM playlist_songs WHERE song_id = ?', id);
    }
  });
}

export async function songCount(): Promise<number> {
  const d = await getDb();
  const r = await d.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM songs');
  return r?.c ?? 0;
}

/* --------------------------- Favorites --------------------------- */

export async function setFavorite(songId: string, fav: boolean) {
  await withRetry(async (d) => {
    if (fav) {
      await d.runAsync('INSERT OR IGNORE INTO favorites (song_id, added_at) VALUES (?, ?)', songId, Date.now());
    } else {
      await d.runAsync('DELETE FROM favorites WHERE song_id = ?', songId);
    }
  });
}

export async function getFavoriteIds(): Promise<Set<string>> {
  const d = await getDb();
  const rows = await d.getAllAsync<{ song_id: string }>('SELECT song_id FROM favorites');
  return new Set(rows.map((r) => r.song_id));
}

/* --------------------------- Playlists --------------------------- */

export async function getPlaylists(): Promise<Playlist[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<any>('SELECT * FROM playlists ORDER BY name COLLATE NOCASE ASC');
  const favs = await getFavoriteIds();
  const result: Playlist[] = [];
  for (const r of rows) {
    const items = await d.getAllAsync<{ song_id: string }>(
      'SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC',
      r.id
    );
    result.push({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      artwork: r.artwork ?? null,
      songIds: items.map((i) => i.song_id),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isFavorite: !!r.is_favorite,
    });
  }
  return result;
}

export async function createPlaylist(
  name: string,
  description?: string,
  songIds: string[] = [],
  id?: string
) {
  const finalId = id ?? `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await withRetry(async (d) => {
    const now = Date.now();
    await d.runAsync(
      'INSERT INTO playlists (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      finalId,
      name,
      description ?? null,
      now,
      now
    );
    for (let i = 0; i < songIds.length; i++) {
      await d.runAsync(
        'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
        finalId,
        songIds[i],
        i
      );
    }
  });
  return finalId;
}

export async function renamePlaylist(id: string, name: string) {
  await withRetry((d) => d.runAsync('UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?', name, Date.now(), id));
}

export async function deletePlaylist(id: string) {
  await withRetry(async (d) => {
    await d.runAsync('DELETE FROM playlists WHERE id = ?', id);
    await d.runAsync('DELETE FROM playlist_songs WHERE playlist_id = ?', id);
  });
}

export async function setPlaylistFavorite(id: string, fav: boolean) {
  await withRetry((d) =>
    d.runAsync('UPDATE playlists SET is_favorite = ?, updated_at = ? WHERE id = ?', fav ? 1 : 0, Date.now(), id)
  );
}

export async function addSongToPlaylist(playlistId: string, songId: string) {
  await withRetry(async (d) => {
    const pos = await d.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ?',
      playlistId
    );
    await d.runAsync(
      'INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
      playlistId,
      songId,
      pos?.c ?? 0
    );
    await d.runAsync('UPDATE playlists SET updated_at = ? WHERE id = ?', Date.now(), playlistId);
  });
}

export async function removeSongFromPlaylist(playlistId: string, songId: string) {
  await withRetry(async (d) => {
    await d.runAsync('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', playlistId, songId);
    await d.runAsync('UPDATE playlists SET updated_at = ? WHERE id = ?', Date.now(), playlistId);
  });
}

export async function reorderPlaylist(playlistId: string, orderedIds: string[]) {
  await withRetry(async (d) => {
    await d.runAsync('DELETE FROM playlist_songs WHERE playlist_id = ?', playlistId);
    for (let i = 0; i < orderedIds.length; i++) {
      await d.runAsync(
        'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
        playlistId,
        orderedIds[i],
        i
      );
    }
    await d.runAsync('UPDATE playlists SET updated_at = ? WHERE id = ?', Date.now(), playlistId);
  });
}

/* ---------------------- Recent / history ------------------------- */

export async function recordPlay(songId: string) {
  const now = Date.now();
  return withRetry(async (d) => {
    await d.runAsync('INSERT INTO recent (song_id, played_at) VALUES (?, ?)', songId, now);
    await d.runAsync('UPDATE songs SET play_count = play_count + 1, last_played = ? WHERE id = ?', now, songId);
  });
}

export async function getRecent(limit = 10000): Promise<string[]> {
  return withRetry(async (d) => {
    const rows = await d.getAllAsync<{ song_id: string }>(
      'SELECT song_id FROM recent GROUP BY song_id ORDER BY MAX(played_at) DESC LIMIT ?',
      limit
    );
    return rows.map((r) => r.song_id);
  });
}

export async function getMostPlayed(limit = 50): Promise<string[]> {
  return withRetry(async (d) => {
    const rows = await d.getAllAsync<{ song_id: string }>(
      'SELECT id AS song_id FROM songs ORDER BY play_count DESC, last_played DESC LIMIT ?',
      limit
    );
    return rows.map((r) => r.song_id);
  });
}

/* ---------------------- Lyrics (offline cache) ------------------------ */

export async function saveLyrics(songId: string, doc: LyricsSnapshot): Promise<void> {
  return withRetry(async (d) => {
    await d.runAsync(
      `INSERT INTO lyrics (song_id, synced, plain, source, fetched_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(song_id) DO UPDATE SET synced = excluded.synced, plain = excluded.plain, source = excluded.source, fetched_at = excluded.fetched_at`,
      songId,
      doc.synced,
      doc.plain,
      doc.source,
      Date.now()
    );
  });
}

export async function getAllLyrics(): Promise<Record<string, LyricsSnapshot>> {
  return withRetry(async (d) => {
    const rows = await d.getAllAsync<{ song_id: string; synced: string | null; plain: string | null; source: string }>(
      'SELECT song_id, synced, plain, source FROM lyrics'
    );
    const map: Record<string, LyricsSnapshot> = {};
    for (const r of rows) map[r.song_id] = { synced: r.synced, plain: r.plain, source: r.source };
    return map;
  });
}

/* ---------------- Lyric sync offsets (per song) ------------------ */

export async function getLyricOffsets(): Promise<Record<string, number>> {
  const d = await getDb();
  const rows = await d.getAllAsync<{ song_id: string; offset: number }>(
    'SELECT song_id, offset FROM lyric_offsets'
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.song_id] = r.offset;
  return map;
}

export async function saveLyricOffset(songId: string, offset: number) {
  await withRetry((d) =>
    d.runAsync(
      'INSERT OR REPLACE INTO lyric_offsets (song_id, offset) VALUES (?, ?)',
      songId,
      Math.round(offset * 100) / 100
    )
  );
}

export async function addSearchHistory(query: string) {
  const d = await getDb();
  await d.runAsync(
    'INSERT OR REPLACE INTO search_history (query, at) VALUES (?, ?)',
    query.toLowerCase().trim(),
    Date.now()
  );
}

export async function getSearchHistory(limit = 10): Promise<string[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<{ query: string }>(
    'SELECT query FROM search_history ORDER BY at DESC LIMIT ?',
    limit
  );
  return rows.map((r) => r.query);
}

export async function clearSearchHistory() {
  const d = await getDb();
  await d.runAsync('DELETE FROM search_history');
}

export async function removeSearchHistory(query: string) {
  const d = await getDb();
  await d.runAsync('DELETE FROM search_history WHERE query = ?', query.toLowerCase().trim());
}

/* --------------------------- Settings ---------------------------- */

const DEFAULT_SETTINGS: AppSettings = {
  name: 'Praveen',
  theme: 'dark',
  accent: 'purplePink',
  customTheme: null,
  customAccent: null,
  showNotifications: true,
  showArtwork: true,
  showMediaControls: true,
  lockScreenControls: true,
  resumePlayback: false,
  autoplay: true,
  skipDuration: 15,
  playbackSpeed: 1,
  crossfade: 0,
  gapless: false,
  onboardingDone: false,
  eqEnabled: false,
  eqPreset: 'Normal',
};

export async function getSettings(): Promise<AppSettings> {
  const d = await getDb();
  const rows = await d.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const data: Record<string, string> = {};
  rows.forEach((r) => (data[r.key] = r.value));
  const merged: any = { ...DEFAULT_SETTINGS, ...data };
  // Object-typed settings are stored as JSON strings; parse them back.
  for (const key of ['customTheme', 'customAccent']) {
    if (typeof merged[key] === 'string') {
      try {
        merged[key] = JSON.parse(merged[key]);
      } catch {
        merged[key] = null;
      }
    }
  }
  return merged as AppSettings;
}

export async function saveSettings(partial: Partial<AppSettings>) {
  const d = await getDb();
  for (const [k, v] of Object.entries(partial)) {
    const value = v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    await d.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      k,
      value
    );
  }
}

/* --------------------------- Equalizer --------------------------- */

const DEFAULT_EQ: EqualizerSettings = {
  enabled: false,
  preset: 'Normal',
  gains: [0, 0, 0, 0, 0],
  bassBoost: 0,
  virtualizer: false,
};

export async function getEqualizer(): Promise<EqualizerSettings> {
  const d = await getDb();
  const row = await d.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'eq_json'"
  );
  if (!row?.value) return DEFAULT_EQ;
  try {
    return { ...DEFAULT_EQ, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_EQ;
  }
}

export async function saveEqualizer(eq: EqualizerSettings) {
  const d = await getDb();
  await d.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('eq_json', ?)",
    JSON.stringify(eq)
  );
  await saveSettings({ eqEnabled: eq.enabled, eqPreset: eq.preset as EqPreset });
}

/* ------------------------- Notifications ------------------------- */

export async function addNotification(type: string, title: string, body: string) {
  const d = await getDb();
  const id = `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await d.runAsync(
    'INSERT INTO notifications (id, type, title, body, at) VALUES (?, ?, ?, ?, ?)',
    id,
    type,
    title,
    body,
    Date.now()
  );
}

export async function getNotifications(): Promise<any[]> {
  const d = await getDb();
  return d.getAllAsync<any>('SELECT * FROM notifications ORDER BY at DESC LIMIT 100');
}

export async function clearNotifications() {
  const d = await getDb();
  await d.runAsync('DELETE FROM notifications');
}

/* ----------------------------- Stats ----------------------------- */

export async function getStats(): Promise<{ songs: number; albums: number; artists: number }> {
  const d = await getDb();
  const songs = await d.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM songs');
  const albums = await d.getFirstAsync<{ c: number }>(
    'SELECT COUNT(DISTINCT album) as c FROM songs'
  );
  const artists = await d.getFirstAsync<{ c: number }>(
    'SELECT COUNT(DISTINCT artist) as c FROM songs'
  );
  return { songs: songs?.c ?? 0, albums: albums?.c ?? 0, artists: artists?.c ?? 0 };
}

export async function getTotalDuration(): Promise<number> {
  const d = await getDb();
  const r = await d.getFirstAsync<{ s: number }>('SELECT SUM(duration) as s FROM songs');
  return r?.s ?? 0;
}
