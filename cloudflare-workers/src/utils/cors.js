/**
 * CORS utility functions
 */

import { ALLOWED_ORIGINS, BASE_CORS_HEADERS } from '../constants/config.js';
import { addSecurityHeaders } from './validation.js';

/**
 * Validate origin format to prevent CORS bypass attacks
 * Checks for null origin, suspicious patterns, etc.
 */
function isValidOrigin(origin) {
  if (!origin || typeof origin !== 'string') {
    return false;
  }

  // Reject null origin (file://, data:, etc.)
  if (origin === 'null') {
    console.warn('Rejected null origin');
    return false;
  }

  // Must be a valid URL
  try {
    const url = new URL(origin);

    // Only allow http and https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      console.warn(`Rejected non-HTTP(S) origin: ${url.protocol}`);
      return false;
    }

    // Reject IP addresses in origin (potential bypass)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(url.hostname) && !url.hostname.includes('127.0.0.1') && !url.hostname.includes('localhost')) {
      console.warn(`Rejected IP-based origin: ${url.hostname}`);
      return false;
    }

    // Reject suspicious TLDs often used in attacks
    const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq'];
    if (suspiciousTLDs.some(tld => url.hostname.endsWith(tld))) {
      console.warn(`Rejected suspicious TLD origin: ${url.hostname}`);
      return false;
    }

    return true;
  } catch (e) {
    console.warn(`Invalid origin URL format: ${origin}`);
    return false;
  }
}

/**
 * Get CORS headers with proper origin checking and security headers
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');

  let corsHeaders;

  // Validate and check origin against whitelist
  if (origin && isValidOrigin(origin) && ALLOWED_ORIGINS.includes(origin)) {
    // Origin is valid and in whitelist
    corsHeaders = {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Origin': origin,
    };
  } else {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      console.warn(`Origin not in whitelist: ${origin}`);
    }

    // Fallback for non-browser requests or disallowed origins
    // Don't set specific origin - this will block cross-origin requests
    corsHeaders = {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0], // Default to production
    };
  }

  // Add security headers like in Python version
  return addSecurityHeaders(corsHeaders);
}