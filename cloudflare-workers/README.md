# Inigma - Cloudflare Workers Deployment

Этот проект адаптирует Inigma для развертывания на Cloudflare Workers с использованием R2 для хранения данных.

## Подготовка к деплою

### 1. Установка Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Аутентификация в Cloudflare

```bash
wrangler login
```

### 3. Создание R2 bucket

```bash
wrangler r2 bucket create inigma-storage
```

### 4. (Опционально) Создание KV namespace для аналитики

```bash
wrangler kv:namespace create "INIGMA_KV" --env production
```

Обновите `wrangler.toml` с полученным namespace ID.

## Настройка Custom Domain

### 1. В Cloudflare Dashboard

1. Перейдите в раздел **Workers & Pages**
2. Выберите ваш worker `inigma`
3. Откройте вкладку **Settings** → **Triggers**
4. В разделе **Custom Domains** нажмите **Add Custom Domain**
5. Введите `inigma.idone.su`
6. Следуйте инструкциям для настройки DNS

### 2. DNS записи

Добавьте CNAME запись в DNS настройках домена `idone.su`:

```
CNAME inigma inigma.workers.dev
```

## Деплой

### 1. Установка зависимостей

```bash
npm install
```

### 2. Сборка проекта

```bash
npm run build
```

### 3. Деплой в production

```bash
npm run deploy:production
```

## Структура проекта

```
cloudflare-workers/
├── src/
│   └── index.js          # Основной код worker
├── build/                # Сгенерированные файлы (создается при сборке)
├── wrangler.toml         # Конфигурация Cloudflare Workers
├── package.json          # Зависимости проекта
├── build.js              # Скрипт сборки
└── README.md             # Эта инструкция
```

## Функциональность

Worker полностью воспроизводит функционал оригинального приложения:

- ✅ Создание зашифрованных сообщений
- ✅ Просмотр сообщений с проверкой доступа
- ✅ Обновление владельца сообщения
- ✅ TTL и автоматическое удаление
- ✅ Клиентское шифрование AES-256-GCM
- ✅ Автоматическая очистка старых сообщений (cron)

## Отличия от оригинальной версии

1. **Хранилище**: Вместо локальных файлов используется R2
2. **Очистка**: Выполняется по расписанию через Cron Triggers
3. **Статические файлы**: Встроены в worker code
4. **CORS**: Предварительно настроен для работы с фронтендом

## Мониторинг и логи

Просмотр логов:

```bash
wrangler tail --env production
```

## Troubleshooting

### Проблема с CORS

Если возникают проблемы с CORS, проверьте настройки в `src/index.js`:

```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

### Проблемы с R2

Убедитесь, что R2 bucket создан и правильно настроен в `wrangler.toml`.

### Проблемы с доменом

Проверьте настройки DNS и убедитесь, что домен проксируется через Cloudflare.
