/**
 * Inigma - Secure Message Sharing Service
 * Cloudflare Workers Implementation (Modular Version)
 */

import { handleOptions } from './handlers/options.js';
import { handleGet } from './handlers/get.js';
import { handlePost } from './handlers/post.js';
import { cleanupOldMessages } from './utils/database.js';
import { getCorsHeaders } from './utils/cors.js';

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
    
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }
    
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