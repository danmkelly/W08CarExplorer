# Beep-Beep Car Explorer - Deployment Guide

## Architecture

```
Browser (index.html on GitHub Pages)
    |
    |-- GET  cars.json  (static file on GitHub Pages, no auth needed)
    |
    |-- POST https://beep-beep-car-proxy.<subdomain>.workers.dev/api/llm
    |
    |-- GET  https://beep-beep-car-proxy.<subdomain>.workers.dev/api/cars
            |
            Cloudflare Worker (worker.js)
                |
                |-- POST https://api.deepseek.com/v1/chat/completions
                |   (Authorization: Bearer $LLM_KEY from env)
                |
                |-- GET  https://www.kaggle.com/api/v1/datasets/austinreese/craigslist-carstrucks-data/download
                |   (Authorization: Basic base64(username:key) from env)
```

The Worker hides both the DeepSeek and Kaggle API keys. The browser never sees them.
Cars data (cars.json) is served directly from GitHub Pages for academic scope.

---

## Prerequisites

- A Cloudflare account (free tier is fine)
- A DeepSeek API key from https://platform.deepseek.com -> API Keys
- A Kaggle account and API key from https://www.kaggle.com/settings -> API -> Create New Token
- Node.js installed locally (for `npx wrangler`)
- A GitHub account (for GitHub Pages)

---

## Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

Or use `npx wrangler` without installing globally.

---

## Step 2: Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser window to authorise Wrangler against your Cloudflare account.

---

## Step 3: Deploy the Worker

```bash
npx wrangler deploy
```

This uploads `worker.js` to Cloudflare's edge network. You'll get a URL like:

```
https://beep-beep-car-proxy.<your-subdomain>.workers.dev
```

---

## Step 4: Set Secrets

### DeepSeek API Key

```bash
npx wrangler secret put LLM_KEY
```

Paste your DeepSeek API key when prompted.

### Kaggle API Key

```bash
npx wrangler secret put KAGGLE_KEY
```

Paste your Kaggle API key when prompted. This is found in your kaggle.json file after creating a Kaggle API token.

### Kaggle Username

```bash
npx wrangler secret put KAGGLE_USERNAME
```

Paste your Kaggle username when prompted.

---

## Step 5: Verify the Deployment

### Health Check

```bash
curl https://beep-beep-car-proxy.<your-subdomain>.workers.dev/api/health
```

Expected response:
```json
{"status":"ok","llm_configured":true,"kaggle_configured":true,"timestamp":"2025-07-07T..."}
```

### LLM Proxy Test

```bash
curl -X POST https://beep-beep-car-proxy.<your-subdomain>.workers.dev/api/llm \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Say hello in one sentence."}],"max_tokens":50}'
```

You should get a JSON response with `choices[0].message.content`.

### Cars Endpoint Test

```bash
curl https://beep-beep-car-proxy.<your-subdomain>.workers.dev/api/cars
```

Expected response (academic scope):
```json
{"note":"The client uses cars.json directly for academic scope...","dataset":"austinreese/craigslist-carstrucks-data","kaggle_configured":true}
```

### CORS Preflight Test

```bash
curl -X OPTIONS https://beep-beep-car-proxy.<your-subdomain>.workers.dev/api/llm -I
```

Expected headers in response:
```
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: Content-Type, Authorization
access-control-max-age: 86400
```

---

## Step 6: Configure config.js

Copy `config.example.js` to `config.js` and update:

```js
var API_PROXY = "https://beep-beep-car-proxy.<your-subdomain>.workers.dev";
var LLM_KEY = "";   // leave empty - key lives in Worker, not here
var LLM_URL = "https://api.deepseek.com/v1/chat/completions";
var LLM_MODEL = "deepseek-chat";
```

When `API_PROXY` is set, the browser sends LLM requests to your Worker instead of directly to DeepSeek. The Worker attaches the key from its environment.

---

## Step 7: Enable GitHub Pages

1. Go to your GitHub repository -> Settings -> Pages
2. Source: "Deploy from a branch"
3. Branch: `master` (or `main`), root folder `/`
4. Click Save

GitHub will provide a URL like `https://<username>.github.io/<repo>/`.

### Required GitHub Pages files (all present in repo):

| File | Purpose |
|------|---------|
| `_headers` | Sets `Cross-Origin-Opener-Policy: same-origin` for all pages |
| `_config.yml` | Tells Jekyll to include `.nojekyll` |
| `.nojekyll` | Disables Jekyll processing (static HTML only) |
| `robots.txt` | Allows all crawlers |

---

## Step 8: End-to-End Test

1. Open your GitHub Pages URL in a browser
2. Open DevTools -> Network tab
3. Type a car search query like "show me Ford trucks under $20,000"
4. Verify:
   - A POST request goes to your Worker (not directly to api.deepseek.com)
   - The response returns a chatbot reply with filtered car results
   - No API key appears in any request header or response body
   - The cars.json loads from GitHub Pages

---

## Local Development

### Frontend only (no Worker, no LLM)

Serve the files with any static server:

```bash
npx serve .
```

Or with Python:

```bash
python -m http.server 8080
```

The chatbot will load cars.json locally. LLM responses require the Worker or a local config.js with a key (never commit).

### Worker locally

```bash
npx wrangler dev
```

This runs the Worker at `http://localhost:8787`. Point `API_PROXY` in config.js to `http://localhost:8787`.

Set local secrets for testing:

```bash
npx wrangler secret put LLM_KEY
npx wrangler secret put KAGGLE_KEY
npx wrangler secret put KAGGLE_USERNAME
```

---

## Dataset Notes

The Kaggle dataset (`austinreese/craigslist-carstrucks-data`) contains ~1200 used vehicle listings from Craigslist with columns for manufacturer, model, year, price, odometer, fuel type, transmission, and more.

**Academic scope**: The pre-parsed `cars.json` (820 KB) is served directly from GitHub Pages. The `/api/cars` Worker endpoint is a future-ready stub.

**Production scope**: The Worker would download, unzip, parse, and filter the dataset on the fly. See comments in `worker.js` for the implementation plan.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| 503 from /api/llm | LLM_KEY not set | `npx wrangler secret put LLM_KEY` |
| 503 from /api/cars | KAGGLE_KEY or KAGGLE_USERNAME not set | `npx wrangler secret put KAGGLE_KEY` / `KAGGLE_USERNAME` |
| CORS error in browser | Worker not deployed or wrong URL | Check API_PROXY in config.js matches Worker URL |
| "LLM Not Live" badge | config.js missing or LLM_KEY empty | Copy config.example.js to config.js and set API_PROXY |
| Car data not loading | cars.json not in repo or blocked by COEP | Verify cars.json exists and `_headers` does not set `require-corp` |
| 402 / "insufficient balance" | DeepSeek credits depleted | Top up at platform.deepseek.com |
| 401 from Kaggle | Kaggle key invalid or expired | Regenerate at kaggle.com/settings -> API |

---

## Rate Limiting

The Worker does not enforce rate limiting by default. For production:

1. **Cloudflare WAF (recommended)**: Dashboard -> Security -> WAF -> Rate Limiting Rules. Create a rule for the Worker route. No code changes needed.

2. **Worker-level**: Uncomment the `[unsafe.bindings]` block in `wrangler.toml` and add rate-limit logic in `worker.js`.

The free tier provides 100,000 requests/day, sufficient for a car browsing chatbot at any realistic academic traffic level.
