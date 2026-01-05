/**
 * API Configuration
 * 
 * Copy this file to api.js and configure your settings.
 * 
 * Option A: Backend Proxy (Recommended for distribution)
 * - Deploy the Cloudflare Worker in /backend
 * - Set PROXY_URL to your worker URL
 * - Users won't need to enter API keys
 * 
 * Option B: Direct API (Development/Personal use)
 * - Leave PROXY_URL as null
 * - Users enter their own OpenRouter API key in the app
 */

// Set this to your deployed Cloudflare Worker URL for proxy mode
// Example: 'https://writer-app-proxy.your-subdomain.workers.dev'
// Leave as null to use direct OpenRouter API (requires user API key)
export const PROXY_URL = null;

// OpenRouter direct API URL (fallback when no proxy)
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

// Get the base URL for API calls
export const getApiBaseUrl = () => {
  return PROXY_URL || OPENROUTER_URL;
};

// Check if we're using proxy mode (no API key needed from user)
export const isProxyMode = () => {
  return PROXY_URL !== null;
};
