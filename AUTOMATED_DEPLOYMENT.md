# ✅ Automated Deployment for Inigma

## 🎯 What this is

Deployment is **automated** via GitHub Actions. Once the KV namespace is set up
(it already is), everything happens automatically.

## 🚀 How it works

### On every push to the `main` branch:

```mermaid
graph LR
    A[Push to main] --> B[GitHub Actions]
    B --> C[npm ci + Build Worker]
    C --> D[Apply D1 Migrations]
    D --> E[Deploy to Production]
    E --> F[✅ Live!]
```

### Workflow steps (`.github/workflows/cloudflare-deploy.yml`):

1. **Checkout + Node.js 20 + `npm ci`**

2. **Build** (`npm run build`)
   - Resolves modular templates, bundles `src/`, compiles TailwindCSS

3. **Apply D1 migrations** (idempotent)
   - `wrangler d1 migrations apply INIGMA_DB --env production --remote`
   - Safe to re-run (wrangler tracks applied migrations)

4. **Deploy** (`npm run deploy:production`)
   - Deploys to Cloudflare Workers (production) with the configured `INIGMA_KV`

> **Production only.** The workflow deploys the production environment
> exclusively. Dev (`inigma-dev.idone.su`, separate database
> `inigma-database-dev`) is deployed manually with `npm run deploy:development`.
>
> **No test gate.** Any push to `main` ships to production without running tests
> or review. The integration tests (`pytest tests/`, ~30s) could be added as a
> separate job before deploy if desired.

## 📋 Requirements

### 1. GitHub Secrets (already configured)

```
CLOUDFLARE_API_TOKEN  - API token with Workers/D1 permissions
CLOUDFLARE_ACCOUNT_ID - your Cloudflare Account ID
```

### 2. KV Namespace (already configured)

The `INIGMA_KV` namespace for production is already created and set in
`cloudflare-workers/wrangler.toml` (id `32a3b5af...`). It backs rate limiting
and the idempotency cache. No need to recreate it.

If bringing up an environment from scratch, see
`cloudflare-workers/RATE_LIMIT_SETUP.md`.

### 3. Migrations (applied automatically)

- `001_initial_schema.sql` - Base schema for the `messages` table
- `002_add_composite_indexes.sql` - Composite indexes for performance

## 🎮 Usage

### Automatic deploy

```bash
# Just push to main
git push origin main
```

The workflow runs automatically.

### Manual workflow run

1. Go to GitHub → Actions
2. Select "Deploy to Cloudflare Workers"
3. Click "Run workflow"
4. Choose the branch (main)
5. Run!

## ✅ Idempotency

All operations are **safe to re-run**:

- ✅ D1 migrations — wrangler tracks applied migrations
- ✅ Composite indexes — `CREATE INDEX IF NOT EXISTS`
- ✅ Deploy — simply updates the worker

**Re-run as many times as you like, with no side effects.**

## 📊 Monitoring deployment

### GitHub Actions logs

```
✅ Building project...
✅ Applying D1 migrations...
✅ No new migrations to apply (already applied)
✅ Deploying to Cloudflare Workers...
✅ Published inigma-production
   https://inigma.idone.su
```

### Check in the Cloudflare Dashboard

1. **Workers & Pages** → inigma → Metrics
2. **KV** → INIGMA_KV
3. **D1** → inigma-database → Migrations

## 🔧 Local development

For local testing (without rate limiting):

```bash
cd cloudflare-workers
npm install
npm run dev
```

Rate limiting is skipped with a warning (KV is not configured locally).

## 📦 What the deploy includes

### Rate limiting
- KV-based rate limiting
- 10 req/min for message creation
- 100 req/min for viewing
- Configured automatically

### Database
- D1 (SQLite-backed) database
- Composite indexes for performance
- Automatic migrations

### Security
- CORS validation
- Size limits (2MB encrypted data)
- Input validation
- Security headers

## 🚫 What you do NOT need to do manually

❌ `npx wrangler d1 migrations apply`
❌ Memorize deploy commands
❌ Reconfigure the KV namespace

**After the initial KV setup, everything is automatic.**

## 🎉 Result

```bash
# One-time KV namespace setup (see RATE_LIMIT_SETUP.md)
# After that:
git push origin main
# Wait 2-3 minutes
# ✅ Site updated: https://inigma.idone.su
```

---

**Documentation:**
- Detailed report: `IMPROVEMENTS_SUMMARY.md`
- Rate limiting setup: `cloudflare-workers/RATE_LIMIT_SETUP.md`
- Workflow: `.github/workflows/cloudflare-deploy.yml`
