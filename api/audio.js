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

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });

    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const stream = ytdl.downloadFromInfo(info, { format });

    stream.on('error', (err) => {
      console.error('ytdl stream error:', err);
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ error: err.message });
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
    res.on('close', () => stream.destroy());

  } catch (err) {
    console.error('ytdl error:', err);
    res.setHeader('X-Audio-Error', err.message.slice(0, 200));
    res.status(500).json({ error: err.message });
  }
};
