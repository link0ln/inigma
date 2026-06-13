# Inigma - Cloudflare Workers Deployment

This directory contains the Cloudflare Workers implementation of Inigma, a secure message sharing application with end-to-end encryption. This serverless deployment leverages Cloudflare's global edge network and D1 database.

## Features

- **Global Edge Deployment**: Runs on Cloudflare's worldwide network
- **D1 Database**: Encrypted messages stored in Cloudflare D1
- **Automatic Scaling**: Serverless architecture with built-in scaling
- **Custom Domain Support**: Deploy on your own domain
- **Zero Maintenance**: No server management required
- **Same Security**: Identical client-side encryption as the main app

## Production Instance

🌐 **Live Demo**: [https://inigma.idone.su](https://inigma.idone.su)

## Quick Start

### Prerequisites

- Cloudflare account with Workers and D1 enabled
- Node.js 18+ installed
- Wrangler CLI installed globally

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create D1 Databases

Production and development use **separate** D1 databases so that dev deploys
and the dev cleanup cron never touch production data:

```bash
wrangler d1 create inigma-database       # production
wrangler d1 create inigma-database-dev   # development
```

Put the returned `database_id` values into `wrangler.toml` under
`[[env.production.d1_databases]]` and `[[env.development.d1_databases]]`
respectively, then apply the schema to each:

```bash
wrangler d1 execute inigma-database     --file=schema.sql --remote
wrangler d1 execute inigma-database-dev --file=schema.sql --remote
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Deploy

#### Development Environment
Deploy to development environment (inigma-dev.idone.su):

```bash
npm run deploy:development
# or
npx wrangler deploy --env development
```

#### Production Environment
Deploy to production environment (inigma.idone.su):

```bash
npm run deploy:production
# or
npx wrangler deploy --env production
```

## Environments

### Development
- **URL**: https://inigma-dev.idone.su
- **Database**: `inigma-database-dev` — separate D1 instance, isolated from production
- **Purpose**: Testing new features before production release

### Production
- **URL**: https://inigma.idone.su
- **Database**: `inigma-database` — main D1 instance
- **Purpose**: Live production instance

> **Note:** Dev and production previously shared one D1 database, which meant
> the dev cleanup cron operated on production data. They are now fully separate.
> The CI workflow (`.github/workflows/cloudflare-deploy.yml`) deploys **production
> only** — dev is deployed manually with `npm run deploy:development`.

## Development

### Local Development

```bash
# Build and start local development server
npm run dev

# Access at http://localhost:8787
```

### Build Only

```bash
npm run build
```

### View Logs

```bash
wrangler tail --env production
```

## Configuration

### Environment Setup

The deployment uses `wrangler.toml` for configuration with separate environments:

#### Development Environment
```toml
[env.development]
routes = [ { pattern = "inigma-dev.idone.su", custom_domain = true } ]

[env.development.vars]
DOMAIN = "inigma-dev.idone.su"

[env.development.triggers]
crons = ["0 2 * * *"]  # Daily cleanup of expired messages at 2 AM UTC
```

#### Production Environment
```toml
[env.production]
routes = [ { pattern = "inigma.idone.su", custom_domain = true } ]

[env.production.vars]
DOMAIN = "inigma.idone.su"

[env.production.triggers]
crons = ["0 2 * * *"]  # Daily cleanup of expired messages at 2 AM UTC
```

### Custom Domain Setup

#### For Development Domain (inigma-dev.idone.su):
1. **In Cloudflare Dashboard:**
   - Go to Workers & Pages
   - Select your `inigma` worker
   - Click "Settings" → "Triggers" → "Custom Domains"
   - Add `inigma-dev.idone.su`

#### For Production Domain (inigma.idone.su):
1. **In Cloudflare Dashboard:**
   - Go to Workers & Pages
   - Select your `inigma` worker
   - Click "Settings" → "Triggers" → "Custom Domains"
   - Add `inigma.idone.su`
   - Navigate to Settings → Triggers
   - Add Custom Domain: `your-domain.com`

2. **DNS Configuration:**
   ```
   CNAME inigma your-worker.workers.dev
   ```

## Project Structure

```
cloudflare-workers/
├── src/
│   ├── index.js              # Main worker entry point
│   ├── constants/
│   │   └── config.js         # Configuration constants
│   ├── handlers/
│   │   ├── get.js           # GET request handlers
│   │   ├── post.js          # POST request handlers
│   │   ├── options.js       # CORS preflight handlers
│   │   └── messages/        # Message-specific handlers
│   │       ├── create.js    # Create message endpoint
│   │       ├── view.js      # View message endpoint
│   │       ├── list.js      # List user messages
│   │       ├── update.js    # Update message ownership
│   │       ├── delete.js    # Delete message
│   │       ├── customName.js # Update custom name
│   │       └── pending.js   # Pending messages
│   └── utils/
│       ├── cors.js          # CORS utilities
│       ├── crypto.js        # Cryptographic functions
│       ├── database.js      # D1 database operations
│       ├── logger.js        # Per-request structured JSON logger
│       ├── rateLimit.js     # KV-based rate limiting (INIGMA_KV)
│       └── validation.js    # Input validation
├── build/                   # Generated files (created during build)
├── migrations/             # D1 schema migrations
├── schema.sql              # D1 schema (full, for fresh databases)
├── wrangler.toml           # Cloudflare Workers configuration
├── package.json            # Project dependencies
├── build.js                # Build script (resolves templates, bundles src)
└── README.md               # This file
```

## API Endpoints

The Workers implementation provides the same API as the main application:

- `GET /` - Serve the main application interface
- `GET /view?view={id}` - Serve the message view interface
- `POST /api/create` - Create new encrypted message
- `POST /api/view` - View message (with access control)
- `POST /api/update` - Claim message ownership
- `POST /api/list-secrets` - List user's owned messages with pagination
- `POST /api/list-pending-secrets` - List the creator's pending (unclaimed) messages
- `POST /api/update-custom-name` - Update message custom name
- `POST /api/delete-secret` - Delete user's message
- `GET /health` - Health check endpoint
- `GET /version` - Build/version info (git commit, branch, build date)

## Features

### Core Functionality
- ✅ End-to-end encryption (AES-256-GCM)
- ✅ Message TTL and automatic expiration
- ✅ User ownership and access control
- ✅ Custom message names
- ✅ Pagination for message lists
- ✅ Message deletion

### Storage & Performance
- ✅ D1 database for data persistence
- ✅ Automatic cleanup via cron triggers
- ✅ Global edge caching
- ✅ Optimized for low latency

### Security
- ✅ Same client-side encryption as main app
- ✅ CORS properly configured
- ✅ Input validation and sanitization
- ✅ Secure headers and CSP

## Differences from Docker Deployment

| Feature | Docker Deployment | Cloudflare Workers |
|---------|------------------|-------------------|
| **Storage** | Local filesystem | D1 Database |
| **Cleanup** | File-based cron | Scheduled triggers |
| **Scaling** | Manual/K8s | Automatic |
| **Geographic Distribution** | Single location | Global edge network |
| **Maintenance** | Server management required | Zero maintenance |
| **SSL** | Self-signed/manual | Automatic SSL |
| **Cost** | Server costs | Pay-per-request |

## Monitoring & Debugging

### View Real-time Logs

```bash
wrangler tail --env production
```

### Check Deployment Status

```bash
wrangler deployments list --env production
```

### Analytics

Monitor usage and performance in the Cloudflare dashboard:
- Workers & Pages → Your Worker → Analytics

## Troubleshooting

### Common Issues

**CORS Errors**
- Verify CORS headers in `src/utils/cors.js`
- Ensure the domain is properly configured

**Database Connection Errors**
- Check that the D1 database exists and is properly configured
- Verify D1 binding in `wrangler.toml`
- Ensure database tables are created

**Deployment Failures**
- Ensure you're authenticated with Wrangler
- Check the build output for errors
- Verify all dependencies are installed

**Performance Issues**
- Monitor cold start times in Analytics
- Consider using Workers KV for frequently accessed data

### Debug Mode

Enable debug logging by setting environment variables:

```bash
# Local development with debug
DEBUG=true npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test locally with `npm run dev`
4. Deploy to a test environment
5. Submit a pull request

## Support

For issues specific to Cloudflare Workers deployment:
1. Check this README and troubleshooting section
2. Review Cloudflare Workers documentation
3. Open an issue in the main repository

For general Inigma questions, see the main [README.md](../README.md).
