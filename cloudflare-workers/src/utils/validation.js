/**
 * Validation utility functions
 */

/**
 * Validate message ID format
 */
export function isValidMessageId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

/**
 * Validate UID format
 */
export function isValidUid(uid) {
  return typeof uid === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(uid);
}

/**
 * Validate custom name
 */
export function isValidCustomName(name) {
  return typeof name === 'string' && name.length <= 200;
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
 * Sanitize string to prevent XSS
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim();
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