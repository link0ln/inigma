# Inigma

Zero-knowledge encrypted message sharing. Messages are encrypted client-side with AES-256-GCM (PBKDF2 800k iterations); the server never sees plaintext. Decryption keys are passed via URL fragments (`#key=...`), which browsers don't send to the server.

## Features

- **Zero-Knowledge Encryption**: AES-256-GCM + PBKDF2 (800k iterations), entirely client-side
- **Key Fragment Delivery**: Decryption keys in URL hash — never sent to the server
- **RSA Key Pairs**: Non-extractable RSA-OAEP 2048-bit keys stored in IndexedDB
- **Message Expiration**: TTL-based expiration with automatic cleanup
- **Ownership Transfer**: Unclaimed secrets can be claimed by the first viewer
- **Custom Names**: Optional labels for organizing secrets
- **Nonce-Based CSP**: Strict Content Security Policy without `unsafe-inline` or `unsafe-eval`
- **Distroless Container**: Minimal attack surface — no shell, no package manager

## Quick Start

### Docker Compose with Cloudflare Tunnel (Production)

```bash
cp .env.example .env
# Edit .env: set CF_DOMAIN, CF_TUNNEL_TOKEN, DOMAIN, CORS_ORIGINS

docker-compose up --build -d
```

This starts three services on an internal Docker network:
- `app` — FastAPI backend (distroless container, port 8000 internal)
- `nginx` — reverse proxy with rate limiting and security headers (port 80 internal)
- `cloudflared` — Cloudflare Tunnel for HTTPS ingress

No ports are published to the host. All traffic flows through the Cloudflare Tunnel.

### Local Development

```bash
pip install -r requirements.txt
python main.py
# Access at http://localhost:8000
```

## Architecture

### Dual Backend

Two independent backends implement the same API and share the same frontend templates:

| | Python/FastAPI | Cloudflare Workers |
|---|---|---|
| **Runtime** | Docker (self-hosted) | Cloudflare edge (serverless) |
| **Database** | SQLite | D1 + KV |
| **Entry point** | `main.py` | `cloudflare-workers/src/index.js` |
| **Template resolution** | Python at serve time | `build.js` at build time |

### Network Topology (Docker)

```
Internet → Cloudflare Tunnel → nginx (rate limiting, headers) → FastAPI app → SQLite
```

All containers run on an isolated Docker bridge network. The app container is read-only with a single writable volume for the SQLite database.

### Security Model

- All encryption/decryption happens client-side via Web Crypto API
- Server stores only ciphertext, IV, and salt — never plaintext or keys
- User identity derived from symmetric key: `SHA-256(key)[:12]` → UID
- RSA key pair (non-extractable) stored in IndexedDB; encrypted symmetric key in localStorage
- Nonce-based Content Security Policy (no `unsafe-inline`, no `unsafe-eval`)
- Alpine.js CSP build for eval-free reactivity

### Container Hardening

- **Distroless base**: `gcr.io/distroless/python3-debian12:nonroot` — no shell, no coreutils, no package manager
- **Non-root user**: Runs as uid 65534 (`nonroot`)
- **Read-only filesystem**: `read_only: true` in docker-compose; only `/app/data` is writable (SQLite volume)
- **No privilege escalation**: `no-new-privileges: true`
- **No bytecode**: `PYTHONDONTWRITEBYTECODE=1` prevents writes to read-only FS
- **Multi-stage build**: TailwindCSS compiled at build time (node stage), Python deps installed separately, only artifacts copied to final image

## API Endpoints

All mutations use POST.

