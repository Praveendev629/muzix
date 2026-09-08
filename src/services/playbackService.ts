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
import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function () {
  try {
    TrackPlayer.addEventListener(Event.RemotePlay, () => {
      TrackPlayer.play();
    });

    TrackPlayer.addEventListener(Event.RemotePause, () => {
      TrackPlayer.pause();
    });

    TrackPlayer.addEventListener(Event.RemoteStop, () => {
      TrackPlayer.pause();
    });

    TrackPlayer.addEventListener(Event.RemoteNext, () => {
      TrackPlayer.skipToNext();
    });

    TrackPlayer.addEventListener(Event.RemotePrevious, () => {
      TrackPlayer.skipToPrevious();
    });

    TrackPlayer.addEventListener(Event.RemoteSeek, (event: any) => {
      if (typeof event.position === 'number') TrackPlayer.seekTo(event.position);
    });

    TrackPlayer.addEventListener(Event.RemoteJumpForward, () => {
      TrackPlayer.seekBy(15);
    });

    TrackPlayer.addEventListener(Event.RemoteJumpBackward, () => {
      TrackPlayer.seekBy(-15);
    });

    TrackPlayer.addEventListener(Event.RemoteDuck, async (event: any) => {
      if (event.paused) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    });
  } catch (err) {
    if (__DEV__) {
      // The service is only called after setup succeeds; ignore early events.
    }
  }
};
