const express = require('express');
const { spawn } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || null;

// Optional API key auth
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET /stream?v=VIDEO_ID
app.get('/stream', (req, res) => {
  const videoId = req.query.v;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  console.log(`[stream] ${videoId}`);

  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
    '--no-playlist',
    '--no-warnings',
    '--buffer-size', '16K',
    '-o', '-',
    `https://www.youtube.com/watch?v=${videoId}`
  ]);

  let headersSent = false;
  let clientGone = false;

  req.on('close', () => {
    clientGone = true;
    try { ytdlp.kill(); } catch (e) {}
  });

  ytdlp.stdout.once('data', () => {
    if (!headersSent && !res.headersSent) {
      headersSent = true;
      res.setHeader('Content-Type', 'audio/webm');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Keep-Alive', 'timeout=600');
    }
  });

  ytdlp.stdout.on('data', (chunk) => {
    if (clientGone || res.destroyed) return;
    if (!headersSent && !res.headersSent) {
      headersSent = true;
      res.setHeader('Content-Type', 'audio/webm');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }
    try { res.write(chunk); } catch (e) {}
  });

  ytdlp.stdout.on('end', () => {
    if (!clientGone && !res.destroyed) {
      try { res.end(); } catch (e) {}
    }
  });

  ytdlp.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.error('[yt-dlp err]', msg.slice(0, 200));
  });

  ytdlp.on('close', (code) => {
    if (code !== 0 && !headersSent && !res.headersSent) {
      try { res.status(500).json({ error: 'yt-dlp failed', code }); } catch (e) {}
    } else if (!clientGone && !res.destroyed) {
      try { res.end(); } catch (e) {}
    }
  });

  ytdlp.on('error', (err) => {
    console.error('[yt-dlp spawn error]', err.message);
    if (!headersSent && !res.headersSent) {
      try { res.status(500).json({ error: err.message }); } catch (e) {}
    }
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.listen(PORT, () => console.log(`yt-proxy running on port ${PORT}`));
