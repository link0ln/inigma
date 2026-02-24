/**
 * Structured JSON logger with request correlation ID
 */

let _requestId = null;

export function setRequestId(id) {
  _requestId = id;
}

function formatLog(level, message, context) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: _requestId,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  return JSON.stringify(entry);
}

export const logger = {
  info(message, context = {}) {
    console.log(formatLog('info', message, context));
  },
  warn(message, context = {}) {
    console.warn(formatLog('warn', message, context));
  },
  error(message, context = {}) {
    console.error(formatLog('error', message, context));
  },
  debug(message, context = {}) {
    console.log(formatLog('debug', message, context));
  },
};

/**
 * Generate a short unique request ID
 */
export function generateRequestId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
