const express = require('express');
const path = require('path');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

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

  res.setHeader('Content-Type', 'audio/webm');
  res.setHeader('Cache-Control', 'no-cache');

  let stream;
  try {
    stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
  } catch (err) {
    console.error('ytdl init error:', err);
    return res.status(500).json({ error: 'Failed to initialise stream.' });
  }

  stream.on('error', (err) => {
    console.error('ytdl stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream audio.' });
    } else {
      res.destroy();
    }
  });

  stream.pipe(res);

  res.on('close', () => {
    stream.destroy();
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  const { spawn } = require('child_process');
  spawn('cmd', ['/c', 'start', `http://localhost:${port}`], {
    detached: true,
    stdio: 'ignore'
  });
});
