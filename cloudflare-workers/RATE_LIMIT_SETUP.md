# Rate Limiting Setup for Cloudflare Workers

## Overview

Rate limiting uses Cloudflare KV to store request counters. This provides:
- Global state shared across all edge locations
- Automatic expiry of old entries (TTL)
- Operation on Cloudflare's free plan

> **Binding name:** `INIGMA_KV`. The same namespace also backs the idempotency
> cache for the `/api/create` endpoint.

## Current status

**Production is already configured** — the `INIGMA_KV` namespace is set in
`wrangler.toml`:

```toml
[[env.production.kv_namespaces]]
binding = "INIGMA_KV"
id = "32a3b5af57e14ad99d07ac3965957fee"
```

No further action is needed for production. The sections below are only
relevant when bringing up an environment from scratch or enabling KV for dev.

## Creating a KV namespace from scratch

### Step 1: Create the namespace

Via CLI (requires a token with Workers KV permissions):

```bash
npx wrangler kv namespace create "INIGMA_KV" --env production
# ✨ Success! Created KV namespace ...
# Copy the id from the output
```

Or via Dashboard → Workers & Pages → KV → Create namespace.

### Step 2: Update wrangler.toml

```toml
[[env.production.kv_namespaces]]
binding = "INIGMA_KV"
id = "<your-namespace-id>"
```

### Step 3: Commit and push

```bash
git add cloudflare-workers/wrangler.toml
git commit -m "chore: configure INIGMA_KV namespace"
git push origin main
```

GitHub Actions deploys the change automatically (see `AUTOMATED_DEPLOYMENT.md`).

## Development environment (optional)

KV is **not configured** for dev by default (the
`[[env.development.kv_namespaces]]` block in `wrangler.toml` is commented out).
In that case rate limiting simply disables itself with a log warning — and so
does the idempotency cache:

```
Rate limit KV not configured - skipping rate limit check
```

To enable KV for dev:

```bash
npx wrangler kv namespace create "INIGMA_KV" --env development
# uncomment [[env.development.kv_namespaces]] and fill in the id
```

## Rate limit configuration

Limits live in `src/utils/rateLimit.js`:

```javascript
const RATE_LIMITS = {
  '/api/create': { requests: 10,  window: 60 },  // 10 messages / min
  '/api/view':   { requests: 100, window: 60 },  // 100 views / min
  // ... other endpoints, plus 'default': 200/min
};
```

> **Limitation:** KV is an eventually-consistent read-modify-write store with no
> CAS, so concurrent or geographically distributed requests can briefly exceed
> the limit, and on a KV error the limiter fails open (lets the request
> through). It is a soft limiter against accidental bursts, not a hard
> brute-force defense. For strict guarantees use a Durable Object.

## Testing rate limits

```bash
# Locally (no KV — rate limiting is skipped)
npm run dev

# Against the deployed worker
for i in {1..15}; do
  curl https://inigma.idone.su/api/create -X POST \
    -H "Content-Type: application/json" -d '{}'
done
```

After 10 requests:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many messages created. Please wait before creating more.",
  "retryAfter": 45
}
```

## Response headers

All API responses include rate limit headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1699876543000
```

## Monitoring

Cloudflare Dashboard:
1. Workers & Pages → inigma → Metrics
2. Errors → Rate limit exceeded warnings
3. KV → INIGMA_KV → Keys (for debugging)

## Troubleshooting

**Rate limiting is not working**

```bash
# Check that the namespace is configured in wrangler.toml
grep -A2 "kv_namespaces" cloudflare-workers/wrangler.toml

# Deployment logs
npx wrangler tail --env production
```

**Limits are too strict** — increase `requests`/`window` in `src/utils/rateLimit.js`.

**KV quota exceeded** (free plan: 100k reads/day) — increase `window`, reduce
the number of rate-limited endpoints, or upgrade to a paid plan.
