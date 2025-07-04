# Inigma

Inigma is a secure message sharing application that allows users to send private information safely with end-to-end encryption. The application features client-side AES encryption, TTL-based message expiration, user ownership controls, custom naming, and automatic cleanup of old messages.

## Features

- **End-to-End Encryption**: Client-side AES-256-GCM encryption using Web Crypto API
- **Message Expiration**: Automatic TTL-based message cleanup
- **User Ownership**: Credential-based message ownership and management
- **Custom Names**: Optional custom names for better organization
- **Secure Communication**: HTTPS with nginx proxy and security headers
- **Responsive Design**: Mobile-friendly interface
- **Auto-Cleanup**: Removes expired messages automatically

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone and navigate to the project
git clone <repository-url>
cd inigma

# Create data directory for persistent database storage
mkdir -p data

# Start the application
docker-compose up --build -d

# Access the application
# HTTPS: https://localhost:8443
# HTTP: http://localhost:8080 (redirects to HTTPS)
```

### Development Mode

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run development server
python main.py
# Access at http://localhost:8000
```

### Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit environment variables as needed
# DOMAIN - Domain for generated links (default: localhost:8443)
# CORS_ORIGINS - Allowed CORS origins (default: https://localhost:8443)
```

## Architecture

Inigma supports two deployment architectures:

### 1. Docker Deployment (Recommended for Self-Hosting)

- **FastAPI Backend**: REST API with SQLite database storage
- **Nginx Proxy**: HTTPS termination with self-signed certificates
- **Client-Side Encryption**: Web Crypto API for AES encryption
- **SQLite Database**: Persistent storage with indexed queries for better performance

#### Network Architecture

```
Internet → Nginx (8080/8443) → Internal Network → Inigma App (8000)
```

- **External Access**: Only nginx is exposed to the internet
- **Internal Communication**: App runs on internal Docker network
- **SSL Termination**: Nginx handles HTTPS with self-signed certificates

### 2. Cloudflare Workers Deployment (Serverless)

- **Edge Runtime**: Deployed on Cloudflare's global edge network
- **D1 Database**: Cloudflare's SQLite-based database for edge computing
- **Custom Domain**: Can be deployed on custom domains
- **Global CDN**: Automatic global distribution and caching

#### Cloudflare Architecture

```
Internet → Cloudflare Edge → Worker Runtime → D1 Database
```

**Production Instance**: [https://inigma.idone.su](https://inigma.idone.su)

For detailed Cloudflare Workers deployment instructions, see [`cloudflare-workers/README.md`](cloudflare-workers/README.md).

### Security Model

- All encryption/decryption happens client-side
- Server never sees plaintext content
- Messages can be bound to user credentials
- HTTPS required for Web Crypto API
- Strict Content Security Policy headers
- Input validation and sanitization

## API Reference

### Endpoints

- `POST /api/create` - Create new encrypted message
- `POST /api/view` - View message (requires credentials if owned)
- `POST /api/update` - Claim ownership of message
- `POST /api/list-secrets` - List user's messages with pagination
- `POST /api/update-custom-name` - Update message custom name
- `POST /api/delete-secret` - Delete user's message
- `GET /health` - Health check endpoint

### Message Structure

Messages are stored in the database with the following structure:

```sql
-- SQLite/D1 Database Schema
CREATE TABLE messages (
    id TEXT PRIMARY KEY,              -- Message ID
    ttl INTEGER NOT NULL,             -- Time to live (Unix timestamp)
    uid TEXT NOT NULL DEFAULT '',    -- Owner user ID (empty if unclaimed)
    encrypted_message TEXT NOT NULL, -- Base64 encrypted content
    iv TEXT NOT NULL,                -- Base64 initialization vector
    salt TEXT NOT NULL,              -- Base64 salt for key derivation
    custom_name TEXT DEFAULT '',     -- Optional custom name
    creator_uid TEXT DEFAULT '',     -- Creator user ID
    created_at INTEGER NOT NULL      -- Creation timestamp
);
```

## Deployment Options

### 1. Docker Compose (Recommended for Self-Hosting)

The main deployment method using nginx proxy:

```bash
docker-compose up --build -d
```

**Services:**
- `inigma-app`: FastAPI application (internal network only)
- `inigma-nginx`: Nginx proxy with HTTPS (exposed ports 8080, 8443)

**Access:**
- HTTPS: https://localhost:8443
- HTTP: http://localhost:8080 (redirects to HTTPS)

### 2. Cloudflare Workers (Serverless)

For global edge deployment with automatic scaling:

```bash
cd cloudflare-workers/
npm install
npm run build
npm run deploy:production
```

**Benefits:**
- Global edge network deployment
- Automatic scaling and caching
- D1 database for reliable data storage
- Custom domain support
- Zero server maintenance

**Production URL**: https://inigma.idone.su

See [`cloudflare-workers/README.md`](cloudflare-workers/README.md) for detailed instructions.

### 3. Single Container (Development)

For development or simple deployments:

```bash
docker build -t inigma .
docker run -p 8000:8000 -v $(pwd)/keys:/app/keys inigma
```

### 4. Kubernetes (Advanced)

Using Helm charts for Kubernetes deployment:

```bash
helm install inigma ./helm/
helm upgrade inigma ./helm/
```

## File Structure

```
inigma/
├── main.py                 # FastAPI application
├── requirements.txt        # Python dependencies
├── Dockerfile             # Application container
├── Dockerfile.nginx       # Nginx container
├── docker-compose.yaml    # Production deployment
├── nginx.conf             # Nginx configuration
├── .env.example           # Environment variables template
├── keys/                  # Message storage directory
├── static/                # Static assets
├── templates-modular/     # Modular HTML templates
│   ├── pages/            # Main page templates
│   ├── components/       # Reusable components
│   ├── scripts/          # JavaScript modules
│   └── styles/           # CSS modules
├── cloudflare-workers/   # Alternative Cloudflare Workers deployment
└── helm/                 # Kubernetes deployment manifests
```

## Security Considerations

### Encryption
- **Algorithm**: AES-256-GCM with PBKDF2 key derivation
- **Client-Side Only**: All encryption/decryption in browser
- **Key Management**: Keys never transmitted to server
- **Salt & IV**: Unique per message for cryptographic security

### HTTPS Requirements
- **Web Crypto API**: Requires secure context (HTTPS or localhost)
- **Self-Signed Certificates**: Nginx automatically generates certificates
- **Browser Security**: Modern browsers required for crypto operations

### Input Validation
- Server-side validation for all inputs
- Client-side sanitization to prevent XSS
- Message ID format validation
- TTL range validation (0-365 days)
- Custom name length limits

### Content Security Policy
- Strict CSP headers prevent code injection
- Allowlist for required external resources
- Inline script restrictions with nonces

## Browser Support

**Minimum Requirements:**
- Chrome 60+ / Chromium-based browsers
- Firefox 78+
- Safari 14+
- Edge 79+

**Required APIs:**
- Web Crypto API
- Fetch API
- Local Storage
- ES6+ JavaScript features

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost:8443` | Base domain for generated message links |
| `PORT` | `8000` | Application server port |
| `CORS_ORIGINS` | `https://localhost:8443` | Allowed CORS origins (comma-separated) |

## Troubleshooting

### Common Issues

**SSL Certificate Warnings**
- Expected with self-signed certificates
- Add security exception in browser
- For production, replace with proper SSL certificates

**Web Crypto API Not Available**
- Ensure HTTPS or localhost access
- Check browser compatibility
- Verify secure context requirements

**Message Storage Issues**
- Ensure `keys/` directory has write permissions
- Check Docker volume mounts
- Verify disk space availability

### Logs

```bash
# Docker Compose logs
docker-compose logs -f

# Application logs only
docker-compose logs -f inigma

# Nginx logs only
docker-compose logs -f nginx
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

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