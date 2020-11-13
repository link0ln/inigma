# Inigma API Documentation

## Endpoints

### GET /

Возвращает главную страницу приложения для создания сообщений.

**Response**: HTML страница

---

### GET /view

Возвращает страницу для просмотра сообщений.

**Response**: HTML страница

---

### POST /api/create

Создает новое зашифрованное сообщение.

**Request Body**:
```json
{
  "encrypted_message": "string", // Зашифрованное сообщение (обязательно)
  "encrypted": "true",           // Всегда "true" для зашифрованных сообщений
  "iv": "string",               // Initialization Vector для AES (обязательно)
  "salt": "string",             // Соль для ключа (обязательно)
  "ttl": 30,                    // Время жизни в днях (по умолчанию 30, 0 = бессрочно)
  "multiopen": true             // Разрешить множественное открытие (по умолчанию true)
}
```

**Response**:
```json
{
  "url": "https://inigma.idone.su/",
  "view": "message_id"
}
```

---

### POST /api/view

Получает зашифрованное сообщение для просмотра.

**Request Body**:
```json
{
  "view": "string",  // ID сообщения (обязательно)
  "uid": "string"    // ID пользователя для проверки доступа (обязательно)
}
```

**Success Response**:
```json
{
  "multiopen": true,
  "ttl": 1234567890,
  "uid": "user_id",
  "encrypted": "true",
  "encrypted_message": "encrypted_content",
  "message": "",
  "iv": "initialization_vector",
  "salt": "key_salt"
}
```

**Error Responses**:
```json
{
  "message": "No such hash!",
  "redirect_root": "true"
}
```

```json
{
  "message": "Message has expired!",
  "redirect_root": "true"
}
```

```json
{
  "message": "Access denied!",
  "redirect_root": "true"
}
```

---

### POST /api/update

Обновляет владельца сообщения (принимает владение).

**Request Body**:
```json
{
  "view": "string",              // ID сообщения (обязательно)
  "uid": "string",               // Новый ID владельца (обязательно)
  "encrypted_message": "string", // Новое зашифрованное сообщение (обязательно)
  "iv": "string",               // Новый IV (обязательно)
  "salt": "string"              // Новая соль (обязательно)
}
```

**Success Response**:
```json
{
  "status": "success",
  "message": "secret owned"
}
```

**Error Responses**:
```json
{
  "status": "failed",
  "message": "No such secret"
}
```

```json
{
  "status": "failed",
  "message": "Secret already owned"
}
```

---

### GET /health

Проверка здоровья сервиса.

**Response**:
```json
{
  "status": "healthy"
}
```

---

### GET /static/fallback-crypto.js

Возвращает JavaScript файл с резервными криптографическими функциями.

**Response**: JavaScript код

## Шифрование

Приложение использует клиентское шифрование AES-256-GCM:

1. **Генерация ключа**: На основе пароля пользователя и соли (PBKDF2)
2. **Шифрование**: AES-256-GCM с случайным IV
3. **Хранение**: В R2 хранится только зашифрованное сообщение, IV и соль

## Безопасность

- Все сообщения шифруются на клиенте
- Сервер никогда не имеет доступа к незашифрованным данным
- Автоматическое удаление сообщений по истечении TTL
- CORS настроен для безопасной работы с фронтендом

## Лимиты

- Максимальный размер сообщения: ограничен размером R2 объекта (до 5 ТБ)
- TTL: от 1 дня до бессрочного хранения
- Автоматическая очистка: ежедневно в 2:00 UTC
