# Inigma API Documentation

## Endpoints

### GET /

Returns main application page for creating messages.

**Response**: HTML page

---

### GET /view

Returns page for viewing messages.

**Response**: HTML page

---

### POST /api/create

Creates new encrypted message.

**Request Body**:
```json
{
  "encrypted_message": "string",
  "encrypted": "true",
  "iv": "string",
  "salt": "string",
  "ttl": 30,
  "multiopen": true,
  "custom_name": "string"
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

Retrieves encrypted message for viewing.

**Request Body**:
```json
{
  "view": "string",
  "uid": "string"
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

Updates message owner (takes ownership).

**Request Body**:
```json
{
  "view": "string",
  "uid": "string",
  "encrypted_message": "string",
  "iv": "string",
  "salt": "string"
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

Service health check.

**Response**:
```json
{
  "status": "healthy"
}
```

---

### GET /static/fallback-crypto.js

Returns JavaScript file with fallback cryptographic functions.

**Response**: JavaScript code

## Security

- All messages are encrypted client-side using AES-256-GCM
- Server never has access to unencrypted data
- PBKDF2 key derivation with random salt and IV
- Automatic TTL-based message expiration
- CORS configured for secure frontend operation
