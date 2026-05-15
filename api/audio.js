const https = require('https');
const http = require('http');

function extractVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1);
    return parsed.searchParams.get('v');
  } catch { return null; }
}

function fetchJson(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetchJson(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Bad JSON: ${data.slice(0, 120)}`)); }
      });
    }).on('error', reject);
  });
}

function streamUrl(url, res, redirects = 5) {
  if (redirects === 0) return res.status(500).json({ error: 'Too many redirects' });
  const lib = url.startsWith('https') ? https : http;
  lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (audioRes) => {
    if (audioRes.statusCode >= 300 && audioRes.statusCode < 400 && audioRes.headers.location) {
      audioRes.resume();
      return streamUrl(audioRes.headers.location, res, redirects - 1);
    }
    if (audioRes.statusCode !== 200 && audioRes.statusCode !== 206) {
      audioRes.resume();
      return res.status(500).json({ error: `Upstream ${audioRes.statusCode}` });
    }
    res.setHeader('Content-Type', audioRes.headers['content-type'] || 'audio/webm');
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
}

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.privacydev.net',
  'https://inv.tux.pizza',
  'https://invidious.io',
];

async function getAudioUrl(videoId) {
  const errors = [];
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const data = await fetchJson(`${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats`);
      const audioFormats = (data.adaptiveFormats || []).filter(f => f.type?.startsWith('audio/'));
      if (!audioFormats.length) { errors.push(`${instance}: no audio formats`); continue; }
      const best = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      return { url: best.url, mimeType: best.type };
    } catch (err) {
      errors.push(`${instance}: ${err.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

module.exports = async (req, res) => {
  const { url } = req.query;
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  try {
    const { url: audioUrl, mimeType } = await getAudioUrl(videoId);
    res.setHeader('Content-Type', mimeType || 'audio/webm');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    streamUrl(audioUrl, res);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
