const ytdl = require('@distube/ytdl-core');

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

  res.setHeader('Content-Type', 'audio/webm');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');

  let stream;
  try {
    stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
  } catch (err) {
    console.error('ytdl init error:', err);
    return res.status(500).json({ error: 'Failed to initialise stream.', detail: err.message });
  }

  stream.on('error', (err) => {
    console.error('ytdl stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream audio.', detail: err.message });
    } else {
      res.destroy();
    }
  });

  stream.pipe(res);

  res.on('close', () => {
    stream.destroy();
  });
};
