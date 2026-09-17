/**
 * Background playback service for react-native-track-player.
 *
 * Runs in a headless JS context (separate from the React UI) so playback
 * continues when the app is backgrounded, the screen is locked, or the UI is
 * unmounted. Handles remote commands (headset / lock screen / notification /
 * Bluetooth) and keeps the system media notification in sync.
 *
 * Must stay free of React component imports.
 */
import TrackPlayer, { Event, State } from 'react-native-track-player';
import { useMusicStore } from '@/store/musicStore';
import { buildMediaOptions } from '@/services/audio';

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Rebuilds the media notification after a play/pause transition so its
 * play/pause button reflects the current playWhenReady state. RNTP 4.1.2 bakes
 * that state into the button when the notification is built; without a refresh
 * the button can stay one toggle behind, which is what makes the first tap a
 * no-op and forces a second tap. Debounced so a state burst can't spam updates.
 */
function scheduleNotificationRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    TrackPlayer.updateOptions(buildMediaOptions()).catch(() => {
      // Refresh is best-effort; playback must never break over it.
    });
  }, 300);
}

async function actOnRemotePlay() {
  try {
    const { state } = await TrackPlayer.getPlaybackState();
    if (state !== State.Playing && state !== State.Buffering) {
      await TrackPlayer.play();
    }
  } catch {
    TrackPlayer.play();
  }
  scheduleNotificationRefresh();
}

async function actOnRemotePause() {
  try {
    const { state } = await TrackPlayer.getPlaybackState();
    if (state === State.Playing || state === State.Buffering) {
      await TrackPlayer.pause();
    }
  } catch {
    TrackPlayer.pause();
  }
  scheduleNotificationRefresh();
}

module.exports = async function () {
  try {
    TrackPlayer.addEventListener(Event.RemotePlay, actOnRemotePlay);

    TrackPlayer.addEventListener(Event.RemotePause, actOnRemotePause);

    TrackPlayer.addEventListener(Event.PlaybackPlayWhenReadyChanged, () => {
      scheduleNotificationRefresh();
    });

    TrackPlayer.addEventListener(Event.RemoteStop, () => {
      TrackPlayer.pause();
      scheduleNotificationRefresh();
    });

    TrackPlayer.addEventListener(Event.RemoteNext, () => {
      // Route through the store so shuffle/repeat are honoured on the
      // notification and lock-screen "next" instead of the raw queue order.
      try {
        useMusicStore.getState().next();
      } catch {
        TrackPlayer.skipToNext();
      }
    });

    TrackPlayer.addEventListener(Event.RemotePrevious, () => {
      try {
        useMusicStore.getState().previous();
      } catch {
        TrackPlayer.skipToPrevious();
      }
    });

    TrackPlayer.addEventListener(Event.RemoteSeek, (event: any) => {
      if (typeof event.position === 'number') TrackPlayer.seekTo(event.position);
    });

    TrackPlayer.addEventListener(Event.RemoteJumpForward, () => {
      // Legacy: the 15-second jump slot no longer appears in the notification.
      // If a headset/Bluetooth still sends it, treat it as a Like toggle.
      const s = useMusicStore.getState();
      const id = s.activeSong?.id;
      if (id) {
        s.toggleFavorite(id).catch(() => {
          // A DB hiccup must never break playback.
        });
      }
    });

    TrackPlayer.addEventListener(Event.RemoteJumpBackward, () => {
      // Legacy: same as above — shuffle toggle when the slot is triggered.
      const s = useMusicStore.getState();
      s.setShuffle(!s.shuffle);
    });

    TrackPlayer.addEventListener(Event.RemoteDuck, async (event: any) => {
      if (event.paused) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
      scheduleNotificationRefresh();
    });
  } catch (err) {
    if (__DEV__) {
      // The service is only called after setup succeeds; ignore early events.
    }
  }
};
