# 🎵 muzix — Offline Local Music Player

**Feel Every Beat.**

muzix is a premium, fully **offline** local music player for Android, built with
**Expo · React Native · TypeScript · Expo Router**. It scans the audio files on
your device, reads their tags and artwork, and plays them with **real background
playback**, a **real Android media notification**, lock-screen and headset/Bluetooth
controls.

> No Firebase. No backend. No internet required. No account. Your music stays on
> your device, always.

---

## ✨ 

| Area | Details |
|------|---------|
| **Offline-first** | Library, search, playback, playlists, favorites, queue and history all work with zero internet. |
| **Scans the whole device** | Discovers MP3, M4A/AAC, WAV, FLAC and OGG files across internal storage and SD card via the Android Media Store (`expo-media-library`). |
| **Import files** | Also lets you pick audio from any folder using the system document picker (`File.pickFileAsync`). |
| **Real metadata** | A pure-TypeScript parser reads ID3v2 (MP3), MP4 `ilst` (M4A/AAC), FLAC Vorbis and OGG tags — title, artist, album, genre, track number **and embedded artwork**. No extra native modules. |
| **Background audio** | `react-native-track-player` runs a headless playback service, so music keeps playing when the app is backgrounded or the screen is locked. |
| **Real media notification** | System media notification with artwork, title, artist and Previous / Play / Next controls; live updates on track & play-state change. |
| **Lock screen + Bluetooth** | Android MediaSession gives lock-screen controls and headset/Bluetooth play/pause/next/previous. |
| **Playlists & Favorites** | Create/rename/delete/reorder playlists, add/remove songs, liked-songs, favorites persisted locally. |
| **Queue** | Now playing + up-next, remove from queue, play-next, add-to-queue. |
| **Search** | Songs, artists, albums, playlists and genres — 100% local; recent searches + locally-computed trending. |
| **Neon UI** | Matches the reference: near-black backgrounds, neon purple/pink/magenta/red, glassmorphism cards, neon borders, glows and smooth animations. Icon-only (no emojis), with the **"developed by praveen"** watermark. |
| **Screens** | Splash, onboarding, Home, Search, Library, Profile, Now Playing, Queue, Equalizer, Settings, Notifications, Playlist/Album/Artist, Import, Add-to-Playlist. |

---

## 🧱 Tech Stack

- **Expo SDK 57** (React Native 0.86, React 19)
- **Expo Router** (file-based navigation)
- **TypeScript** (strict)
- **react-native-track-player** — background audio + Android MediaSession/notification
- **expo-sqlite** — persistent local database (SQLite, WAL)
- **expo-media-library** — device audio scanning + permissions
- **expo-file-system** — managed file storage, file picker, reading tags
- **@expo/vector-icons (Ionicons)** — icon-only UI
- **zustand** — lightweight global state
- **expo-linear-gradient / @react-native-community/slider / expo-haptics** — neon UI, sliders, haptics

---

## 📁 Project Structure

