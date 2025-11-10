# Rate Limiting Setup for Cloudflare Workers

## Overview

Rate limiting использует Cloudflare KV для хранения счётчиков запросов. Это обеспечивает:
- Глобальное состояние между всеми edge locations
- Автоматическую очистку старых записей (TTL)
- Работу на free плане Cloudflare

## ✅ Автоматическая настройка (Рекомендуется)

**Всё настраивается автоматически через GitHub Actions!**

При каждом push в `main` branch, GitHub Actions workflow автоматически:
1. ✅ Проверяет существование KV namespace
2. ✅ Создаёт KV namespace если не существует
3. ✅ Обновляет `wrangler.toml` с правильным ID
4. ✅ Применяет D1 миграции (composite indexes)
5. ✅ Деплоит worker на Cloudflare

**Никаких ручных шагов не требуется!**

### Что нужно:

Только убедиться что в GitHub Secrets настроены:
- `CLOUDFLARE_API_TOKEN` - API token с правами Workers и KV
- `CLOUDFLARE_ACCOUNT_ID` - ваш Account ID

### Проверка deployment:

После merge в `main` или ручного запуска workflow через Actions → Deploy to Cloudflare Workers → Run workflow

Логи покажут:
```
Checking for existing KV namespace...
Found existing KV namespace with ID: abc123...
Updating wrangler.toml with KV namespace ID: abc123...
Applying D1 migrations...
✨ Successfully deployed!
```

## 🛠️ Ручная настройка (Опционально)

Если хотите настроить локально для development:

```bash
# Development namespace (один раз)
npx wrangler kv namespace create "RATE_LIMIT_KV" --env development

# Раскомментировать в wrangler.toml и вставить ID
# [[env.development.kv_namespaces]]
# binding = "RATE_LIMIT_KV"
# id = "YOUR_DEV_KV_ID"
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
