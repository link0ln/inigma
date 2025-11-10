# Rate Limiting Setup for Cloudflare Workers

## Overview

Rate limiting использует Cloudflare KV для хранения счётчиков запросов. Это обеспечивает:
- Глобальное состояние между всеми edge locations
- Автоматическую очистку старых записей (TTL)
- Работу на free плане Cloudflare

## Step 1: Create KV Namespaces

Создайте два KV namespace - один для development, один для production:

```bash
# Development namespace
npx wrangler kv:namespace create "RATE_LIMIT_KV" --env development

# Production namespace
npx wrangler kv:namespace create "RATE_LIMIT_KV" --env production
```

Команды выведут ID для каждого namespace. Например:
```
✨ Success! Created KV namespace inigma-RATE_LIMIT_KV-development
Add the following to your wrangler.toml:
id = "abc123def456..."
```

## Step 2: Update wrangler.toml

Замените placeholders в `wrangler.toml`:

```toml
# Development
[[env.development.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_DEV_KV_ID"  # ← Replace with actual ID

# Production
[[env.production.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_PROD_KV_ID"  # ← Replace with actual ID
```

## Step 3: Deploy

```bash
# Deploy to development
npm run deploy:development

# Deploy to production
npm run deploy:production
```

## Rate Limit Configuration

Настройки лимитов находятся в `src/utils/rateLimit.js`:

```javascript
const RATE_LIMITS = {
  '/api/create': {
    requests: 10,      // 10 сообщений
    window: 60,        // за 60 секунд
  },
  '/api/view': {
    requests: 100,     // 100 просмотров
    window: 60,        // за 60 секунд
  },
  // ... other endpoints
};
```

## Testing Rate Limits

```bash
# Test locally (without KV - rate limiting будет skip)
npm run dev

# Test on deployed worker
for i in {1..15}; do
  curl https://inigma-dev.idone.su/api/create -X POST
done
```

После 10 запросов вы получите:
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many messages created. Please wait before creating more.",
  "retryAfter": 45
}
```

## Response Headers

Все API responses включают rate limit headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1699876543000
```

## Optional: Skip Rate Limiting for Development

Если KV namespace не настроен, rate limiting автоматически отключается с warning в логах:

```
Rate limit KV not configured - skipping rate limit check
```

Это удобно для локальной разработки без необходимости настройки KV.

## Monitoring

Мониторинг rate limiting в Cloudflare Dashboard:
1. Workers & Pages → inigma → Metrics
2. Errors → Rate limit exceeded warnings
3. KV → RATE_LIMIT_KV → Keys (для debug)

## Troubleshooting

**Problem:** Rate limiting не работает
```bash
# Check KV binding
npx wrangler kv:namespace list

# Check deployment
npx wrangler tail --env production
```

**Problem:** Слишком жёсткие лимиты
```javascript
// Edit src/utils/rateLimit.js
'/api/view': {
  requests: 200,  // Увеличить лимит
  window: 60,
}
```

**Problem:** KV quota exceeded (free plan: 100k reads/day)
- Увеличьте `window` (например, с 60s до 300s)
- Уменьшите количество endpoints с rate limiting
- Upgrade to paid plan (10M reads/month)
