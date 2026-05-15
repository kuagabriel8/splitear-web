const https = require('https');
const http = require('http');

function extractVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1);
    return parsed.searchParams.get('v');
  } catch { return null; }
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Mozilla/5.0',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { reject(new Error(`Bad JSON from Cobalt: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
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
      return res.status(500).json({ error: `Upstream returned ${audioRes.statusCode}` });
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

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const result = await postJson('https://api.cobalt.tools/', {
      url,
      downloadMode: 'audio',
      audioFormat: 'best',
    });

    const { status, body } = result;

    if (status !== 200) {
      return res.status(500).json({ error: `Cobalt error: ${body.error?.code || JSON.stringify(body)}` });
    }

    if (body.status === 'error') {
      return res.status(500).json({ error: `Cobalt: ${body.error?.code || 'unknown error'}` });
    }

    if (body.status === 'tunnel' || body.status === 'redirect' || body.status === 'stream') {
      return streamUrl(body.url, res);
    }

    return res.status(500).json({ error: `Unexpected Cobalt status: ${body.status}`, detail: body });

  } catch (err) {
    console.error('Cobalt error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
