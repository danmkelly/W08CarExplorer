/**
 * Beep-Beep Car Explorer API Proxy - Cloudflare Worker
 * Proxies requests to DeepSeek LLM and Kaggle datasets from the browser.
 * API keys stored as Cloudflare environment variables, never in the browser.
 *
 * Endpoints:
 *   GET  /api/health   - Health check (public, cached 60s)
 *   POST /api/llm      - Proxy to DeepSeek chat completions
 *   GET  /api/cars     - Proxy to Kaggle Craigslist cars dataset
 *
 * Deploy:  npx wrangler deploy
 * Secrets: npx wrangler secret put LLM_KEY        (DeepSeek API key)
 *          npx wrangler secret put KAGGLE_KEY      (Kaggle API key)
 *          npx wrangler secret put KAGGLE_USERNAME  (Kaggle username)
 *
 * Rate Limiting:
 *   Not enforced at the Worker level by default. For production, add one of:
 *   - Cloudflare WAF > Rate Limiting Rules (dashboard, no code change needed)
 *   - Cloudflare Workers Rate Limiting API (wrangler.toml `[unsafe.bindings]`)
 *   - A token-bucket pattern via Durable Objects for per-IP or per-session control
 *   Free tier: 100,000 req/day. A car browsing chatbot will not exceed this.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const USER_AGENT = "BeepBeepProxy/1.0 (Cloudflare Worker)";

function json(data, status, extraHeaders) {
  const h = new Headers({ "Content-Type": "application/json" });
  Object.entries(CORS_HEADERS).forEach(([k, v]) => h.set(k, v));
  if (extraHeaders) Object.entries(extraHeaders).forEach(([k, v]) => h.set(k, v));
  return new Response(JSON.stringify(data), { status, headers: h });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // --- /api/health -------------------------------------------------
      if (url.pathname === "/api/health") {
        return json({
          status: "ok",
          llm_configured: !!env.LLM_KEY,
          kaggle_configured: !!(env.KAGGLE_KEY && env.KAGGLE_USERNAME),
          timestamp: new Date().toISOString(),
        }, 200, { "Cache-Control": "public, max-age=60" });
      }

      // --- /api/llm ----------------------------------------------------
      if (url.pathname === "/api/llm") {
        if (!env.LLM_KEY) {
          return json({ error: "LLM_KEY not configured on server" }, 503);
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const upstream = await fetch(
          "https://api.deepseek.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.LLM_KEY}`,
              "User-Agent": USER_AGENT,
            },
            body: JSON.stringify(body),
          }
        );

        const responseHeaders = new Headers(upstream.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => responseHeaders.set(k, v));

        return new Response(upstream.body, {
          status: upstream.status,
          headers: responseHeaders,
        });
      }

      // --- /api/cars ---------------------------------------------------
      //
      // Kaggle dataset: austinreese/craigslist-carstrucks-data
      // Endpoint: GET https://www.kaggle.com/api/v1/datasets/.../download
      // Auth: Basic {base64(username:key)}
      //
      // PRODUCTION BEHAVIOUR (documented, not yet implemented):
      //   This endpoint would:
      //   1. Download the dataset ZIP from Kaggle (~20 MB)
      //   2. Unzip and parse vehicles.csv in-memory
      //   3. Accept query params (?manufacturer=ford&max_price=20000&year_min=2015)
      //   4. Return a filtered JSON array of matching cars
      //   5. Cache results aggressively (Kaggle datasets are static snapshots)
      //
      //   Since the dataset is ~1200 rows, the entire parsed CSV fits comfortably
      //   in Worker memory (128 MB limit). No Durable Object or KV store needed.
      //
      // ACADEMIC SCOPE (current behaviour):
      //   The client (index.html) loads cars.json directly from GitHub Pages.
      //   This is a pre-filtered, pre-parsed JSON subset of the Kaggle dataset.
      //   The /api/cars endpoint serves as a future-ready stub for when the
      //   project scales beyond the academic demonstration.
      //
      if (url.pathname === "/api/cars") {
        return json({
          note: "The client uses cars.json directly for academic scope. This endpoint is a future-ready stub for proxying the Kaggle dataset. See worker.js comments for production implementation details.",
          dataset: "austinreese/craigslist-carstrucks-data",
          kaggle_configured: !!(env.KAGGLE_KEY && env.KAGGLE_USERNAME),
        }, 200, { "Cache-Control": "public, max-age=3600" });
      }

      // --- catch-all ---------------------------------------------------
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e.message || "Internal server error" }, 500);
    }
  },
};
