# Building Assistant — chatbot proxy (Google Gemini, free tier)

A tiny Cloudflare Worker that powers the in-site chatbot. It holds your **Gemini
API key** as an encrypted secret (never in the repo, never in the browser), and
runs a function-calling loop so the model can actually run the site's calculators.

```
Browser (GitHub Pages)  →  this Worker (holds Gemini key)  →  Gemini API (free)
```

## One-time setup

### 1. Get a FREE Gemini API key (no credit card)
- Go to <https://aistudio.google.com> → sign in with a Google account
- Click **"Get API key"** → **Create API key** → copy it
- That's it — the free tier needs no billing. (Don't send sensitive data through
  the free tier; Google may use prompts to improve their models.)

### 2. Install Wrangler (Cloudflare's CLI) — if not already
```bash
npm install -g wrangler
wrangler login          # opens a browser to authorize your free Cloudflare account
```

### 3. Set the key as a secret
```bash
cd chatbot
wrangler secret put GEMINI_API_KEY
# paste your Gemini key when prompted, press Enter
```

### 4. (Re)deploy the Worker
```bash
wrangler deploy
```
The Worker URL (`https://smart-building-chatbot.<subdomain>.workers.dev`) is
already wired into `js/chatbot.js`. Once the secret is set and deployed, the
chatbot answers live — just hard-refresh the site.

## Notes
- **Model**: `gemini-2.5-flash` (free-tier; set near the top of `worker.js`).
- **CORS** is locked in `worker.js` (`ALLOWED_ORIGINS`) — already allows
  `glowguides.github.io` and localhost. Add a custom domain there if you use one.
- **Free-tier limits**: ~15 requests/min and a generous daily quota — far more
  than this app needs.
- Rotate the key anytime: re-run `wrangler secret put GEMINI_API_KEY`.
