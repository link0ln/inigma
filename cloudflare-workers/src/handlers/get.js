/**
 * Handle GET requests
 */

import { getCorsHeaders } from '../utils/cors.js';

export async function handleGet(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  if (path === '/') {
    return new Response(indexHTML, {
      headers: {
        'Content-Type': 'text/html',
        ...getCorsHeaders(request),
      },
    });
  }
  
  if (path === '/view') {
    return new Response(viewHTML, {
      headers: {
        'Content-Type': 'text/html',
        ...getCorsHeaders(request),
      },
    });
  }
  
  if (path === '/health') {
    return new Response(JSON.stringify({ status: 'healthy' }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  if (path === '/version') {
    return new Response(JSON.stringify(VERSION_INFO, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    });
  }

  // Serve static files (fallback crypto)
  if (path === '/static/fallback-crypto.js') {
    return new Response(fallbackCryptoJS, {
      headers: {
        'Content-Type': 'application/javascript',
        ...getCorsHeaders(request),
      },
    });
  }
  
  return new Response('Not Found', { 
    status: 404,
    headers: getCorsHeaders(request),
  });
}