```
muzix/
├─ app.json                  # Expo config: icons, splash, permissions, plugins
├─ eas.json                  # EAS Build profiles (dev / preview / production)
├─ package.json
├─ tsconfig.json
├─ README.md
├─ assets/
│  ├─ icon.png               # 1024px app icon (derived from the supplied logo)
│  ├─ adaptive-icon.png
│  ├─ splash-icon.png
│  └─ favicon.png
└─ src/
   ├─ app/                   # Expo Router screens
   │  ├─ _layout.tsx         # root: splash gate, stack, playback service
   │  ├─ index.tsx           # redirect (onboarding ↔ tabs)
   │  ├─ onboarding.tsx
   │  ├─ (tabs)/             # Home · Search · Library · Profile
   │  ├─ player.tsx          # Now Playing
   │  ├─ queue.tsx
   │  ├─ equalizer.tsx
   │  ├─ settings.tsx
   │  ├─ notifications.tsx
   │  ├─ liked-songs.tsx
   │  ├─ import-songs.tsx
   │  ├─ add-to-playlist.tsx
   │  ├─ playlist/[id].tsx   # album/[id].tsx · artist/[id].tsx
   ├─ components/            # Neon UI kit (Icon, Artwork, MiniPlayer, …)
   ├─ constants/theme.ts     # Design system (colors, gradients, spacing)
   ├─ services/
   │  ├─ audio.ts            # track-player engine + controls
   │  ├─ playbackService.ts  # headless background service (remote controls)
   │  ├─ database.ts         # SQLite schema + queries
   │  ├─ scanner.ts          # Media Store scan + file import
   │  ├─ metadata.ts         # pure-TS tag + artwork parser
   │  └─ fs.ts               # managed file storage helpers
   ├─ store/musicStore.ts    # zustand store (state + actions)
   └─ types/music.ts         # domain types
```

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
cd muzix
npm install
```

### 2. Run in development

```bash
npm start            # start Metro
# then press "a" for Android (Expo Go), or "r" to reload
```

> ⚠️ **Important:** `react-native-track-player` provides **real** background audio and
> media notification controls. Those native features do **not** run in **Expo Go**.
> For full functionality (background playback, lock screen, notification controls)
> use a **development build** (next step). The UI and basic flow still work in Expo Go.

### 3. Create an Android development build

```bash
npx expo prebuild --platform android   # generates the native android/ project
npx expo run:android                    # compiles & installs the dev build on a connected device
```

Or with EAS:

```bash
eas build --profile development --platform android
```

Then install the built `.apk` on your device and start Metro with
`npx expo start --dev-client`.

---

## 📱 Building an installable APK / AAB with EAS (cloud)

EAS Build compiles the native Android project for you (no local Android SDK needed).
This is the simplest way to get a testable `.apk`.

```bash
# 1. Log in (create a free Expo account if needed)
eas login

# 2. Configure the project (registers the app id on EAS)
eas init

# 3. Build an installable APK (internal testing / direct install)
eas build --profile preview --platform android

# 4. Build a release AAB (for Play Store upload)
eas build --profile production --platform android
```

After the build finishes, EAS prints a **download link** for the artifact. Install the
APK on your phone, grant the audio permission, and tap **Scan device** to load all the
music on your phone.

**Build profiles** (in `eas.json`):

| Profile | Output | Use |
|---------|--------|-----|
| `development` | debug APK | development build with dev client |
| `preview` | release APK | **installable APK for testing** |
| `production` | release AAB | Play Store |

---

## ⚙️ Android Configuration

Configuration lives in `app.json`:

- **Package id:** `com.praveen.muzix` (`android.package`)
- **Permissions** (`android.permissions`):
  - `READ_MEDIA_AUDIO` — read the device music library (Android 13+)
  - `READ_EXTERNAL_STORAGE` — legacy media read (Android ≤ 12)
  - `POST_NOTIFICATIONS` — show the playback notification (Android 13+)
- **Icons:** `icon.png` (legacy), `adaptive-icon.png` (adaptive foreground on a `#05030A` background)
- **Splash:** dark background + centered logo via the `expo-splash-screen` plugin
- **Build properties** (`expo-build-properties`): `minSdkVersion: 24`, `targetSdkVersion: 35`, `usesCleartextTraffic: true`
- **Database:** `expo-sqlite` (autolinked)
- **Media library:** configured for **audio-only** granular permissions

### Changing the app id

```jsonc
// app.json
"android": { "package": "com.yourcompany.muzix" }
```

---

## 🎧 How Background Playback Works

1. `src/services/audio.ts` sets up `TrackPlayer` with playback capabilities
   (`Play`, `Pause`, `SkipToNext`, `SkipToPrevious`, `SeekTo`, `JumpForward`,
   `JumpBackward`, `Stop`) and a `progressUpdateEventInterval` of 0.5 s.
2. `src/app/_layout.tsx` registers the **playback service** at module load:
   ```ts
   TrackPlayer.registerPlaybackService(() => require('@/services/playbackService'));
   ```
