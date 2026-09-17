const express = require('express');
const cors = require('cors');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const execFileAsync = promisify(execFile);

// Find yt-dlp binary
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

// Health check
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

// Convert YouTube URL to MP3 stream
app.get('/api/convert', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    // Validate YouTube URL
    const ytMatch = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/);
    if (!ytMatch) return res.status(400).json({ error: 'Invalid YouTube URL' });

    const videoId = ytMatch[1];

    // Get video info first
    let title = 'audio';
    try {
      const { stdout } = await execFileAsync(YTDLP, [
        url, '--dump-json', '--no-download', '--no-warnings', '--ignore-errors',
      ], { timeout: 15000 });
      const info = JSON.parse(stdout);
      title = (info.title || 'audio').replace(/[^a-zA-Z0-9 _-]/g, '_').substring(0, 100);
    } catch {}

    // Set response headers for MP3 stream
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${title}.mp3"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Stream audio directly from yt-dlp
    const ytDlp = spawn(YTDLP, [
      url,
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-o', '-',
      '--no-warnings',
      '--ignore-errors',
      '--quiet',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    ytDlp.stdout.pipe(res);

    ytDlp.on('error', (err) => {
      console.error('[convert] Spawn error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Conversion failed' });
      }
    });

    ytDlp.stderr.on('data', (data) => {
      // yt-dlp outputs progress to stderr, ignore it
    });

    req.on('close', () => {
      ytDlp.kill('SIGTERM');
    });

  } catch (e) {
    console.error('[convert] Error:', e.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Conversion failed' });
    }
  }
});

// Get audio URL (returns a redirect to the stream)
app.get('/api/audio', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const ytMatch = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/);
    if (!ytMatch) return res.status(400).json({ error: 'Invalid YouTube URL' });

    // Get the direct audio URL from yt-dlp
    const { stdout } = await execFileAsync(YTDLP, [
      url,
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-g',
      '--no-warnings',
      '--ignore-errors',
      '--quiet',
    ], { timeout: 30000 });

    const audioUrl = stdout.trim().split('\n')[0];
    if (!audioUrl) return res.status(404).json({ error: 'No audio found' });

    // Get title for response
    let title = 'audio';
    try {
      const { stdout: infoOut } = await execFileAsync(YTDLP, [
        url, '--dump-json', '--no-download', '--no-warnings', '--ignore-errors',
      ], { timeout: 10000 });
      title = JSON.parse(infoOut).title || 'audio';
    } catch {}

    res.json({ audioUrl, title });
  } catch (e) {
    console.error('[audio] Error:', e.message);
    res.status(500).json({ error: 'Failed to get audio URL' });
  }
});

app.listen(PORT, () => {
  console.log(`[muzix-backend] Running on port ${PORT}`);
});
