const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const cors = require('cors');
const { YOUTUBE_DL_PATH } = require('yt-dlp-exec/src/constants');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/test', (req, res) => {
  const ytdlp = spawn(YOUTUBE_DL_PATH, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  ytdlp.stdout.on('data', d => out += d);
  ytdlp.stderr.on('data', d => out += d);
  ytdlp.on('close', code => res.json({ ok: code === 0, version: out.trim(), path: YOUTUBE_DL_PATH }));
  ytdlp.on('error', err => res.status(500).json({ error: err.message }));
});

function isYouTubeUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host.includes('youtube.com') || host.includes('youtu.be');
  } catch {
    return false;
  }
}

app.get('/api/audio', (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const args = [
    '-f', 'bestaudio[ext=m4a]/bestaudio',
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificate',
    '--extractor-args', 'youtube:player_client=android',
    '-o', '-',
    url,
  ];

  const ytdlp = spawn(YOUTUBE_DL_PATH, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  res.setHeader('Content-Type', 'audio/mp4');
  res.setHeader('Cache-Control', 'no-cache');

  let stderrBuf = '';
  ytdlp.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    console.error('yt-dlp:', chunk.toString().trim());
  });

  ytdlp.stdout.pipe(res);

  ytdlp.on('error', (error) => {
    console.error('yt-dlp spawn error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.destroy();
    }
  });

  ytdlp.on('close', (code) => {
    if (code !== 0 && !res.headersSent && !res.writableEnded) {
      res.status(500).json({ error: stderrBuf.slice(-300) || 'yt-dlp failed' });
    }
  });

  res.on('close', () => {
    if (!ytdlp.killed) ytdlp.kill('SIGKILL');
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
