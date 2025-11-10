# Inigma - Secure Message Sharing Service

Inigma is an end-to-end encrypted message sharing service for securely transmitting sensitive information with automatic expiration and zero-knowledge architecture.

## Features

- **End-to-End Encryption**: Client-side AES-256-GCM encryption with PBKDF2 (800k iterations)
- **Zero-Knowledge Architecture**: Server never sees unencrypted data
- **Message Expiration**: Automatic TTL-based cleanup
- **User Ownership**: RSA key-based message management
- **Rate Limiting**: KV-based distributed rate limiting on Cloudflare Workers
- **Responsive UI**: Mobile-friendly interface with Tailwind CSS

## Architecture

```
┌─────────────┐      HTTPS/TLS      ┌──────────────┐
│   Browser   │ ◄─────────────────► │   Backend    │
│             │                      │ (Python/CF)  │
│ ┌─────────┐ │                      │              │
│ │Web Crypto│ │   Encrypted Data    │ ┌──────────┐ │
│ │  API    │ ├──────────────────────┤ │ Database │ │
│ │(AES-256)│ │                      │ │(SQLite/D1│ │
│ └─────────┘ │                      │ └──────────┘ │
│             │                      │              │
│ RSA Keys in │                      │   + KV Rate  │
│ IndexedDB   │                      │   Limiting   │
└─────────────┘                      └──────────────┘
```

**Encryption Flow:**
1. User generates RSA keypair (stored in IndexedDB, non-extractable)
2. Message encrypted with AES-256-GCM + random salt
3. Only encrypted data sent to server
4. Recipient decrypts locally with shared key

## Deployment Options

### Option 1: Docker (Local/Self-Hosted)

**Requirements:** Docker, Docker Compose

**Step-by-Step:**

```bash
# 1. Clone repository
git clone <repository-url>
cd inigma

# 2. Create data directory
mkdir -p data

# 3. Configure environment (optional)
cp .env.example .env
# Edit .env if needed (defaults work for local)

# 4. Start services
docker-compose up -d --build

# 5. Access application
open https://localhost:8443
```

**Services:**
- **Web Server**: Python FastAPI app on port 8000
- **Nginx Proxy**: HTTPS/TLS termination on ports 8080/8443
- **Database**: SQLite with persistent volume at `./data/inigma.db`

**Management:**
```bash
# View logs
docker-compose logs -f inigma

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

### Option 2: Cloudflare Workers (Production)

**Requirements:** Cloudflare account, GitHub repository

**Step-by-Step:**

```bash
# 1. Fork/clone repository
git clone <repository-url>
cd inigma

# 2. Create Cloudflare resources
# - Go to Cloudflare Dashboard → Workers & Pages → KV
# - Create KV namespace: "inigma-rate-limit"
# - Copy the namespace ID

# 3. Update wrangler.toml with your KV namespace ID
# Edit cloudflare-workers/wrangler.toml:
[[env.production.kv_namespaces]]
binding = "INIGMA_KV"
id = "YOUR_KV_NAMESPACE_ID"  # Replace with actual ID

# 4. Configure GitHub Secrets
# Go to GitHub → Settings → Secrets and variables → Actions
# Add secrets:
#   - CLOUDFLARE_API_TOKEN (with Workers/D1/KV permissions)
#   - CLOUDFLARE_ACCOUNT_ID (your account ID)

# 5. Commit and push to main branch
git add cloudflare-workers/wrangler.toml
git commit -m "config: Add KV namespace ID"
git push origin main

# 6. GitHub Actions will automatically:
#    ✓ Run D1 migrations
#    ✓ Build worker bundle
#    ✓ Deploy to Cloudflare
```

**Post-Deployment:**
- Access: `https://inigma.idone.su` (or your custom domain)
- Monitor: Cloudflare Dashboard → Workers & Pages → inigma-production → Logs
- Rate limits configured in `src/utils/rateLimit.js`

**GitHub Actions Workflow:**
- Triggers on push to `main`
- Applies D1 migrations (idempotent)
- Deploys worker with all bindings
- Typical deploy time: 2-3 minutes

## Configuration

### Docker Environment Variables

```env
# .env file (optional, has defaults)
DATABASE_PATH=./data/inigma.db
CLEANUP_DAYS=50
```

### Cloudflare Configuration

