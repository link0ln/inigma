/**
 * Cryptographic utility functions
 */

/**
 * Generate cryptographically secure random string
 */
export function generateRandomString(length = 25) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}