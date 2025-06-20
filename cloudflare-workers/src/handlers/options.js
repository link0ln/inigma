/**
 * Handle OPTIONS requests (CORS preflight)
 */

import { getCorsHeaders } from '../utils/cors.js';

export function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}