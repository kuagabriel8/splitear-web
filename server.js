const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const cors = require('cors');
const { YOUTUBE_DL_PATH } = require('yt-dlp-exec/src/constants');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

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
    '-o', '-',
    url,
  ];

  const ytdlp = spawn(YOUTUBE_DL_PATH, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  res.setHeader('Content-Type', 'audio/mp4');
  res.setHeader('Cache-Control', 'no-cache');

  ytdlp.stdout.pipe(res);

  ytdlp.stderr.on('data', (chunk) => {
    console.error('yt-dlp stderr:', chunk.toString());
  });

  ytdlp.on('error', (error) => {
    console.error('yt-dlp spawn error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Unable to download audio from YouTube.' });
    } else {
      res.destroy();
    }
  });

  ytdlp.on('close', (code) => {
    if (code !== 0) {
      console.error('yt-dlp exited with code:', code);
      if (!res.headersSent && !res.writableEnded) {
        res.status(500).json({ error: 'yt-dlp failed to stream audio.' });
      }
    }
  });

  res.on('close', () => {
    if (!ytdlp.killed) {
      ytdlp.kill('SIGKILL');
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  // Open in default browser
  const { spawn } = require('child_process');
  spawn('cmd', ['/c', 'start', `http://localhost:${port}`], {
    detached: true,
    stdio: 'ignore'
  });
});
