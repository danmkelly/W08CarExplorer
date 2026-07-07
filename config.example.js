// Copy this file to config.js and fill in your API keys.
// config.js is gitignored - never commit your real keys.
//
// DeepSeek LLM: sign up at platform.deepseek.com -> API Keys
// Kaggle API:   sign up at kaggle.com -> Settings -> API -> Create New Token
//                The Kaggle key is stored as a Cloudflare secret (KAGGLE_KEY),
//                not in this file. Set it with:
//                npx wrangler secret put KAGGLE_KEY
//                npx wrangler secret put KAGGLE_USERNAME

var LLM_KEY = "sk-your-key-here";
var LLM_URL = "https://api.deepseek.com/v1/chat/completions";
var LLM_MODEL = "deepseek-chat";

// When API_PROXY is set, the browser sends LLM requests to your Cloudflare
// Worker instead of directly to DeepSeek. The Worker attaches the API key.
var API_PROXY = "https://beep-beep-car-proxy.<your-subdomain>.workers.dev";
