# Building Assistant — Claude chatbot proxy

A tiny Cloudflare Worker that powers the in-site chatbot. It holds your Anthropic
API key as an **encrypted secret** (never in the repo, never in the browser),
and runs a tool-use loop so Claude can actually run the site's calculators.

```
Browser (GitHub Pages)  →  this Worker (holds API key)  →  Claude API
```

## One-time setup

### 1. Get an Anthropic API key
- Go to <https://console.anthropic.com> → sign in → **API Keys** → *Create Key*.
- Add a payment method under **Billing** (usage is pay-as-you-go; a chatbot like
  this costs roughly a fraction of a cent per message on `claude-opus-4-8`).
- Copy the key (starts with `sk-ant-...`). You'll paste it in step 4 — it is
  never committed anywhere.

### 2. Install Wrangler (Cloudflare's CLI)
```bash
npm install -g wrangler
wrangler login          # opens a browser to authorize your free Cloudflare account
```

### 3. Deploy the Worker
```bash
cd chatbot
wrangler deploy
```
Wrangler prints a URL like:
`https://smart-building-chatbot.<your-subdomain>.workers.dev`
Copy it.

### 4. Set the API key as a secret
```bash
wrangler secret put ANTHROPIC_API_KEY
# paste your sk-ant-... key when prompted, press Enter
```

### 5. Point the website at your Worker
Open `js/chatbot.js` and set:
```js
const WORKER_URL = "https://smart-building-chatbot.<your-subdomain>.workers.dev";
```
Commit and push. Done — the chat bubble appears on every page.

## Notes
- **CORS** is locked in `worker.js` (`ALLOWED_ORIGINS`). It already allows
  `https://glowguides.github.io` and localhost. Add your custom domain there if
  you use one, then `wrangler deploy` again.
- **Model**: `claude-opus-4-8` (set near the top of `worker.js`). To cut
  cost/latency, change it to `claude-haiku-4-5`.
- **Free tier**: Cloudflare Workers includes 100,000 requests/day free.
- The key can be rotated anytime: re-run `wrangler secret put ANTHROPIC_API_KEY`.
