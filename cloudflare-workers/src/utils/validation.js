/**
 * Validation utility functions
 */

/**
 * Validate message ID format
 */
export function isValidMessageId(id) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Get current timestamp
 */
export function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}