**wrangler.toml:**
- D1 Database: `inigma-database`
- KV Namespace: Configured per environment
- Custom domain: Set in Cloudflare Dashboard
- Cron cleanup: Daily at 2:00 AM UTC

**Rate Limits** (edit `src/utils/rateLimit.js`):
```javascript
const RATE_LIMITS = {
  '/api/create': { requests: 10, window: 60 },   // 10 per minute
  '/api/view': { requests: 100, window: 60 },    // 100 per minute
  '/api/delete-secret': { requests: 20, window: 60 },
  'default': { requests: 200, window: 60 }
};
```

## Security Features

### Implemented
- ✅ Client-side AES-256-GCM encryption
- ✅ PBKDF2 key derivation (800k iterations)
- ✅ RSA keypairs in IndexedDB (non-extractable)
- ✅ Rate limiting (KV-based on Cloudflare)
- ✅ CORS validation (prevents bypass attacks)
- ✅ Input validation (XSS, injection protection)
- ✅ Size limits (2MB encrypted data)
- ✅ Composite database indexes (performance)
- ✅ Security headers (CSP, X-Frame-Options, etc.)

### Architecture Notes
- **No server-side authentication**: Zero-knowledge by design
- **URL-based secrets**: Ephemeral, never logged
- **Symmetric keys**: RSA-encrypted, stored in localStorage
- **Auto-expiration**: Messages automatically cleaned up

## Development

### Local Python Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run dev server
python main.py

# Access at http://localhost:8000
```

### Local Cloudflare Workers Development
```bash
cd cloudflare-workers

# Install dependencies
npm install

# Run local dev server
npm run dev

# Build for production
npm run build
```

### Database Migrations

**Cloudflare D1:**
```bash
# Create new migration
npx wrangler d1 migrations create INIGMA_DB migration_name

# Apply migrations (production)
npx wrangler d1 migrations apply INIGMA_DB --env production --remote
```

**Local SQLite:**
Migrations auto-applied on startup in `database.py`

## Project Structure

```
inigma/
├── main.py                      # FastAPI application
├── database.py                  # SQLite/D1 database logic
├── requirements.txt             # Python dependencies
├── Dockerfile                   # Docker image
├── docker-compose.yml           # Local deployment
├── static/                      # Frontend assets
├── templates/                   # HTML templates
├── templates-modular/           # Modular template components
├── cloudflare-workers/          # Cloudflare Workers deployment
│   ├── src/
│   │   ├── index.js            # Main worker entry
│   │   ├── handlers/           # Request handlers
│   │   ├── utils/              # Utilities (rate limit, CORS, validation)
│   │   └── constants/          # Configuration
│   ├── migrations/             # D1 database migrations
│   ├── build.js                # Build script
│   ├── wrangler.toml           # Cloudflare configuration
│   └── package.json
└── .github/workflows/          # CI/CD
    └── cloudflare-deploy.yml   # Auto-deployment
```

## API Endpoints

### Message Operations
- `POST /api/create` - Create encrypted message
- `POST /api/view` - View message by ID
- `POST /api/update` - Update message TTL
- `POST /api/delete-secret` - Delete message
- `POST /api/update-custom-name` - Update message name

### User Operations
- `POST /api/list-secrets` - List user's messages
- `POST /api/list-pending-secrets` - List pending messages

All endpoints return JSON and include rate limit headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1699876543000
```

## Monitoring

### Docker Logs
```bash
docker-compose logs -f inigma
```

### Cloudflare Logs
- Dashboard → Workers & Pages → inigma-production → Logs
- Real-time logs show requests, errors, and rate limiting

### Health Check
```bash
curl https://inigma.idone.su/api/create -I
```

## Troubleshooting

**Docker: Port already in use**
```bash
# Change ports in docker-compose.yml
ports:
  - "8081:8080"  # Instead of 8080:8080
  - "8444:8443"  # Instead of 8443:8443
```

**Cloudflare: Rate limiting not working**
- Verify KV namespace ID in wrangler.toml
- Check binding in Cloudflare Dashboard → Workers → Settings → Bindings
- Review logs for "Rate limit KV not configured" warnings

**Cloudflare: Deployment fails**
- Check GitHub Secrets are set correctly
- Review GitHub Actions logs for detailed errors
- Ensure D1 database exists and ID matches wrangler.toml

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test locally
4. Submit a pull request

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/link0ln/inigma/issues)
- Security concerns: Report privately via GitHub Security tab
