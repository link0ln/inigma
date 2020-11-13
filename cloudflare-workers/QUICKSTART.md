# Быстрый старт - Деплой Inigma в Cloudflare Workers

## Предварительные требования

1. Аккаунт Cloudflare
2. Домен `idone.su` должен быть добавлен в Cloudflare
3. Node.js и npm установлены

## Деплой за 5 минут

### 1. Установка и настройка

```bash
# Установить Wrangler CLI
npm install -g wrangler

# Войти в аккаунт Cloudflare
wrangler login

# Перейти в папку проекта
cd cloudflare-workers
```

### 2. Автоматический деплой

```bash
# Запустить автоматический деплой
./deploy.sh production
```

Этот скрипт автоматически:
- Установит зависимости
- Соберет проект
- Создаст R2 bucket
- Задеплоит worker

### 3. Настройка домена

1. Откройте [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Перейдите в **Workers & Pages** → **inigma**
3. Откройте **Settings** → **Triggers**
4. В разделе **Custom Domains** нажмите **Add Custom Domain**
5. Введите `inigma.idone.su` и подтвердите

### 4. Проверка

Откройте https://inigma.idone.su - приложение должно работать!

## Полезные команды

```bash
# Просмотр логов
./dev.sh logs

# Локальное тестирование
./dev.sh test

# Просмотр объектов в R2
./dev.sh r2-list
```

## Структура URL

- `https://inigma.idone.su/` - Главная страница (создание сообщений)
- `https://inigma.idone.su/view` - Страница просмотра сообщений
- `https://inigma.idone.su/view?id=MESSAGE_ID` - Прямая ссылка на сообщение

## Что дальше?

Ваше приложение готово к использованию! Все функции оригинального Inigma работают:

✅ Клиентское шифрование AES-256-GCM
✅ Безопасное хранение в R2  
✅ Автоматическое удаление по TTL
✅ Множественное открытие сообщений
✅ Система владения сообщениями

При возникновении проблем см. [README.md](README.md) или [API.md](API.md).
