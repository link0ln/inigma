/**
 * Handle GET requests
 */

import { getCorsHeaders } from '../utils/cors.js';
import { buildCspWithNonce } from '../utils/validation.js';

/**
 * Generate a cryptographic nonce for CSP and inject it into HTML
 */
function serveHtmlWithNonce(html, request) {
  const nonceBytes = new Uint8Array(24);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  const nonceHtml = html.replaceAll('__CSP_NONCE__', nonce);

  const headers = getCorsHeaders(request);
  headers['Content-Type'] = 'text/html';
  headers['Content-Security-Policy'] = buildCspWithNonce(nonce);

  return new Response(nonceHtml, { headers });
}

export async function handleGet(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/') {
      return serveHtmlWithNonce(indexHTML, request);
    }

    if (path === '/view') {
      return serveHtmlWithNonce(viewHTML, request);
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
  } catch (error) {
    console.error('Error handling GET request:', error);
    return new Response('<h1>500 Internal Server Error</h1>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}