3. `src/services/playbackService.ts` runs in a **headless JS context** (independent of
   the React tree). It listens for remote commands (`RemotePlay`, `RemotePause`,
   `RemoteNext`, `RemotePrevious`, `RemoteSeek`, `RemoteJumpForward`,
   `RemoteJumpBackward`, `RemoteDuck`) and drives `TrackPlayer`.
4. Because the service lives outside the UI, playback **continues** when the app is
   minimized, another app opens, or the screen locks.

---

## 🔔 How the Media Notification Works

- `react-native-track-player` posts a real **Android media notification**
  automatically from the active track's metadata (title, artist, artwork).
- It updates whenever the track changes, play/pause toggles, or artwork changes.
- The notification shows **Previous / Play / Pause / Next** controls and works in the
  background and on the lock screen.
- It is **not** a fake in-app notification and does **not** use Firebase/remote push.
- **Bluetooth / headset controls** work through the same Android MediaSession that
  `react-native-track-player` exposes.

---

## 🗄️ Storage & Database

- **SQLite** (`expo-sqlite`, WAL mode) stores: songs, favorites, playlists,
  playlist-song ordering, recent plays, search history, settings, equalizer
  settings and in-app notifications.
- **Managed files** (`expo-file-system`) are copied into app storage so playback and
  tag reading are reliable. Embedded artwork is extracted to `muzix-art/`.
- Scanning is **incremental**: already-imported files are skipped by ID, so
  re-scanning a large library is fast and duplicate-safe.

---

## 📥 Importing Music

Two ways:

1. **Scan device** (`Settings → Storage → Rescan library`, or `Add Music → Scan device`)
   — uses `expo-media-library` to enumerate **all audio on the device**.
2. **Import files** (`Add Music → Add Music`) — opens the system file picker to select
   one or many audio files.

Unsupported formats are skipped gracefully; corrupted files are reported, never crash
the app. If permission is denied, the app shows a helpful empty state with a
"Grant Permission" button instead of crashing.

---

## 🧹 Cleaning up

```bash
rm -rf node_modules package-lock.json
npm install
```

To regenerate native projects: `npx expo prebuild --clean`.

---

## ✅ Required Permissions

| Permission | Why |
|------------|-----|
| `READ_MEDIA_AUDIO` | Find and read audio files on your device (Android 13+). |
| `READ_EXTERNAL_STORAGE` | Find audio files on older Android (≤ 12). |
| `POST_NOTIFICATIONS` | Show the real playback notification (Android 13+). |

The app explains each permission before asking and never crashes if denied.

---

## ⚠️ Known Limitations

- **Expo Go** cannot run the native media notification / background audio. Use a
  **development build** or EAS APK for those features.
- **Equalizer:** the current background audio engine (`react-native-track-player`)
  does not expose a system-level DSP equalizer. The Equalizer screen saves the UI
  settings and provides a native-integration point, but does not alter the audio.
  A future native audio stack can plug into `saveEqualizer` without rewriting the UI.
- **Artwork:** a neon gradient is shown when a file has no embedded cover art. Files
  with embedded art (APIC / `covr` / FLAC picture) display it.
- **iOS:** `react-native-track-player` is configured for iOS too, but this project is
  primarily targeting **Android**.
- Building requires the **New Architecture** (default in SDK 57); `react-native-track-player`
  works through RN's New-Architecture interop layer.
- muzix keeps its own managed copy of each imported file in app storage, so playback
  continues even if the original is moved or renamed.

---

## 🛠 Troubleshooting

- **`npx expo prebuild` / `eas build` fails on `react-native-track-player` new arch:** it
  works via RN's New-Architecture interop layer; ensure you're not also mixing in other
  legacy-only native modules.
- **No sound / no notification in Expo Go:** expected — build a dev/APK build.
- **"No music yet":** grant media permission and use *Scan device* / *Add Music*.
- **Large libraries are slow on first scan:** it copies files into app storage once; a
  later rescan skips already-imported files.

---

## 📄 License

MIT — free to use and modify. Developed by Praveen.
