/**
 * Rate Limiting Middleware for Cloudflare Workers
 * Uses KV namespace for distributed rate limiting
 */

/**
 * Rate limit configuration per endpoint
 */
const RATE_LIMITS = {
  '/api/create': {
    requests: 10,      // Max requests
    window: 60,        // Time window in seconds
    message: 'Too many messages created. Please wait before creating more.'
  },
  '/api/view': {
    requests: 100,
    window: 60,
    message: 'Too many view requests. Please slow down.'
  },
  '/api/update': {
    requests: 20,
    window: 60,
    message: 'Too many update requests. Please wait.'
  },
  '/api/list-secrets': {
    requests: 50,
    window: 60,
    message: 'Too many list requests. Please wait.'
  },
  '/api/list-pending-secrets': {
    requests: 50,
    window: 60,
    message: 'Too many list requests. Please wait.'
  },
  '/api/update-custom-name': {
    requests: 30,
    window: 60,
    message: 'Too many rename requests. Please wait.'
  },
  '/api/delete-secret': {
    requests: 20,
    window: 60,
    message: 'Too many delete requests. Please wait.'
  },
  'default': {
    requests: 200,
    window: 60,
    message: 'Rate limit exceeded. Please try again later.'
  }
};

/**
 * Get rate limit key from request
 * Uses combination of IP + endpoint for granular control
 */
function getRateLimitKey(request, endpoint) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // Hash IP for privacy (optional)
  return `ratelimit:${ip}:${endpoint}`;
}

/**
 * Check and update rate limit using KV
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export async function checkRateLimit(request, env) {
  // Skip rate limiting if KV is not configured (local development)
  if (!env.INIGMA_KV) {
    console.warn('Rate limit KV not configured - skipping rate limit check');
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60000 };
  }

  const url = new URL(request.url);
  const endpoint = url.pathname;

  // Get rate limit config for this endpoint
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS['default'];

  // Generate rate limit key
  const key = getRateLimitKey(request, endpoint);

  try {
    // Get current count from KV
    const currentData = await env.INIGMA_KV.get(key, { type: 'json' });

    const now = Date.now();
    const windowMs = config.window * 1000;

    if (!currentData) {
      // First request in window
      const newData = {
        count: 1,
        resetAt: now + windowMs
      };

      // Store with TTL (auto-cleanup)
      await env.INIGMA_KV.put(key, JSON.stringify(newData), {
        expirationTtl: config.window + 10 // Add 10s buffer
      });

      return {
        allowed: true,
        remaining: config.requests - 1,
        resetAt: newData.resetAt
      };
    }

    // Check if window has expired
    if (now >= currentData.resetAt) {
      // Window expired, reset counter
      const newData = {
        count: 1,
        resetAt: now + windowMs
      };

      await env.INIGMA_KV.put(key, JSON.stringify(newData), {
        expirationTtl: config.window + 10
      });

      return {
        allowed: true,
        remaining: config.requests - 1,
        resetAt: newData.resetAt
      };
    }

    // Window still active
    if (currentData.count >= config.requests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetAt: currentData.resetAt,
        message: config.message
      };
    }

    // Increment counter
    const newData = {
      count: currentData.count + 1,
      resetAt: currentData.resetAt
    };

    await env.INIGMA_KV.put(key, JSON.stringify(newData), {
      expirationTtl: config.window + 10
    });

    return {
      allowed: true,
      remaining: config.requests - newData.count,
      resetAt: currentData.resetAt
    };

  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow request (fail open)
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60000 };
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(response, rateLimit) {
  const headers = new Headers(response.headers);

  headers.set('X-RateLimit-Limit', RATE_LIMITS[new URL(response.url).pathname]?.requests || RATE_LIMITS['default'].requests);
  headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  headers.set('X-RateLimit-Reset', rateLimit.resetAt.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(rateLimit, corsHeaders) {
  const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);

  return new Response(JSON.stringify({
    error: 'Rate limit exceeded',
    message: rateLimit.message || 'Too many requests. Please try again later.',
    retryAfter: retryAfter
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': '0',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': rateLimit.resetAt.toString(),
      ...corsHeaders
    }
  });
}
