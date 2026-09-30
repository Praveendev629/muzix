const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const { promisify } = require('util');
const https = require('https');

const execFileAsync = promisify(execFile);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---- yt-dlp (search only; audio uses InnerTube) ----
function findYtDlp() {
  const candidates = ['yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp'];
  for (const c of candidates) {
    try {
      require('child_process').execSync(`${c} --version`, { stdio: 'ignore', timeout: 5000 });
      return c;
    } catch {}
  }
  return 'yt-dlp';
}
const YTDLP = findYtDlp();

// ---- InnerTube ANDROID_VR (audio extraction) ----
const ANDROID_VR_UA = 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';
const INNERTUBE_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const INNERTUBE_CLIENT = {
  clientName: 'ANDROID_VR',
  clientVersion: '1.65.10',
  deviceMake: 'Oculus',
  deviceModel: 'Quest 3',
  androidSdkVersion: 32,
  osName: 'Android',
  osVersion: '12L',
  hl: 'en',
};

let cachedVisitorData = '';

async function getVisitorData() {
  if (cachedVisitorData) return cachedVisitorData;
  try {
    const resp = await fetch('https://youtubei.googleapis.com/youtubei/v1/visitor_id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_VR_UA },
      body: JSON.stringify({ context: { client: { clientName: 'ANDROID_VR', clientVersion: '1.65.10' } } }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json();
    cachedVisitorData = data?.responseContext?.visitorData || '';
  } catch {}
  return cachedVisitorData;
}

async function innertubeAudio(videoId) {
  const visitorData = await getVisitorData();

  const body = JSON.stringify({
    videoId,
    context: { client: { ...INNERTUBE_CLIENT, ...(visitorData && { visitorData }) } },
    contentCheckOk: true,
    racyCheckOk: true,
    params: 'CgIQBg==',
  });

  // Try youtubei.googleapis.com (no API key) first, then www.youtube.com with key
  const endpoints = [
    'https://youtubei.googleapis.com/youtubei/v1/player',
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`,
  ];

  let lastError = 'No endpoint tried';
  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': ANDROID_VR_UA,
          'X-Youtube-Client-Name': '28',
          'X-Youtube-Client-Version': INNERTUBE_CLIENT.clientVersion,
          ...(visitorData && { 'X-Goog-Visitor-Id': visitorData }),
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      if (resp.status === 403) {
        lastError = `HTTP 403 from ${new URL(endpoint).hostname}`;
        cachedVisitorData = ''; // refresh visitor data
        continue;
      }
      if (!resp.ok) {
        lastError = `HTTP ${resp.status}`;
        continue;
      }

      const data = await resp.json();
      const status = data.playabilityStatus?.status;
      if (status !== 'OK') throw new Error(`Playability: ${status}`);

      const formats = data.streamingData?.adaptiveFormats || [];

      // Prefer itag 140 (128kbps AAC m4a), then best audio/mp4, then any audio
      let best = formats.find((f) => f.itag === 140 && f.url);
      if (!best) {
        best = formats
          .filter((f) => f.mimeType?.startsWith('audio/mp4') && f.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      }
      if (!best) {
        best = formats
          .filter((f) => f.mimeType?.startsWith('audio/') && f.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      }
      if (!best?.url) throw new Error('No audio format with URL');

      return {
        audioUrl: best.url,
        title: data.videoDetails?.title || '',
        duration: parseInt(data.videoDetails?.lengthSeconds || '0', 10),
        author: data.videoDetails?.author || '',
        thumbnail: data.videoDetails?.thumbnail?.thumbnails?.pop()?.url || '',
      };
    } catch (e) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        lastError = 'Timeout';
        continue;
      }
      // Playability / format errors are real failures — don't try next endpoint
      if (e.message.startsWith('Playability:') || e.message === 'No audio format with URL') {
        throw e;
      }
      lastError = e.message;
    }
  }
  throw new Error(lastError);
}

// ---- stream URL cache (re-resolve before expiry) ----
const streamCache = new Map(); // videoId -> { url, expires }
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours (URLs valid ~5h)

async function getStreamUrl(videoId) {
  const cached = streamCache.get(videoId);
  if (cached && cached.expires > Date.now()) return cached.url;

  const result = await innertubeAudio(videoId);
  streamCache.set(videoId, { url: result.audioUrl, expires: Date.now() + CACHE_TTL });
  return result.audioUrl;
}

// ---- proxy audio stream (handles Range for seeking) ----
function proxyStream(audioUrl, req, res) {
  return new Promise((resolve) => {
    const headers = { 'User-Agent': ANDROID_VR_UA };
    if (req.headers.range) headers.Range = req.headers.range;

    const proxyReq = https.get(audioUrl, { headers, timeout: 30000 }, (proxyRes) => {
      // Follow redirects (up to 3)
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        proxyRes.resume();
        const redirectUrl = new URL(proxyRes.headers.location, audioUrl).href;
        if (!res.headersSent) {
          proxyStream(redirectUrl, req, res).then(resolve);
        } else {
          resolve();
        }
        return;
      }

      const respHeaders = {
        'Content-Type': proxyRes.headers['content-type'] || 'audio/mp4',
        'Accept-Ranges': proxyRes.headers['accept-ranges'] || 'bytes',
        'Access-Control-Allow-Origin': '*',
      };
      if (proxyRes.headers['content-length']) respHeaders['Content-Length'] = proxyRes.headers['content-length'];
      if (proxyRes.headers['content-range']) respHeaders['Content-Range'] = proxyRes.headers['content-range'];

      res.writeHead(proxyRes.statusCode || 200, respHeaders);
      proxyRes.pipe(res);
      proxyRes.on('end', () => resolve());
      proxyRes.on('error', () => { res.end(); resolve(); });
    });

    proxyReq.on('error', () => {
      if (!res.headersSent) res.status(502).json({ error: 'Stream proxy error' });
      resolve();
    });
    proxyReq.on('timeout', () => { proxyReq.destroy(); resolve(); });

    req.on('close', () => { proxyReq.destroy(); resolve(); });
  });
}

// ---- routes ----

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'muzix-backend', innertube: true, ytdlpSearch: YTDLP });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Search YouTube (yt-dlp flat-playlist — no video access needed)
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 20;
    if (!query) return res.status(400).json({ error: 'Missing q parameter' });

    const { stdout } = await execFileAsync(YTDLP, [
      `ytsearch${limit}:${query}`,
      '--flat-playlist', '--dump-json', '--no-warnings', '--ignore-errors',
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

    const results = stdout.trim().split('\n').filter(Boolean).map((line) => {
      try {
        const item = JSON.parse(line);
        return {
          id: item.id,
          title: item.title || '',
          artist: item.channel || item.uploader || '',
          duration: item.duration || 0,
          thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url
            || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${item.id}`,
        };
      } catch { return null; }
    }).filter(Boolean);

    res.json({ results });
  } catch (e) {
    console.error('[search] Error:', e.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get audio info + stream URL (InnerTube ANDROID_VR — no cookies, no bot detection)
app.get('/api/audio', async (req, res) => {
  try {
    const url = req.query.url || '';
    const videoId = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/)?.[1]
      || (/^[a-zA-Z0-9_-]{11}$/.test(url) ? url : null);

    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

    console.log('[audio] Resolving:', videoId);
    const result = await innertubeAudio(videoId);
    console.log('[audio] OK:', result.title);

    res.json({
      audioUrl: result.audioUrl,
      streamUrl: `/api/stream?v=${videoId}`,
      videoId,
      title: result.title,
      duration: result.duration,
      author: result.author,
      thumbnail: result.thumbnail,
    });
  } catch (e) {
    console.error('[audio] Error:', e.message);
    res.status(404).json({ error: e.message || 'No audio source' });
  }
});

// Stream proxy — never expires, re-resolves internally
app.get('/api/stream', async (req, res) => {
  try {
    const videoId = req.query.v;
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    let audioUrl;
    try {
      audioUrl = await getStreamUrl(videoId);
    } catch (e) {
      // Clear cache and retry once (stale visitor data)
      streamCache.delete(videoId);
      cachedVisitorData = '';
      audioUrl = await getStreamUrl(videoId);
    }

    await proxyStream(audioUrl, req, res);
  } catch (e) {
    console.error('[stream] Error:', e.message);
    if (!res.headersSent) res.status(502).json({ error: 'Stream failed' });
  }
});

// Debug
app.get('/api/debug', async (req, res) => {
  try {
    const videoId = req.query.v || '60ItHLz5WEA';
    const t0 = Date.now();
    const result = await innertubeAudio(videoId);
    res.json({ ...result, audioUrl: result.audioUrl.substring(0, 200), elapsedMs: Date.now() - t0 });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`[muzix-backend] Running on port ${PORT}`);
});
