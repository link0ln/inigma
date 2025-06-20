/**
 * CORS utility functions
 */

import { ALLOWED_ORIGINS, BASE_CORS_HEADERS } from '../constants/config.js';

/**
 * Get CORS headers with proper origin checking
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Origin': origin,
    };
  }
  
  // Fallback for non-browser requests or allowed origins
  return {
    ...BASE_CORS_HEADERS,
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0], // Default to production
  };
}