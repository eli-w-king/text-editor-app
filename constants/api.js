/**
 * API Configuration
 * 
 * Set PROXY_URL to your deployed Cloudflare Worker URL for production use.
 * When PROXY_URL is set, users don't need to enter their own API key.
 * 
 * Leave as null to use direct OpenRouter API (requires user API key).
 */

// Your deployed Cloudflare Worker URL
export const PROXY_URL = 'https://writer-app-proxy.inlaynoteapp.workers.dev';

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
