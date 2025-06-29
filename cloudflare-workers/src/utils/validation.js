/**
 * Validation utility functions
 */

/**
 * Validate message ID format (matching Python version)
 */
export function isValidMessageId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,50}$/.test(id);
}

/**
 * Validate UID format
 */
export function isValidUid(uid) {
  return typeof uid === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(uid);
}

/**
 * Validate custom name (matching Python version)
 */
export function isValidCustomName(name) {
  return typeof name === 'string' && name.length <= 100;
}

/**
 * Validate encrypted data format and size
 */
export function isValidEncryptedData(data) {
  return typeof data === 'string' && data.length > 0 && data.length <= 2000000; // 2MB limit
}

/**
 * Validate IV format (base64)
 */
export function isValidIv(iv) {
  return typeof iv === 'string' && /^[A-Za-z0-9+/=]{1,64}$/.test(iv);
}

/**
 * Validate salt format (base64)
 */
export function isValidSalt(salt) {
  return typeof salt === 'string' && /^[A-Za-z0-9+/=]{1,128}$/.test(salt);
}

/**
 * Validate and sanitize pagination parameters
 */
export function validatePagination(page, perPage) {
  const validPage = Math.max(1, Math.min(parseInt(page) || 1, 1000));
  const validPerPage = Math.max(1, Math.min(parseInt(perPage) || 10, 100));
  return { page: validPage, perPage: validPerPage };
}

/**
 * Sanitize string to prevent XSS (matching Python version)
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  
  // Remove HTML tags and dangerous characters like in Python version
  let sanitized = str.replace(/<[^>]*>/g, ''); // Remove HTML tags
  sanitized = sanitized.replace(/[<>"'/\\]/g, ''); // Remove dangerous chars
  sanitized = sanitized.trim();
  
  return sanitized.slice(0, 100); // Limit to 100 characters like Python
}

/**
 * Add security headers to response (matching Python version)
 */
export function addSecurityHeaders(headers = {}) {
  return {
    ...headers,
    "Content-Security-Policy": 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com; " +
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; " +
      "font-src 'self' https://cdnjs.cloudflare.com; " +
      "img-src 'self' data:; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "object-src 'none'; " +
      "base-uri 'self'",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-XSS-Protection": "1; mode=block"
  };
}

/**
 * Sanitize text input to prevent XSS (matching Python version exactly)
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') {
    return "";
  }
  
  // HTML escape the text (basic implementation)
  let sanitized = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // Remove any remaining dangerous characters
  sanitized = sanitized.replace(/[<>"/\\]/g, '');
  
  return sanitized.slice(0, 1000); // Limit length to 1000 like Python
}

/**
 * Validate TTL value
 */
export function isValidTtl(ttl) {
  const numTtl = parseInt(ttl);
  return !isNaN(numTtl) && numTtl >= 0 && numTtl <= 365; // Max 365 days
}

/**
 * Get current timestamp
 */
export function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Calculate time remaining for a secret with smart formatting
 * Returns object with time remaining and formatted display string
 * (matching Python version exactly)
 */
export function calculateTimeRemaining(ttl, currentTime) {
  if (ttl === 9999999999) {
    return {
      value: -1,
      display: "Permanent",
      type: "permanent"
    };
  }
  
  const secondsRemaining = Math.max(0, ttl - currentTime);
  const hoursRemaining = Math.floor(secondsRemaining / (60 * 60));
  const daysRemaining = Math.floor(secondsRemaining / (24 * 60 * 60));
  
  if (secondsRemaining === 0) {
    return {
      value: 0,
      display: "Expired",
      type: "expired"
    };
  }
  
  if (daysRemaining >= 1) {
    return {
      value: daysRemaining,
      display: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      type: "days"
    };
  } else if (hoursRemaining >= 1) {
    return {
      value: hoursRemaining,
      display: `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}`,
      type: "hours"
    };
  } else {
    const minutesRemaining = Math.max(1, Math.floor(secondsRemaining / 60));
    return {
      value: minutesRemaining,
      display: `${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'}`,
      type: "minutes"
    };
  }
}