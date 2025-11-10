/**
 * Inigma - Secure Message Sharing Service
 * Cloudflare Workers Implementation (Modular Version)
 */

import { handleOptions } from './handlers/options.js';
import { handleGet } from './handlers/get.js';
import { handlePost } from './handlers/post.js';
import { cleanupOldMessages } from './utils/database.js';
import { getCorsHeaders } from './utils/cors.js';
import { checkRateLimit, addRateLimitHeaders, createRateLimitResponse } from './utils/rateLimit.js';

/**
 * Handle scheduled events (cleanup) - like Python cron job
 */
async function handleScheduled(event, env, ctx) {
  console.log('Running scheduled cleanup job...');
  ctx.waitUntil(cleanupOldMessages(env));
}

/**
 * Main worker handler
 */
export default {
  async fetch(request, env, ctx) {
    const method = request.method;
    const url = new URL(request.url);

    // OPTIONS requests bypass rate limiting
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Apply rate limiting to all API endpoints
    if (url.pathname.startsWith('/api/')) {
      const rateLimit = await checkRateLimit(request, env);

      if (!rateLimit.allowed) {
        console.warn(`Rate limit exceeded for ${url.pathname} from ${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
        return createRateLimitResponse(rateLimit, getCorsHeaders(request));
      }

      // Process request
      let response;
      if (method === 'GET') {
        response = await handleGet(request, env);
      } else if (method === 'POST') {
        response = await handlePost(request, env);
      } else {
        return new Response('Method not allowed', {
          status: 405,
          headers: getCorsHeaders(request),
        });
      }

      // Add rate limit headers to successful responses
      return addRateLimitHeaders(response, rateLimit);
    }

    // Non-API routes (HTML pages) - no rate limiting
    if (method === 'GET') {
      return await handleGet(request, env);
    }

    if (method === 'POST') {
      return await handlePost(request, env);
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: getCorsHeaders(request),
    });
  },
  
  async scheduled(event, env, ctx) {
    return await handleScheduled(event, env, ctx);
  },
};

// HTML templates and static files will be injected during build process
// ${TEMPLATE_PLACEHOLDER}