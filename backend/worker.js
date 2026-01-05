/**
 * OpenRouter Proxy Worker for Cloudflare Workers
 * 
 * This worker proxies requests to OpenRouter's API, keeping your API key secure.
 * Users don't need to enter their own API key - this worker handles authentication.
 * 
 * Deploy: npx wrangler deploy
 * Set secret: npx wrangler secret put OPENROUTER_API_KEY
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// CORS headers for cross-origin requests from your app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, restrict this to your app's domain
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle preflight OPTIONS requests
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Proxy a request to OpenRouter
 */
async function proxyToOpenRouter(request, env, path) {
  const apiKey = env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get the request body if it's a POST
  let body = null;
  if (request.method === 'POST') {
    body = await request.text();
  }

  // Forward to OpenRouter
  const response = await fetch(`${OPENROUTER_BASE}${path}`, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://writer.app', // Your app's URL
      'X-Title': 'Writer App',
    },
    body: body,
  });

  // Get the response
  const responseText = await response.text();

  return new Response(responseText, {
    status: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Health check endpoint
 */
function handleHealth(env) {
  const hasKey = !!env.OPENROUTER_API_KEY;
  return new Response(JSON.stringify({ 
    status: 'ok', 
    configured: hasKey,
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Validate that the proxy is working (checks our API key)
 */
async function handleValidate(env) {
  const apiKey = env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return new Response(JSON.stringify({ valid: false, error: 'not_configured' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE}/auth/key`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return new Response(JSON.stringify({ 
        valid: true, 
        label: data.data?.label || 'OpenRouter',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ valid: false, error: 'invalid_key' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ valid: false, error: 'request_failed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Route requests
    switch (path) {
      case '/':
      case '/health':
        return handleHealth(env);
      
      case '/validate':
        return handleValidate(env);
      
      case '/chat/completions':
      case '/v1/chat/completions':
        return proxyToOpenRouter(request, env, '/chat/completions');
      
      case '/models':
      case '/v1/models':
        return proxyToOpenRouter(request, env, '/models');
      
      default:
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  },
};
