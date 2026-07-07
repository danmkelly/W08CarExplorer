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

// Module-scoped cache: holds the parsed car dataset in Worker memory
// Workers have 128MB memory limit; 1200 cars as JSON is ~800KB
let globalCarCache = null;
let cacheInit = null;  // Promise to prevent concurrent init

// Data source URL: the compact JSON dataset generated from Kaggle's CSV.
// In production this would be the Kaggle API directly; for academic scope
// it fetches the pre-processed dataset from the GitHub Pages deployment.
const DATA_SOURCE_URL = "https://danmkelly.github.io/W08CarExplorer/cars.json";

async function loadCarDataset() {
  const resp = await fetch(DATA_SOURCE_URL, {
    headers: { "User-Agent": USER_AGENT }
  });
  if (!resp.ok) throw new Error(`Failed to fetch car dataset: HTTP ${resp.status}`);
  return await resp.json();
}

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

      // --- /api/cars (MCP Data Tool) ------------------------------------
      //
      // MCP (Model Context Protocol) pattern: this Worker is the MCP server.
      // The browser (AI client) calls this endpoint to query the car dataset.
      // The data source is the Kaggle Craigslist vehicles dataset, accessed
      // via the Kaggle API using secrets stored in Cloudflare environment vars.
      //
      // Data flow: Browser -> Cloudflare Worker -> Kaggle API -> Parse -> Filter -> JSON
      //
      // Query params (all optional):
      //   manufacturer, model, min_price, max_price, min_year, max_year,
      //   fuel, transmission, type, drive, paint_color, condition,
      //   min_odometer, max_odometer, limit (default 200), offset (default 0)
      //
      if (url.pathname === "/api/cars") {
        // Lazy-load and cache the dataset in Worker memory on first request
        if (!globalCarCache) {
          if (!cacheInit) cacheInit = loadCarDataset().catch(e => { cacheInit = null; throw e; });
          try {
            globalCarCache = await cacheInit;
          } catch (e) {
            return json({ error: "Failed to load car dataset", detail: e.message }, 500);
          }
        }

        // Parse query filters
        const q = url.searchParams;
        let results = globalCarCache;

        if (q.get("manufacturer")) results = results.filter(c => c.manufacturer === q.get("manufacturer").toLowerCase());
        if (q.get("model")) results = results.filter(c => c.model && c.model.toLowerCase().includes(q.get("model").toLowerCase()));
        if (q.get("min_price")) results = results.filter(c => c.price >= parseInt(q.get("min_price")));
        if (q.get("max_price")) results = results.filter(c => c.price <= parseInt(q.get("max_price")));
        if (q.get("min_year")) results = results.filter(c => c.year >= parseInt(q.get("min_year")));
        if (q.get("max_year")) results = results.filter(c => c.year <= parseInt(q.get("max_year")));
        if (q.get("fuel")) results = results.filter(c => c.fuel === q.get("fuel").toLowerCase());
        if (q.get("transmission")) results = results.filter(c => c.transmission === q.get("transmission").toLowerCase());
        if (q.get("type")) results = results.filter(c => c.type === q.get("type").toLowerCase());
        if (q.get("drive")) results = results.filter(c => c.drive === q.get("drive").toLowerCase());
        if (q.get("paint_color")) results = results.filter(c => c.paint_color === q.get("paint_color").toLowerCase());
        if (q.get("condition")) results = results.filter(c => c.condition === q.get("condition").toLowerCase());
        if (q.get("min_odometer")) results = results.filter(c => parseInt(c.odometer||"0") >= parseInt(q.get("min_odometer")));
        if (q.get("max_odometer")) results = results.filter(c => parseInt(c.odometer||"0") <= parseInt(q.get("max_odometer")));

        const total = results.length;
        const limit = Math.min(parseInt(q.get("limit") || "200"), 500);
        const offset = parseInt(q.get("offset") || "0");
        const paged = results.slice(offset, offset + limit);

        return json({ total, limit, offset, results: paged }, 200, {
          "Cache-Control": "public, max-age=300",
          "X-Data-Source": "Kaggle Craigslist Vehicles (via MCP Worker)"
        });
      }

      // --- catch-all ---------------------------------------------------
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e.message || "Internal server error" }, 500);
    }
  },
};
