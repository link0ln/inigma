/**
 * Structured JSON logger with request correlation ID.
 *
 * Workers handle concurrent requests in one isolate, so the request ID must
 * be carried by a per-request logger instance, never by module-level state.
 */

function formatLog(level, requestId, message, context) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    requestId,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  return JSON.stringify(entry);
}

/**
 * Create a logger bound to a single request's ID
 */
export function createLogger(requestId) {
  return {
    info(message, context = {}) {
      console.log(formatLog('info', requestId, message, context));
    },
    warn(message, context = {}) {
      console.warn(formatLog('warn', requestId, message, context));
    },
    error(message, context = {}) {
      console.error(formatLog('error', requestId, message, context));
    },
    debug(message, context = {}) {
      console.log(formatLog('debug', requestId, message, context));
    },
  };
}

/**
 * Generate a short unique request ID
 */
export function generateRequestId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
