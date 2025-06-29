/**
 * CORS utility functions
 */

import { ALLOWED_ORIGINS, BASE_CORS_HEADERS } from '../constants/config.js';
import { addSecurityHeaders } from './validation.js';

/**
 * Get CORS headers with proper origin checking and security headers
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  
  let corsHeaders;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    corsHeaders = {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Origin': origin,
    };
  } else {
    // Fallback for non-browser requests or allowed origins
    corsHeaders = {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0], // Default to production
    };
  }
  
  // Add security headers like in Python version
  return addSecurityHeaders(corsHeaders);
}