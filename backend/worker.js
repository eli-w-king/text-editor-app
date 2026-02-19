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
 * Validate a URL points to an actual image by fetching it server-side
 */
async function validateImageUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && (contentType.startsWith('image/') || contentType.includes('octet-stream'))) {
      return true;
    }
    console.log('URL validation failed:', url, 'status:', response.status, 'type:', contentType);
    return false;
  } catch (e) {
    console.log('URL unreachable:', url);
    return false;
  }
}

/**
 * Search for images using Gemini with Google Search grounding.
 * Strategy: Ask Gemini to identify the exact subject/Wikipedia article title,
 * then use Wikipedia API to reliably get the actual image URL.
 */
async function handleSearchImage(request, env) {
  const googleKey = env.GOOGLE_API_KEY;

  if (!googleKey) {
    return new Response(JSON.stringify({ error: 'Google API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { query } = body;
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Step 1: Ask Gemini (with Google Search) to identify the subject
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `I want to find an image of: "${query}". Search the web and tell me the exact Wikipedia article title for this subject. Return ONLY the Wikipedia article title, nothing else. For example, if I ask for "sam altman smiling", return "Sam Altman". If I ask for "eiffel tower at night", return "Eiffel Tower". If there is no Wikipedia article for this subject, respond with: NO_ARTICLE` }
            ]
          }
        ],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100,
        },
      }),
    });

    let wikiTitle = null;

    if (response.ok) {
      const data = await response.json();
      const candidates = data.candidates || [];

      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            const text = part.text.trim();
            console.log('Gemini identified subject as:', text);
            if (text !== 'NO_ARTICLE' && text.length > 0 && text.length < 200) {
              wikiTitle = text;
            }
          }
        }
      }
    } else {
      console.error('Gemini Search API error:', response.status);
    }

    // Fall back to using the query directly as the Wikipedia search term
    if (!wikiTitle) {
      wikiTitle = query;
    }

    // Step 2: Search Wikimedia Commons for images (much broader than Wikipedia article thumbnails)
    const commonsSearchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(wikiTitle)}&gsrlimit=5&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
    const commonsResponse = await fetch(commonsSearchUrl, {
      headers: { 'User-Agent': 'InlayApp/1.0 (inlaynoteapp.com; image-search)' },
    });
    const commonsData = await commonsResponse.json();
    const pages = commonsData.query?.pages || {};

    // Collect valid image URLs from Commons results
    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      const imageInfo = page.imageinfo?.[0];
      if (!imageInfo) continue;

      const mime = imageInfo.mime || '';
      if (!mime.startsWith('image/')) continue;

      // Prefer the scaled-down URL (800px width) for faster loading, fall back to original
      const imageUrl = imageInfo.thumburl || imageInfo.url;
      if (imageUrl) {
        const valid = await validateImageUrl(imageUrl);
        if (valid) {
          console.log('Wikimedia Commons image found:', imageUrl);
          return new Response(JSON.stringify({ images: [{ url: imageUrl, title: page.title }] }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Step 3: Fall back to Wikipedia article summary image
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(wikiTitle)}&format=json&origin=*&srlimit=1`;
    const searchResponse = await fetch(searchUrl, {
      headers: { 'User-Agent': 'InlayApp/1.0 (inlaynoteapp.com; image-search)' },
    });
    const searchData = await searchResponse.json();
    const results = searchData.query?.search || [];

    if (results.length > 0) {
      const articleTitle = results[0].title;
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`;
      const summaryResponse = await fetch(summaryUrl, {
        headers: { 'User-Agent': 'InlayApp/1.0 (inlaynoteapp.com; image-search)' },
      });
      const summaryData = await summaryResponse.json();
      const imageUrl = summaryData.originalimage?.source || summaryData.thumbnail?.source;

      if (imageUrl) {
        const valid = await validateImageUrl(imageUrl);
        if (valid) {
          console.log('Wikipedia summary image found:', imageUrl);
          return new Response(JSON.stringify({ images: [{ url: imageUrl, title: articleTitle }] }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    console.log('No image found for:', query);
    return new Response(JSON.stringify({ images: [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Image search error:', error);
    return new Response(JSON.stringify({ error: 'Image search failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Generate an image using Google Gemini API
 * Falls back to this when web search can't find a suitable image
 */
async function handleGenerateImage(request, env) {
  const googleKey = env.GOOGLE_API_KEY;

  if (!googleKey) {
    return new Response(JSON.stringify({ error: 'Google API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { prompt } = body;
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `Generate an image of: ${prompt}` }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return new Response(JSON.stringify({ error: 'Gemini API request failed', details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // Extract image data from Gemini response
    const candidates = data.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          return new Response(JSON.stringify({
            imageData: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: 'No image generated' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return new Response(JSON.stringify({ error: 'Image generation failed' }), {
      status: 500,
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

      case '/search-image':
        return handleSearchImage(request, env);

      case '/generate-image':
        return handleGenerateImage(request, env);

      default:
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  },
};
