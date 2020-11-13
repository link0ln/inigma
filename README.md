## Project Overview

Inigma is a secure message sharing application that allows users to send private information safely with end-to-end encryption. The application features client-side AES encryption, TTL-based message expiration, one-time access controls, and automatic cleanup of old messages.

## Architecture

### Dual Deployment Options

The codebase supports two deployment architectures:

1. **Python/FastAPI Backend** (`main.py`)
   - FastAPI application with file-based storage
   - Uses local filesystem (`keys/` directory) for message storage
   - Runs on Python 3.11 with uvicorn

2. **Cloudflare Workers** (`cloudflare-workers/`)
   - Serverless edge deployment 
   - R2 Object Storage for message persistence
   - Global edge network distribution
   - Domain: inigma.idone.su

### Core Components

- **Backend API**: REST endpoints for create/view/update operations
- **Storage Layer**: File system (Python) or R2 buckets (Workers)
- **Frontend**: Static HTML with client-side JavaScript encryption
- **Message Model**: JSON structure with encryption metadata (iv, salt, TTL)

## Common Development Commands

### Python/FastAPI Version

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
python main.py
# Server runs on http://localhost:8000

# Build and run with Docker
docker build -t inigma .
docker run -p 8585:8000 inigma

# Use docker-compose for development
docker-compose up -d
# Accessible at http://localhost:8585
```

### Cloudflare Workers Version

```bash
# Navigate to cloudflare-workers directory
cd cloudflare-workers/

# Quick deploy (recommended)
./deploy.sh production

# Or manual steps:
# Install dependencies
npm install

# Build project
npm run build

# Create R2 bucket
wrangler r2 bucket create inigma-storage

# Deploy to production
npm run deploy:production

# View logs
./dev.sh logs

# Local development
./dev.sh test
```

**Production URL**: https://inigma.idone.su

### Kubernetes Deployment

```bash
# Deploy using Helm
helm install inigma ./helm/

# Update deployment
helm upgrade inigma ./helm/
```

## Key Technical Details

### Message Lifecycle
1. Client generates AES key and encrypts message
2. Server stores encrypted data with TTL and access controls
3. Messages expire automatically based on TTL (default 30 days)
4. Cleanup process removes messages older than 50 days

### Security Model
- All encryption/decryption happens client-side
- Server never sees plaintext content
- Messages can be bound to specific user IDs for access control
- Optional multi-open vs single-access modes

### Storage Structure
- Messages stored as JSON files with random 25-character filenames
- Contains: encrypted_message, iv, salt, TTL, multiopen flag, uid
- Automatic cleanup removes expired files

### Environment Configuration
- `DOMAIN`: Sets the base URL for generated message links
- `PORT`: Server port (default 8000 for Python, 8787 for Workers)
- For Workers: Configure domain in `wrangler.toml`

## File Structure Notes

- `main.py`: Complete FastAPI application
- `templates/`: HTML templates for web interface
- `static/`: Client-side JavaScript and CSS
- `keys/`: Runtime directory for message storage (Python version)
- `cloudflare-workers/`: Complete Workers implementation with R2 storage
- `helm/`: Kubernetes deployment manifests
- `redeploy.sh`: Docker rebuild script (legacy)
