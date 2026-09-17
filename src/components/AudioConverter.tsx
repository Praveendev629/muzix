import React, { useCallback, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const SITE_URL = 'https://ytmp3pc.com/';

const INJECT_JS = `
  (function() {
    window.startConversion = function(ytUrl) {
      // Extract video ID
      var match = ytUrl.match(/(?:youtu\\.be\\/|v\\/|embed\\/|watch\\?v=|watch\\?.+&v=)([^#&?]{11})/);
      var videoId = match ? match[1] : null;
      if (!videoId) { send({ type: 'error', error: 'Invalid URL' }); return; }

      // Use the site's API directly via fetch
      fetch('/Co?v=' + videoId, {
        headers: { 'Accept': 'application/json' }
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.formats && data.formats.mp3) {
          send({ type: 'success', audioUrl: data.formats.mp3, title: data.title || '' });
        } else if (data && data.formats && data.formats.mp4) {
          send({ type: 'success', audioUrl: data.formats.mp4, title: data.title || '' });
        } else {
          send({ type: 'error', error: 'No download link' });
        }
      })
      .catch(function(e) {
        send({ type: 'error', error: e.message || 'Fetch failed' });
      });
    };

    function send(msg) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {}
    }
  })();
  true;
`;

export interface ConverterHandle {
  convert: (youtubeUrl: string) => Promise<{ audioUrl: string; title: string; cover: string } | null>;
}

interface Props {
  onReady?: () => void;
}

const AudioConverter = forwardRef<ConverterHandle, Props>(({ onReady }, ref) => {
  const webViewRef = useRef<WebView>(null);
  const pendingRef = useRef<{
    resolve: (val: { audioUrl: string; title: string; cover: string } | null) => void;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    convert: (youtubeUrl: string) => {
      return new Promise((resolve) => {
        pendingRef.current = { resolve };
        webViewRef.current?.injectJavaScript(
          'window.startConversion("' + youtubeUrl.replace(/"/g, '\\"') + '"); true;'
        );
      });
    },
  }));

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (pendingRef.current) {
        if (data.type === 'success') {
          pendingRef.current.resolve({ audioUrl: data.audioUrl, title: data.title || '', cover: '' });
        } else {
          console.warn('[converter] Error:', data.error);
          pendingRef.current.resolve(null);
        }
        pendingRef.current = null;
      }
    } catch {}
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: SITE_URL }}
        injectedJavaScript={INJECT_JS}
        onMessage={handleMessage}
        onLoad={() => onReady?.()}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: 1, height: 1, opacity: 0, position: 'absolute', top: -9999 },
  webview: { width: 1, height: 1 },
});

export default AudioConverter;
