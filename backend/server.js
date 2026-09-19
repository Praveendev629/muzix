const express = require('express');
const cors = require('cors');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');

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

// Get audio URL (returns direct stream URL)
app.get('/api/audio', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const ytMatch = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/);
    if (!ytMatch) return res.status(400).json({ error: 'Invalid YouTube URL' });

    console.log('[audio] Getting URL for:', url);

    const { stdout, stderr } = await execFileAsync(YTDLP, [
      url,
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-g',
      '--no-warnings',
      '--ignore-errors',
      '--extractor-args', 'youtube:player_client=android,web',
    ], { timeout: 45000, maxBuffer: 5 * 1024 * 1024 });

    if (stderr) console.log('[audio] stderr:', stderr.substring(0, 500));

    const audioUrl = stdout.trim().split('\n')[0];
    if (!audioUrl || !audioUrl.startsWith('http')) {
      console.error('[audio] No valid URL. stdout:', stdout.substring(0, 300));
      return res.status(404).json({ error: 'No audio found' });
    }

    let title = 'audio';
    try {
      const { stdout: infoOut } = await execFileAsync(YTDLP, [
        url, '--dump-json', '--no-download', '--no-warnings', '--ignore-errors',
        '--extractor-args', 'youtube:player_client=web',
      ], { timeout: 15000 });
      title = JSON.parse(infoOut).title || 'audio';
    } catch {}

    console.log('[audio] Success:', title);
    res.json({ audioUrl, title });
  } catch (e) {
    console.error('[audio] Error:', e.message);
    res.status(500).json({ error: 'Failed to get audio URL', detail: e.message });
  }
});

// Stream audio directly
app.get('/api/convert', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const ytMatch = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/);
    if (!ytMatch) return res.status(400).json({ error: 'Invalid YouTube URL' });

    console.log('[convert] Converting:', url);

    let title = 'audio';
    try {
      const { stdout } = await execFileAsync(YTDLP, [
        url, '--dump-json', '--no-download', '--no-warnings', '--ignore-errors',
        '--extractor-args', 'youtube:player_client=web',
      ], { timeout: 15000 });
      title = (JSON.parse(stdout).title || 'audio').replace(/[^a-zA-Z0-9 _-]/g, '_').substring(0, 100);
    } catch {}

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${title}.mp3"`);
    res.setHeader('Cache-Control', 'no-cache');

    const ytDlp = spawn(YTDLP, [
      url,
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-o', '-',
      '--no-warnings',
      '--ignore-errors',
      '--quiet',
      '--extractor-args', 'youtube:player_client=android,web',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let sentBytes = 0;
    ytDlp.stdout.on('data', (chunk) => { sentBytes += chunk.length; });
    ytDlp.stdout.pipe(res);

    ytDlp.on('error', (err) => {
      console.error('[convert] Spawn error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
    });

    ytDlp.on('close', (code) => {
      console.log('[convert] Done, code:', code, 'bytes:', sentBytes);
    });

    ytDlp.stderr.on('data', (data) => {});

    req.on('close', () => { ytDlp.kill('SIGTERM'); });
  } catch (e) {
    console.error('[convert] Error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
  }
});

app.listen(PORT, () => {
  console.log(`[muzix-backend] Running on port ${PORT}`);
});
