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
  IOSCategory,
  IOSCategoryMode,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import type { Song } from '@/types/music';

let setupStarted = false;
let ready = false;

export async function ensureSetup(): Promise<void> {
  if (ready) return;
  if (setupStarted) {
    while (!ready) {
      await new Promise((r) => setTimeout(r, 60));
    }
    return;
  }
  setupStarted = true;
  try {
    await TrackPlayer.setupPlayer({
      iosCategory: IOSCategory.Playback,
      iosCategoryMode: IOSCategoryMode.Default,
      autoHandleInterruptions: true,
    });
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.Stop,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      },
      progressUpdateEventInterval: 0.5,
    });
    ready = true;
  } catch (e) {
    ready = true;
    if (__DEV__) console.warn('[audio] setup error (ignored):', e);
  }
}

function toTrack(song: Song) {
  return {
    id: song.id,
    url: song.uri as string,
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
  await TrackPlayer.reset();
  if (tracks.length === 0) return;
  await TrackPlayer.add(tracks);
  const safe = Math.max(0, Math.min(index, tracks.length - 1));
  if (safe > 0) await TrackPlayer.skip(safe);
  await TrackPlayer.play();
}

export async function addToQueue(song: Song, play = false): Promise<void> {
  await ensureSetup();
  await TrackPlayer.add(toTrack(song));
  if (play) await TrackPlayer.play();
}

export async function playNext(song: Song): Promise<void> {
  await ensureSetup();
  const index = await TrackPlayer.getActiveTrackIndex();
  const at = typeof index === 'number' && index >= 0 ? index : 0;
  await TrackPlayer.add([toTrack(song)], at + 1);
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
  await TrackPlayer.skipToNext();
}

export async function previous(): Promise<void> {
  await ensureSetup();
  const pos = (await TrackPlayer.getProgress()).position;
  if (pos > 3) await TrackPlayer.seekTo(0);
  else await TrackPlayer.skipToPrevious();
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

export { TrackPlayer, State, RepeatMode };