| Endpoint | Description |
|---|---|
| `POST /api/create` | Create encrypted message |
| `POST /api/view` | Retrieve message (requires UID if owned) |
| `POST /api/update` | Claim ownership (re-encrypt with owner's key) |
| `POST /api/list-secrets` | List owned secrets with pagination |
| `POST /api/list-pending-secrets` | List unclaimed secrets by creator |
| `POST /api/update-custom-name` | Update secret label |
| `POST /api/delete-secret` | Delete secret |
| `GET /health` | Health check |

### Database Schema

```sql
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    ttl INTEGER NOT NULL,
    uid TEXT NOT NULL DEFAULT '',
    encrypted_message TEXT NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    custom_name TEXT DEFAULT '',
    creator_uid TEXT DEFAULT '',
    created_at INTEGER NOT NULL
);
```

## Testing

Integration tests run the Python backend in Docker and exercise all API endpoints with a Python crypto client that replicates the browser-side encryption.

```bash
# Install test dependencies
pip install -r tests/requirements.txt

# Run all 30 tests (starts Docker automatically, tears down after)
pytest tests/ -v

# Run a specific test group
pytest tests/test_integration.py -v -k "test_create"
```

Tests use `tests/docker-compose.test.yaml`, which publishes port 8000 to the host (unlike production compose which uses only internal networking).

### Test Coverage

- Health check
- Create & view with various TTL values (default, custom, permanent)
- Ownership flow (claim, double-claim rejection, owner-only access)
- List & pagination (owned, pending, page navigation)
- Delete (owned, pending, wrong-user rejection)
- Custom name updates
- Idempotent creation
- Input validation (invalid base64, bad UID format, nonexistent messages)
- Multiple reads of same secret
- Unicode content (Cyrillic, emoji, CJK)
- Full sender → recipient flow

## Deployment Options

### 1. Docker Compose + Cloudflare Tunnel (Recommended)

See [Quick Start](#quick-start) above. Requires a Cloudflare Tunnel token.

### 2. Cloudflare Workers (Serverless)

```bash
cd cloudflare-workers/
npm install
npm run build
npm run deploy:production
```

See [`cloudflare-workers/README.md`](cloudflare-workers/README.md) for details.

### 3. Kubernetes

```bash
helm install inigma ./helm/
helm upgrade inigma ./helm/
```

## File Structure

```
inigma/
├── main.py                     # FastAPI application
├── database.py                 # SQLite operations + TTL cleanup
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Multi-stage distroless build
├── Dockerfile.nginx            # Nginx reverse proxy
├── docker-compose.yaml         # Production: app + nginx + cloudflared
├── nginx.conf                  # Rate limiting, security headers, proxy
├── .env.example                # Environment template
├── templates-modular/          # Shared frontend templates
│   ├── pages/                  # Main HTML pages
│   ├── components/             # Reusable UI components
│   ├── scripts/                # JavaScript modules
│   │   ├── crypto-functions.js # RSA + AES + PBKDF2 crypto
│   │   ├── main-app.js         # Alpine.js app (main page)
│   │   ├── view-app.js         # Alpine.js app (view page)
│   │   ├── security-utils.js   # XSS prevention, rate limiting
│   │   └── security-hardening.js
│   └── styles/                 # CSS (Tailwind compiled at build)
├── tests/                      # Integration test suite
│   ├── conftest.py             # Docker fixtures (session-scoped)
│   ├── crypto_client.py        # Python AES-256-GCM + PBKDF2 client
│   ├── test_integration.py     # 30 API tests
│   ├── docker-compose.test.yaml
│   └── requirements.txt
├── cloudflare-workers/         # Serverless Workers deployment
│   ├── src/                    # Worker source code
│   ├── build.js                # Custom bundler
│   ├── schema.sql              # D1 schema
│   └── migrations/             # D1 migrations
└── helm/                       # Kubernetes Helm charts
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Application server port |
| `DOMAIN` | — | Domain for generated links (e.g. `inigma.example.com`) |
| `CORS_ORIGINS` | — | Allowed CORS origins (e.g. `https://inigma.example.com`) |
| `CF_DOMAIN` | — | Cloudflare Tunnel domain |
| `CF_TUNNEL_TOKEN` | — | Cloudflare Tunnel authentication token |

## Troubleshooting

**Web Crypto API Not Available**
- Requires HTTPS or localhost. Cloudflare Tunnel provides HTTPS automatically.

**Database Issues**
- SQLite file stored in Docker volume `app-data` mounted at `/app/data`
- Check volume exists: `docker volume ls | grep app-data`

**Container won't start**
- Distroless has no shell — you cannot `docker exec -it ... sh`
- Debug with: `docker logs <container>`

### Logs

```bash
docker-compose logs -f         # All services
docker-compose logs -f app     # FastAPI only
docker-compose logs -f nginx   # Nginx only
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `pytest tests/ -v`
4. Submit a pull request

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.

### GNU General Public License v3.0

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

### Key Points

- **Freedom to use**: You can use this software for any purpose
- **Freedom to study**: You can study how the program works and adapt it to your needs
- **Freedom to share**: You can redistribute copies to help others
- **Freedom to improve**: You can improve the program and release your improvements to the public

### Commercial Use

This software can be used commercially, but any modifications or derivative works must also be released under the GPL-3.0 license (copyleft provision).

For the full license text, see the [LICENSE](LICENSE) file in this repository or visit <https://www.gnu.org/licenses/gpl-3.0.html>.