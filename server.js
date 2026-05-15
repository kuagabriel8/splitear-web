const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const cors = require('cors');

const YTDLP = process.env.YTDLP_PATH || '/usr/local/bin/yt-dlp';
const COOKIES_PATH = path.join(os.tmpdir(), 'yt-cookies.txt');

if (process.env.YOUTUBE_COOKIES) {
  fs.writeFileSync(COOKIES_PATH, process.env.YOUTUBE_COOKIES);
  console.log(`Cookies loaded (${process.env.YOUTUBE_COOKIES.length} chars)`);
} else {
  console.log('No YOUTUBE_COOKIES env var — yt-dlp will run unauthenticated.');
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

function isYouTubeUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.includes('youtube.com') || host.includes('youtu.be');
  } catch {
    return false;
  }
}

app.get('/api/test', (req, res) => {
  const p = spawn(YTDLP, ['--version']);
  let out = '';
  p.stdout.on('data', d => out += d);
  p.stderr.on('data', d => out += d);
  p.on('close', code => res.json({
    ok: code === 0,
    version: out.trim(),
    path: YTDLP,
    cookies: fs.existsSync(COOKIES_PATH),
  }));
  p.on('error', err => res.status(500).json({ error: err.message }));
});

app.get('/api/audio', (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const ytdlpArgs = [
    '-f', 'bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '--extractor-args', 'youtube:player_client=web,android,ios',
    ...(fs.existsSync(COOKIES_PATH) ? ['--cookies', COOKIES_PATH] : []),
    '-o', '-',
    url,
  ];

  const ytdlp = spawn(YTDLP, ytdlpArgs);

  const ffmpeg = spawn('ffmpeg', [
    '-loglevel', 'error',
    '-i', 'pipe:0',
    '-vn',
    '-acodec', 'libmp3lame',
    '-b:a', '128k',
    '-f', 'mp3',
    'pipe:1',
  ]);

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-cache');

  let stderrBuf = '';
  ytdlp.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    process.stderr.write(`[yt-dlp] ${chunk}`);
  });
  ffmpeg.stderr.on('data', (chunk) => {
    process.stderr.write(`[ffmpeg] ${chunk}`);
  });

  ytdlp.stdout.pipe(ffmpeg.stdin);
  ffmpeg.stdout.pipe(res);

  function sendError(message) {
    if (res.headersSent) { res.destroy(); return; }
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: message });
  }

  ytdlp.on('error', (err) => sendError(err.message));

  ytdlp.on('close', (code) => {
    if (code !== 0 && !res.headersSent) {
      sendError(stderrBuf.slice(-500) || `yt-dlp exited ${code}`);
    }
    try { ffmpeg.stdin.end(); } catch {}
  });

  ffmpeg.on('error', (err) => sendError(`ffmpeg: ${err.message}`));

  ffmpeg.on('close', (code) => {
    if (code !== 0 && !res.headersSent) {
      sendError(`ffmpeg exited ${code}`);
    }
  });

  res.on('close', () => {
    if (!ytdlp.killed) ytdlp.kill('SIGKILL');
    if (!ffmpeg.killed) ffmpeg.kill('SIGKILL');
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
