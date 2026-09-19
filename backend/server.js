const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const execFileAsync = promisify(execFile);

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
console.log('[startup] yt-dlp:', YTDLP);

let ytdl = null;
try {
  ytdl = require('@distube/ytdl-core');
  console.log('[startup] ytdl-core loaded');
} catch (e) {
  console.log('[startup] ytdl-core not available, using yt-dlp only');
}

const YTDL_AGENT = ytdl ? ytdl.createAgent() : null;

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'muzix-ytdl-backend', ytdlp: YTDLP, ytdlCore: !!ytdl });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Search YouTube (uses yt-dlp, works on cloud)
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 20;
    if (!query) return res.status(400).json({ error: 'Missing q parameter' });

    const { stdout } = await execFileAsync(YTDLP, [
      `ytsearch${limit}:${query}`,
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--ignore-errors',
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

// Get audio URL using ytdl-core (handles innertube API)
app.get('/api/audio', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const ytMatch = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/);
    if (!ytMatch) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const videoId = ytMatch[1];
    console.log('[audio] Getting URL for:', videoId);

    // Try ytdl-core first
    if (ytdl) {
      try {
        const info = await ytdl.getInfo(url, { agent: YTDL_AGENT });
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        if (format && format.url) {
          console.log('[audio] ytdl-core success:', info.videoDetails.title);
          return res.json({
            audioUrl: format.url,
            title: info.videoDetails.title || 'audio',
          });
        }
      } catch (e) {
        console.log('[audio] ytdl-core failed:', e.message.substring(0, 200));
      }
    }

    // Fallback to yt-dlp
    try {
      const { stdout } = await execFileAsync(YTDLP, [
        url, '-f', 'bestaudio[ext=m4a]/bestaudio/best', '-g',
        '--no-warnings', '--ignore-errors',
      ], { timeout: 30000 });

      const streamUrl = stdout.trim().split('\n')[0];
      if (streamUrl && streamUrl.startsWith('http')) {
        let title = 'audio';
        try {
          const { stdout: infoOut } = await execFileAsync(YTDLP, [
            url, '--dump-json', '--no-download', '--no-warnings',
          ], { timeout: 10000 });
          title = JSON.parse(infoOut).title || 'audio';
        } catch {}
        console.log('[audio] yt-dlp success:', title);
        return res.json({ audioUrl: streamUrl, title });
      }
    } catch (e) {
      console.log('[audio] yt-dlp failed:', e.message.substring(0, 200));
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

    let audioUrl = null;
    let title = 'audio';

    // Try ytdl-core
    if (ytdl) {
      try {
        const info = await ytdl.getInfo(url, { agent: YTDL_AGENT });
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        if (format && format.url) {
          audioUrl = format.url;
          title = info.videoDetails.title || 'audio';
        }
      } catch {}
    }

    // Fallback yt-dlp
    if (!audioUrl) {
      try {
        const { stdout } = await execFileAsync(YTDLP, [
          url, '-f', 'bestaudio[ext=m4a]/bestaudio/best', '-g',
          '--no-warnings', '--ignore-errors',
        ], { timeout: 30000 });
        const streamUrl = stdout.trim().split('\n')[0];
        if (streamUrl && streamUrl.startsWith('http')) audioUrl = streamUrl;
      } catch {}
    }

    if (!audioUrl) return res.status(404).json({ error: 'No audio source' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${title}.mp3"`);

    const proxyReq = https.get(audioUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 60000,
    }, (proxyRes) => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        proxyRes.resume();
        https.get(proxyRes.headers.location, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }, (redirectRes) => {
          res.setHeader('Content-Type', redirectRes.headers['content-type'] || 'audio/mpeg');
          redirectRes.pipe(res);
        }).on('error', () => {
          if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
        });
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
