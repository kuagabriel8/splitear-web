const https = require('https');

function extractVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1);
    return parsed.searchParams.get('v');
  } catch { return null; }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from Piped')); }
      });
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  const { url } = req.query;
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  try {
    const data = await fetchJson(`https://pipedapi.kavin.rocks/streams/${videoId}`);
    if (!data.audioStreams?.length) throw new Error('No audio streams found');

    const best = data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    https.get(best.url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (audioRes) => {
      res.setHeader('Content-Type', best.mimeType || 'audio/webm');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (audioRes.headers['content-length']) {
        res.setHeader('Content-Length', audioRes.headers['content-length']);
      }
      audioRes.pipe(res);
      res.on('close', () => audioRes.destroy());
    }).on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

  } catch (err) {
    console.error('Piped error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
