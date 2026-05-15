const { spawn } = require('child_process');
const { YOUTUBE_DL_PATH } = require('yt-dlp-exec/src/constants');

function isYouTubeUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host.includes('youtube.com') || host.includes('youtu.be');
  } catch {
    return false;
  }
}

module.exports = (req, res) => {
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
  res.setHeader('Access-Control-Allow-Origin', '*');

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
    if (code !== 0 && !res.headersSent && !res.writableEnded) {
      res.status(500).json({ error: 'yt-dlp failed to stream audio.' });
    }
  });

  res.on('close', () => {
    if (!ytdlp.killed) ytdlp.kill('SIGKILL');
  });
};
