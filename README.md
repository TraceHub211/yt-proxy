# yt-proxy

Simple audio proxy that pipes YouTube audio via yt-dlp. No storage used.

## Usage

`GET /stream?v=VIDEO_ID` — streams audio bytes directly

## Deploy on Railway

1. Push this repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Set env var `API_KEY` to a random secret string
4. Done

## Env vars

| Var | Description |
|-----|-------------|
| `PORT` | Auto-set by Railway |
| `API_KEY` | Optional secret key — set this to prevent public abuse |
