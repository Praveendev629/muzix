const express = require('express');
const cors = require('cors');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const execFileAsync = promisify(execFile);

function findYtDlp() {
  const candidates = [
    'yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    path.join(__dirname, 'bin', 'yt-dlp'),
  ];
  for (const c of candidates) {
    try {
      require('child_process').execSync(`${c} --version`, { stdio: 'ignore', timeout: 5000 });
      return c;
    } catch {}
  }
  return 'yt-dlp';
}

const YTDLP = findYtDlp();
console.log('[startup] yt-dlp binary:', YTDLP);

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://piped-api.privacy.com.de',
  'https://api.piped.yt',
];

function httpGet(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeout).then(resolve, reject);
      }
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function pipedGetStream(videoId) {
  for (const base of PIPED_INSTANCES) {
    try {
      console.log('[piped] Trying:', base);
      const { status, data } = await httpGet(`${base}/streams/${videoId}`, 20000);
      if (status === 200) {
        const json = JSON.parse(data);
        const audioStreams = json.audioStreams || [];
        if (audioStreams.length > 0) {
          const best = audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
          console.log('[piped] Got stream from', base, 'bitrate:', best.bitrate);
          return { audioUrl: best.url, title: json.title || 'audio' };
        }
      }
    } catch (e) {
      console.log('[piped] Failed:', base, e.message);
    }
  }
  return null;
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'muzix-ytdl-backend', ytdlp: YTDLP });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Search YouTube
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 20;
    if (!query) return res.status(400).json({ error: 'Missing query parameter q' });

    const { stdout } = await execFileAsync(YTDLP, [
      `ytsearch${limit}:${query}`,
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--ignore-errors',
      '--extractor-args', 'youtube:player_client=web',
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

    const lines = stdout.trim().split('\n').filter(Boolean);
    const results = lines.map((line) => {
      try {
        const item = JSON.parse(line);
        return {
          id: item.id,
          title: item.title || '',
          artist: item.channel || item.uploader || '',
          duration: item.duration || 0,
          thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url
            || item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
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

// Get audio URL - tries yt-dlp first, falls back to Piped
app.get('/api/audio', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const ytMatch = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/);
    if (!ytMatch) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const videoId = ytMatch[1];
    console.log('[audio] Getting URL for:', videoId);

    // Try yt-dlp first
    try {
      const { stdout } = await execFileAsync(YTDLP, [
        url,
        '-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '-g',
        '--no-warnings',
        '--ignore-errors',
        '--extractor-args', 'youtube:player_client=android,web',
      ], { timeout: 30000 });

      const audioUrl = stdout.trim().split('\n')[0];
      if (audioUrl && audioUrl.startsWith('http')) {
        let title = 'audio';
        try {
          const { stdout: infoOut } = await execFileAsync(YTDLP, [
            url, '--dump-json', '--no-download', '--no-warnings', '--ignore-errors',
          ], { timeout: 10000 });
          title = JSON.parse(infoOut).title || 'audio';
        } catch {}
        console.log('[audio] yt-dlp success:', title);
        return res.json({ audioUrl, title });
      }
    } catch (e) {
      console.log('[audio] yt-dlp failed:', e.message.substring(0, 200));
    }

    // Fallback to Piped
    console.log('[audio] Falling back to Piped...');
    const piped = await pipedGetStream(videoId);
    if (piped) {
      console.log('[audio] Piped success:', piped.title);
      return res.json({ audioUrl: piped.audioUrl, title: piped.title });
    }

    res.status(404).json({ error: 'No audio source available' });
  } catch (e) {
    console.error('[audio] Error:', e.message);
    res.status(500).json({ error: 'Failed to get audio URL' });
  }
});

// Stream audio directly
app.get('/api/convert', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const ytMatch = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/);
    if (!ytMatch) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const videoId = ytMatch[1];
    console.log('[convert] Converting:', videoId);

    // Get audio URL via /api/audio logic inline
    let audioUrl = null;
    let title = 'audio';

    try {
      const { stdout } = await execFileAsync(YTDLP, [
        url, '-f', 'bestaudio[ext=m4a]/bestaudio/best', '-g',
        '--no-warnings', '--ignore-errors',
        '--extractor-args', 'youtube:player_client=android,web',
      ], { timeout: 30000 });

      const streamUrl = stdout.trim().split('\n')[0];
      if (streamUrl && streamUrl.startsWith('http')) audioUrl = streamUrl;
    } catch {}

    if (!audioUrl) {
      const piped = await pipedGetStream(videoId);
      if (piped) {
        audioUrl = piped.audioUrl;
        title = piped.title;
      }
    }

    if (!audioUrl) return res.status(404).json({ error: 'No audio source' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${title}.mp3"`);
    res.setHeader('Cache-Control', 'no-cache');

    const proxyReq = https.get(audioUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 60000,
    }, (proxyRes) => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        res.redirect('/api/convert?url=' + encodeURIComponent(proxyRes.headers.location));
        return;
      }
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[convert] Proxy error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
    });

    req.on('close', () => { proxyReq.destroy(); });
  } catch (e) {
    console.error('[convert] Error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
  }
});

app.listen(PORT, () => {
  console.log(`[muzix-backend] Running on port ${PORT}`);
});
