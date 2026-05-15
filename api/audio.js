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
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetchJson(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Bad JSON from ${url}: ${data.slice(0, 100)}`)); }
      });
    });
    req.on('error', reject);
  });
}

function streamAudio(url, res, redirects = 5) {
  if (redirects === 0) return res.status(500).json({ error: 'Too many redirects on audio URL' });
  const lib = url.startsWith('https') ? https : http;
  lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-' } }, (audioRes) => {
    if (audioRes.statusCode >= 300 && audioRes.statusCode < 400 && audioRes.headers.location) {
      audioRes.resume();
      return streamAudio(audioRes.headers.location, res, redirects - 1);
    }
    if (audioRes.statusCode !== 200 && audioRes.statusCode !== 206) {
      audioRes.resume();
      return res.status(500).json({ error: `Audio upstream returned ${audioRes.statusCode}` });
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

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.projectsegfau.lt',
];

async function getAudioStreams(videoId) {
  const errors = [];
  for (const instance of PIPED_INSTANCES) {
    try {
      const data = await fetchJson(`${instance}/streams/${videoId}`);
      if (data.audioStreams?.length) return data.audioStreams;
      errors.push(`${instance}: no audio streams`);
    } catch (err) {
      errors.push(`${instance}: ${err.message}`);
    }
  }
  throw new Error('All Piped instances failed: ' + errors.join(' | '));
}

module.exports = async (req, res) => {
  const { url } = req.query;
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  try {
    const audioStreams = await getAudioStreams(videoId);
    const best = audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    streamAudio(best.url, res);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
