# Rate Limiting Setup for Cloudflare Workers

## Overview

Rate limiting использует Cloudflare KV для хранения счётчиков запросов. Это обеспечивает:
- Глобальное состояние между всеми edge locations
- Автоматическую очистку старых записей (TTL)
- Работу на free плане Cloudflare

## 🛠️ Ручная настройка (Требуется)

### Шаг 1: Создать KV Namespace

Через Cloudflare Dashboard с токеном с повышенными привилегиями:

1. Зайдите в Cloudflare Dashboard → Workers & Pages → KV
2. Нажмите "Create namespace"
3. Название: `inigma-RATE_LIMIT_KV-production`
4. Скопируйте созданный **Namespace ID**

Или через CLI (если есть токен с правами):
```bash
npx wrangler kv namespace create "RATE_LIMIT_KV" --env production
# Вывод: ✨ Success! Created KV namespace ...
# Скопируйте ID из вывода
```

### Шаг 2: Обновить wrangler.toml

Откройте `cloudflare-workers/wrangler.toml` и замените `YOUR_PROD_KV_ID` на реальный ID:

```toml
[[env.production.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "abc123456789..."  # ← Ваш настоящий ID
```

### Шаг 3: Commit и Push

```bash
git add cloudflare-workers/wrangler.toml
git commit -m "chore: Configure KV namespace for rate limiting"
git push origin main
```

GitHub Actions автоматически задеплоит с rate limiting!

## Development Environment (Опционально)

Для локальной разработки можно не настраивать KV - rate limiting автоматически отключится:

```
Rate limit KV not configured - skipping rate limit check
```

Если хотите тестировать локально:
```bash
npx wrangler kv namespace create "RATE_LIMIT_KV" --env development
# Обновите [env.development.kv_namespaces] в wrangler.toml
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
# Test locally (без KV - rate limiting будет skip)
npm run dev

# Test на deployed worker
for i in {1..15}; do
  curl https://inigma.idone.su/api/create -X POST -H "Content-Type: application/json" -d '{}'
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

## Monitoring

Мониторинг rate limiting в Cloudflare Dashboard:
1. Workers & Pages → inigma → Metrics
2. Errors → Rate limit exceeded warnings
3. KV → RATE_LIMIT_KV → Keys (для debug)

## Troubleshooting

**Problem:** Rate limiting не работает
```bash
# Проверьте что KV namespace настроен в wrangler.toml
cat cloudflare-workers/wrangler.toml | grep -A 2 "kv_namespaces"

# Проверьте deployment logs
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
