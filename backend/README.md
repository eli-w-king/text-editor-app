# Writer App - OpenRouter Proxy Backend

This Cloudflare Worker proxies requests to OpenRouter's API, keeping your API key secure on the server side. Users don't need to enter their own API key.

## Setup

### 1. Install Wrangler CLI (if not already installed)

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Deploy the Worker

```bash
cd backend
npx wrangler deploy
```

### 4. Set Your OpenRouter API Key as a Secret

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

When prompted, paste your OpenRouter API key (get one at https://openrouter.ai/keys).

### 5. Note Your Worker URL

After deployment, you'll get a URL like:
```
https://writer-app-proxy.<your-subdomain>.workers.dev
```

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/health` | GET | Health check - confirms worker is running |
| `/validate` | GET | Validates the configured API key |
| `/chat/completions` | POST | Proxies to OpenRouter chat completions |
| `/models` | GET | Lists available models |

## Usage in App

Update your app to use the worker URL instead of OpenRouter directly:

```javascript
// Instead of:
fetch('https://openrouter.ai/api/v1/chat/completions', {...})

// Use:
fetch('https://writer-app-proxy.YOUR-SUBDOMAIN.workers.dev/chat/completions', {...})
```

## Security Notes

- The API key is stored as a Cloudflare secret, not in code
- Consider adding rate limiting for production use
- Consider restricting CORS origins to your app's domain only

## Costs

Cloudflare Workers free tier includes:
- 100,000 requests/day
- 10ms CPU time per request

This is more than enough for personal/small apps.
