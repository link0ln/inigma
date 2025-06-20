/**
 * Configuration constants for Inigma Cloudflare Workers
 */

// Allowed origins for CORS
export const ALLOWED_ORIGINS = [
  'https://inigma.idone.su',  // Production domain
  'http://localhost:8000',    // Local development
  'http://127.0.0.1:8000',   // Alternative local
];

// Base CORS headers
export const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Default cleanup days for old messages
export const DEFAULT_CLEANUP_DAYS = 50;

// Default message TTL for permanent messages
export const PERMANENT_TTL = 9999999999;