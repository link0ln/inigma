## Project Overview

Inigma is a secure message sharing application that allows users to send private information safely with end-to-end encryption. The application features client-side AES encryption, TTL-based message expiration, user ownership controls, custom naming, and automatic cleanup of old messages.

## Architecture

### Dual Deployment Options

The codebase supports two deployment architectures:

1. **Python/FastAPI Backend** (`main.py`)
   - FastAPI application with file-based storage
   - Uses local filesystem (`keys/` directory) for message storage
   - Runs on Python 3.11 with uvicorn
   - Supports HTTPS via nginx proxy with self-signed certificates

2. **Cloudflare Workers** (`cloudflare-workers/`)
   - Serverless edge deployment 
   - R2 Object Storage for message persistence
   - Global edge network distribution
   - Domain: inigma.idone.su

### Core Components

- **Backend API**: REST endpoints for create/view/update/delete operations
- **Storage Layer**: File system (Python) or R2 buckets (Workers)
- **Frontend**: Static HTML with client-side JavaScript encryption using Web Crypto API
- **Message Model**: JSON structure with encryption metadata (iv, salt, TTL, owner)
- **User Management**: Local credential storage with secret ownership and management

## Development Commands

### Python/FastAPI Version

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
python main.py
# Server runs on http://localhost:8000

# Build and run with Docker
docker build -t inigma .
docker run -p 8000:8000 inigma

# Standard deployment
docker-compose up -d
# Accessible at http://localhost:8585

# HTTPS deployment with nginx and self-signed certificates
docker-compose -f docker-compose-nginx.yaml up --build -d
# Accessible at:
# - HTTPS: https://localhost:8443
# - HTTP redirect: http://localhost:8080 -> https://localhost:8443
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

## Key Features

### Message Management
- **Create Messages**: End-to-end encrypted messages with custom TTL
- **Custom Names**: Optional custom names for better organization
- **My Secrets**: List and manage all user-owned messages
- **Message Ownership**: Messages can be claimed by users with credentials
- **Delete Messages**: Users can delete their own messages
- **Auto-Expiration**: Messages automatically expire based on TTL

### Security Features
- **Client-Side Encryption**: AES-256-GCM encryption using Web Crypto API
- **HTTPS Support**: Self-signed certificates for secure communication
- **Content Security Policy**: Strict CSP headers for XSS protection
- **Input Sanitization**: All user inputs are sanitized and validated
- **Rate Limiting**: Client-side rate limiting for API requests
- **Secure Headers**: HSTS, X-Frame-Options, X-Content-Type-Options

### User Experience
- **Credential Management**: Auto-generated or custom user credentials
- **Copy to Clipboard**: Easy copying of links and credentials
- **Responsive Design**: Mobile-friendly interface with glassmorphism design
- **Toast Notifications**: User feedback for all actions
- **Pagination**: Efficient browsing of large secret lists

## Technical Details

### Message Lifecycle
1. Client generates AES key and encrypts message using Web Crypto API
2. Server stores encrypted data with TTL and access controls
3. Users can claim ownership of messages with their credentials
4. Messages expire automatically based on TTL (default 30 days)
5. Cleanup process removes messages older than 50 days

### Security Model
- All encryption/decryption happens client-side using Web Crypto API
- Server never sees plaintext content
- Messages can be bound to specific user IDs for access control
- HTTPS required for Web Crypto API functionality
- CSP headers prevent XSS attacks
- Input validation and sanitization on both client and server

### Storage Structure
- Messages stored as JSON files with random 25-character filenames
- Contains: encrypted_message, iv, salt, TTL, uid, custom_name
- User credentials stored in localStorage
- Automatic cleanup removes expired files

### API Endpoints
- `POST /api/create` - Create new encrypted message
- `POST /api/view` - View message (requires credentials if owned)
- `POST /api/update` - Claim ownership of message
- `POST /api/list-secrets` - List user's messages with pagination
- `POST /api/update-custom-name` - Update message custom name
- `POST /api/delete-secret` - Delete user's message
- `GET /health` - Health check endpoint

### Environment Configuration
- `DOMAIN`: Sets the base URL for generated message links
- `PORT`: Server port (default 8000)
- `CORS_ORIGINS`: Allowed CORS origins (supports HTTPS domains)
- For Workers: Configure domain in `wrangler.toml`

## File Structure

- `main.py`: Complete FastAPI application with all API endpoints
- `templates/`: HTML templates for web interface
  - `index.html`: Main application with message creation and management
  - `view.html`: Message viewing interface
- `static/`: Client-side utilities
  - `security-utils.js`: XSS prevention utilities
- `keys/`: Runtime directory for message storage
- `docker-compose.yaml`: Standard Docker deployment
- `docker-compose-nginx.yaml`: HTTPS deployment with nginx
- `Dockerfile.nginx`: Nginx container with self-signed certificates
- `nginx.conf`: Nginx configuration with SSL and security headers
- `cloudflare-workers/`: Complete Workers implementation with R2 storage
- `helm/`: Kubernetes deployment manifests

## Security Considerations

### Web Crypto API Requirements
- **HTTPS Only**: Web Crypto API requires secure context (HTTPS or localhost)
- **Browser Support**: Modern browsers support required for AES-GCM encryption
- **Self-Signed Certificates**: Included nginx setup generates certificates automatically

### Content Security Policy
- Strict CSP prevents XSS attacks
- Allows necessary CDN resources (Tailwind, Alpine.js)
- Includes `'unsafe-eval'` for Alpine.js compatibility

### Input Validation
- All user inputs sanitized on both client and server
- Custom name length limited to 100 characters
- Message ID validation with alphanumeric characters only
- TTL validation (0-365 days)

## Browser Compatibility

- **Modern Browsers**: Chrome 60+, Firefox 78+, Safari 14+, Edge 79+
- **Required APIs**: Web Crypto API, Fetch API, Local Storage
- **JavaScript**: ES6+ features required for Alpine.js