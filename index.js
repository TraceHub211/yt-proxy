const express = require('express');
const { spawn } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || null;

// Optional API key auth - set API_KEY env var on Railway to lock it down
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET /stream?v=VIDEO_ID
// Pipes yt-dlp audio output directly to the response - no storage
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
    '-o', '-',
    `https://www.youtube.com/watch?v=${videoId}`
  ]);

  let headersSent = false;

  ytdlp.stdout.once('data', () => {
    if (!headersSent) {
      headersSent = true;
      res.setHeader('Content-Type', 'audio/webm');
      res.setHeader('Transfer-Encoding', 'chunked');
    }
  });

  ytdlp.stdout.pipe(res);

  ytdlp.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.error('[yt-dlp err]', msg.slice(0, 200));
  });

  ytdlp.on('close', (code) => {
    if (code !== 0 && !headersSent) {
      res.status(500).json({ error: 'yt-dlp failed', code });
    }
  });

  ytdlp.on('error', (err) => {
    console.error('[yt-dlp spawn error]', err.message);
    if (!headersSent) res.status(500).json({ error: err.message });
  });

  // Client disconnected - kill yt-dlp immediately (no wasted bandwidth)
  req.on('close', () => {
    try { ytdlp.kill(); } catch (e) {}
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.listen(PORT, () => console.log(`yt-proxy running on port ${PORT}`));
