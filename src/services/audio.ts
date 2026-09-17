/**
 * Background-capable audio engine built on react-native-track-player.
 *
 * This drives Android MediaSession, the real system media notification,
 * lock-screen controls and Bluetooth/headset controls. It keeps playing when the
 * app is backgrounded or the screen is locked because the playback service
 * (playbackService.ts) runs in a headless context independent of the React tree.
 */
import TrackPlayer, {
  Capability,
  RepeatMode,
  State,
  Event,
  IOSCategory,
  IOSCategoryMode,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import type { Song } from '@/types/music';

const SETUP_TIMEOUT_MS = 6000;

/**
 * Full playback options for the system media notification. The 15-second jump
 * slots (JumpForward/JumpBackward) and the Stop (square) button are left out —
 * react-native-track-player 4.1.2 renders every notification action icon as a
 * monochrome silhouette and exposes no custom-action API, so the panel only
 * shows the native vector icons: previous / play / pause / next.
 */
export const MEDIA_CAPABILITIES: Capability[] = [
  Capability.Play,
  Capability.Pause,
  Capability.SkipToNext,
  Capability.SkipToPrevious,
  Capability.SeekTo,
];

export const MEDIA_COMPACT_CAPABILITIES: Capability[] = [
  Capability.SkipToPrevious,
  Capability.Play,
  Capability.Pause,
  Capability.SkipToNext,
];

export function buildMediaOptions(compactCapabilities: Capability[] = MEDIA_COMPACT_CAPABILITIES) {
  return {
    capabilities: MEDIA_CAPABILITIES,
    compactCapabilities,
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
    },
  };
}

let setupStarted = false;
let ready = false;

/** Resolves with the promise result, or rejects after `ms` if it never settles. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
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

export async function ensureSetup(): Promise<void> {
  if (ready) return;
  if (setupStarted) {
    // Bounded wait so a stuck setup can never block callers forever.
    let waited = 0;
    while (!ready && waited < SETUP_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 60));
      waited += 60;
    }
    return;
  }
  setupStarted = true;
  try {
    await withTimeout(
      TrackPlayer.setupPlayer({
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.Default,
        autoHandleInterruptions: true,
      }),
      SETUP_TIMEOUT_MS
    );
    await withTimeout(
      TrackPlayer.updateOptions(buildMediaOptions()),
      SETUP_TIMEOUT_MS
    );
    ready = true;
  } catch (e) {
    ready = true;
    if (__DEV__) console.warn('[audio] setup error (ignored):', e);
  }
}

function toTrack(song: Song) {
  const isYtRemote = song.uri?.startsWith('http') && (song.uri?.includes('googlevideo.com') || song.uri?.includes('youtube.com'));
  return {
    id: song.id,
    url: song.uri as string,
    ...(isYtRemote
      ? {
          headers: {
            'User-Agent':
              'com.google.ios.youtube/20.05.5 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
            'Connection': 'keep-alive',
            'Accept-Encoding': 'identity',
          },
        }
      : {}),
    title: song.title,
    artist: song.artist,
    album: song.album,
    artwork: song.artwork || undefined,
    duration: song.duration || undefined,
  };
}

export async function playSongs(songs: Song[], index: number): Promise<void> {
  await ensureSetup();
  const tracks = songs.map(toTrack);
  const safe = Math.max(0, Math.min(index, tracks.length - 1));
  console.log('[audio] Playing:', JSON.stringify({ url: tracks[safe]?.url?.substring(0, 100), title: tracks[safe]?.title }));
  // Reorder so the target track sits at index 0. Adding it first means the
  // active-track event fires for the intended song instead of flashing the
  // first song in the library while we `skip()` into position.
  const reordered = [tracks[safe], ...tracks.slice(0, safe), ...tracks.slice(safe + 1)];
  await TrackPlayer.reset();
  if (reordered.length === 0) return;
  await TrackPlayer.add(reordered);
  await TrackPlayer.play();
}

export async function skipTo(index: number): Promise<void> {
  await ensureSetup();
  await TrackPlayer.skip(index);
}

export async function addToQueue(song: Song, play = false): Promise<void> {
  await ensureSetup();
  await TrackPlayer.add(toTrack(song));
  if (play) await TrackPlayer.play();
}

export async function playNext(song: Song, atIndex: number): Promise<void> {
  await ensureSetup();
  let count = 0;
  try {
    count = (await TrackPlayer.getQueue()).length;
  } catch {
    // Queue may be empty; the add below creates it.
  }
  const at = Math.max(0, Math.min(atIndex, count));
  await TrackPlayer.add([toTrack(song)], at);
}

export async function removeFromQueue(index: number): Promise<void> {
  await ensureSetup();
  try {
    await TrackPlayer.remove(index);
  } catch {
    // Best effort — the store queue is already updated.
  }
}

export async function moveInQueue(from: number, to: number): Promise<void> {
  await ensureSetup();
  try {
    if (from === to) return;
    await TrackPlayer.move(from, to);
  } catch {
    // Best effort — reorder only affects the store if the native sync fails.
  }
}

export async function togglePlay(): Promise<void> {
  await ensureSetup();
  const state = await TrackPlayer.getPlaybackState();
  if (state.state === State.Playing) await TrackPlayer.pause();
  else await TrackPlayer.play();
}

export async function pausePlayback(): Promise<void> {
  await ensureSetup();
  await TrackPlayer.pause();
}

export async function next(): Promise<void> {
  await ensureSetup();
  try {
    const index = await TrackPlayer.getActiveTrackIndex();
    const nextIndex = typeof index === 'number' && index >= 0 ? index + 1 : 0;
    await TrackPlayer.skip(nextIndex);
  } catch {
    // At end of the queue with repeat off — just stay put.
  }
}

export async function previous(): Promise<void> {
  await ensureSetup();
  const pos = (await TrackPlayer.getProgress()).position;
  if (pos > 3) {
    await TrackPlayer.seekTo(0);
    return;
  }
  try {
    const index = await TrackPlayer.getActiveTrackIndex();
    if (typeof index === 'number' && index > 0) await TrackPlayer.skip(index - 1);
  } catch {
    // No previous track — seek to the start.
  }
}

export async function seekTo(seconds: number): Promise<void> {
  await ensureSetup();
  await TrackPlayer.seekTo(seconds);
}

export async function jump(seconds: number): Promise<void> {
  await ensureSetup();
  await TrackPlayer.seekBy(seconds);
}

export async function setRate(rate: number): Promise<void> {
  await ensureSetup();
  await TrackPlayer.setRate(rate);
}

export async function setRepeatMode(mode: RepeatMode): Promise<void> {
  await ensureSetup();
  await TrackPlayer.setRepeatMode(mode);
}

export async function getActiveTrack(): Promise<Song | null> {
  try {
    const track = await TrackPlayer.getActiveTrack();
    return track ? (track as unknown as Song) : null;
  } catch {
    return null;
  }
}

export async function getProgress(): Promise<{ position: number; duration: number }> {
  try {
    const p = await TrackPlayer.getProgress();
    return { position: p.position, duration: p.duration };
  } catch {
    return { position: 0, duration: 0 };
  }
}

export async function getState(): Promise<State> {
  try {
    return (await TrackPlayer.getPlaybackState()).state;
  } catch {
    return State.None;
  }
}

export { TrackPlayer, State, RepeatMode, Event };
