/**
 * Inlay App — Cloudflare Worker Proxy
 *
 * Routes requests to the Anthropic API using claude-haiku-4-5.
 * The API key is stored as a Wrangler secret (ANTHROPIC_API_KEY).
 *
 * Deploy:
 *   npx wrangler deploy
 *   npx wrangler secret put ANTHROPIC_API_KEY
 */

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// Convert OpenRouter-style request body → Anthropic Messages API format
function toAnthropicBody(body) {
  const { messages, temperature, max_tokens } = body;

  // Separate system message from user/assistant messages
  let system = undefined;
  const filteredMessages = [];

  for (const msg of messages || []) {
    if (msg.role === 'system') {
      system = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    } else {
      filteredMessages.push({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    }
  }

  return {
    model: MODEL,
    messages: filteredMessages,
    ...(system ? { system } : {}),
    max_tokens: max_tokens || 256,
    temperature: temperature ?? 0.2,
  };
}

// Convert Anthropic response → OpenRouter-style response so the app doesn't need changes
function toOpenRouterShape(anthropicResponse) {
  const content = anthropicResponse.content || [];
  const text = content.map(c => c.text || '').join('');

  return {
    id: anthropicResponse.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: anthropicResponse.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: anthropicResponse.stop_reason || 'stop',
      },
    ],
    usage: {
      prompt_tokens: anthropicResponse.usage?.input_tokens || 0,
      completion_tokens: anthropicResponse.usage?.output_tokens || 0,
      total_tokens: (anthropicResponse.usage?.input_tokens || 0) + (anthropicResponse.usage?.output_tokens || 0),
    },
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return handleOptions();

    const url = new URL(request.url);
    const path = url.pathname;

    // ── Health / validate endpoint ─────────────────────────────────────────
    if (path === '/validate' || path === '/health') {
      if (!env.ANTHROPIC_API_KEY) {
        return jsonResponse({ valid: false, error: 'ANTHROPIC_API_KEY secret not set' }, 500);
      }
      return jsonResponse({ valid: true, model: MODEL });
    }

    // ── Chat completions ───────────────────────────────────────────────────
    if (path === '/chat/completions' && request.method === 'POST') {
      if (!env.ANTHROPIC_API_KEY) {
        return jsonResponse({ error: 'ANTHROPIC_API_KEY secret not set' }, 500);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
      }

      const anthropicBody = toAnthropicBody(body);

      try {
        const upstream = await fetch(`${ANTHROPIC_BASE}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify(anthropicBody),
        });

        const data = await upstream.json();

        if (!upstream.ok) {
          console.error('Anthropic error:', JSON.stringify(data));
          return jsonResponse({ error: data.error?.message || 'Anthropic API error', detail: data }, upstream.status);
        }

        // Return in OpenRouter shape so existing app code works without changes
        return jsonResponse(toOpenRouterShape(data));
      } catch (err) {
        console.error('Worker fetch error:', err);
        return jsonResponse({ error: 'Worker fetch failed', detail: String(err) }, 500);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};