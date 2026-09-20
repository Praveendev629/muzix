const express = require('express');
const cors = require('cors');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const https = require('https');
const fs = require('fs');

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

const COOKIES_PATH = '/tmp/cookies.txt';

function parseBrowserCookies(cookieStr) {
  if (!cookieStr) return null;
  const lines = ['# Netscape HTTP Cookie File', '# Converted from browser cookies'];
  const pairs = cookieStr.split(';').map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) continue;
    const name = pair.substring(0, eqIdx).trim();
    const value = pair.substring(eqIdx + 1).trim();
    // Netscape format: domain  flag  path  secure  expiry  name  value
    // Use TRUE for secure since __Secure- cookies require HTTPS
    const isSecure = name.startsWith('__Secure-') || name.startsWith('__Host-');
    lines.push(`.youtube.com\tTRUE\t/\t${isSecure ? 'TRUE' : 'FALSE'}\t0\t${name}\t${value}`);
  }
  return lines.join('\n') + '\n';
}

function setupCookies() {
  const cookieEnv = process.env.YOUTUBE_COOKIES;
  if (!cookieEnv) {
    console.log('[startup] No YOUTUBE_COOKIES env var');
    return false;
  }
  try {
    const cookieStr = cookieEnv.startsWith('ey') ? Buffer.from(cookieEnv, 'base64').toString('utf8') : cookieEnv;
    const netscape = parseBrowserCookies(cookieStr);
    if (netscape) {
      fs.writeFileSync(COOKIES_PATH, netscape);
      console.log('[startup] Cookies written to', COOKIES_PATH, '- entries:', netscape.split('\n').length - 1);
      return true;
    }
  } catch (e) {
    console.error('[startup] Cookie setup failed:', e.message);
  }
  return false;
}

const hasCookies = setupCookies();

function ytdlpExtra() {
  const args = ['--no-warnings', '--ignore-errors'];
  if (hasCookies) args.push('--cookies', COOKIES_PATH);
  return args;
}

let ytdl = null;
try {
  ytdl = require('@distube/ytdl-core');
  console.log('[startup] ytdl-core loaded');
} catch (e) {
  console.log('[startup] ytdl-core not available:', e.message?.substring(0, 100));
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'muzix-ytdl-backend', ytdlp: YTDLP, ytdlCore: !!ytdl, cookies: hasCookies });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Search YouTube
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 20;
    if (!query) return res.status(400).json({ error: 'Missing q parameter' });

    const { stdout } = await execFileAsync(YTDLP, [
      `ytsearch${limit}:${query}`,
      '--flat-playlist', '--dump-json',
      ...ytdlpExtra(),
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

// Get audio URL
app.get('/api/audio', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const ytMatch = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/);
    if (!ytMatch) return res.status(400).json({ error: 'Invalid YouTube URL' });

    console.log('[audio] Getting URL for:', ytMatch[1]);

    // Try yt-dlp with cookies
    try {
      const { stdout } = await execFileAsync(YTDLP, [
        url,
        '-f', 'bestaudio[ext=m4a]/bestaudio/best', '-g',
        ...ytdlpExtra(),
      ], { timeout: 45000, maxBuffer: 5 * 1024 * 1024 });

      const streamUrl = stdout.trim().split('\n')[0];
      if (streamUrl && streamUrl.startsWith('http')) {
        let title = 'audio';
        try {
          const { stdout: infoOut } = await execFileAsync(YTDLP, [
            url,
            '--dump-json', '--no-download',
            ...ytdlpExtra(),
          ], { timeout: 15000 });
          title = JSON.parse(infoOut).title || 'audio';
        } catch {}
        console.log('[audio] yt-dlp success:', title);
        return res.json({ audioUrl: streamUrl, title });
      }
    } catch (e) {
      console.log('[audio] yt-dlp failed:', e.message?.substring(0, 200));
    }

    // Try ytdl-core
    if (ytdl) {
      try {
        const info = await ytdl.getInfo(url);
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        if (format && format.url) {
          console.log('[audio] ytdl-core success:', info.videoDetails.title);
          return res.json({ audioUrl: format.url, title: info.videoDetails.title || 'audio' });
        }
      } catch (e) {
        console.log('[audio] ytdl-core failed:', e.message?.substring(0, 200));
      }
    }

    res.status(404).json({ error: 'No audio source available' });
  } catch (e) {
    console.error('[audio] Error:', e.message);
    res.status(500).json({ error: 'Failed to get audio URL' });
  }
});

// Debug: show yt-dlp output
app.get('/api/debug', async (req, res) => {
  try {
    // Show cookie file first few lines
    let cookiePreview = 'no cookies file';
    try {
      const content = fs.readFileSync(COOKIES_PATH, 'utf8');
      const lines = content.split('\n');
      cookiePreview = `Total lines: ${lines.length}. First 3: ${lines.slice(0, 3).join(' | ')}`;
    } catch (e) {
      cookiePreview = `Error reading cookies: ${e.message}`;
    }

    // Get yt-dlp version
    let version = 'unknown';
    try {
      const { stdout } = await execFileAsync(YTDLP, ['--version'], { timeout: 5000 });
      version = stdout.trim();
    } catch {}

    const url = req.query.url || 'https://www.youtube.com/watch?v=60ItHLz5WEA';
    const args = [url, '-f', 'bestaudio[ext=m4a]/bestaudio/best', '-g', '--verbose', ...ytdlpExtra()];
    console.log('[debug] Running:', YTDLP, args.join(' '));
    const { stdout, stderr } = await execFileAsync(YTDLP, args, { timeout: 45000, maxBuffer: 5 * 1024 * 1024 });
    res.json({ version, cookiePreview, stdout: stdout.substring(0, 500), stderr: stderr.substring(0, 2000) });
  } catch (e) {
    res.json({ error: e.message?.substring(0, 500), stdout: e.stdout?.substring(0, 500), stderr: e.stderr?.substring(0, 2000) });
  }
});

// Stream audio
app.get('/api/convert', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const ytMatch = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|watch\?.+&v=)([^#&?]{11})/);
    if (!ytMatch) return res.status(400).json({ error: 'Invalid YouTube URL' });

    console.log('[convert] Converting:', ytMatch[1]);

    let audioUrl = null;
    let title = 'audio';

    try {
      const { stdout } = await execFileAsync(YTDLP, [
        url,
        '-f', 'bestaudio[ext=m4a]/bestaudio/best', '-g',
        ...ytdlpExtra(),
      ], { timeout: 45000 });
      const streamUrl = stdout.trim().split('\n')[0];
      if (streamUrl && streamUrl.startsWith('http')) audioUrl = streamUrl;
    } catch {}

    if (!audioUrl && ytdl) {
      try {
        const info = await ytdl.getInfo(url);
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        if (format && format.url) { audioUrl = format.url; title = info.videoDetails.title || 'audio'; }
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
        https.get(proxyRes.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (redirectRes) => {
          res.setHeader('Content-Type', redirectRes.headers['content-type'] || 'audio/mpeg');
          redirectRes.pipe(res);
        }).on('error', () => { if (!res.headersSent) res.status(500).json({ error: 'Stream failed' }); });
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
