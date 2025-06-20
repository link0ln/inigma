# Modular Cloudflare Workers Structure

This document describes the new modular structure of the Inigma Cloudflare Workers implementation.

## Directory Structure

```
src/
├── index-new.js              # Main entry point (modular version)
├── constants/
│   └── config.js             # Configuration constants (CORS origins, TTL, etc.)
├── utils/
│   ├── cors.js              # CORS utility functions
│   ├── crypto.js            # Cryptographic utilities (random string generation)
│   ├── storage.js           # R2 storage operations (store, retrieve, delete, cleanup)
│   └── validation.js        # Validation utilities (message ID, timestamps)
└── handlers/
    ├── options.js           # Handle OPTIONS requests (CORS preflight)
    ├── get.js              # Handle GET requests (serve HTML, health check)
    ├── post.js             # POST request routing
    └── messages/
        ├── create.js        # Handle message creation
        ├── view.js         # Handle message viewing
        ├── update.js       # Handle ownership updates
        ├── delete.js       # Handle secret deletion
        ├── list.js         # Handle listing user secrets
        ├── pending.js      # Handle listing pending secrets
        └── customName.js   # Handle custom name updates
```

## File Responsibilities

### Constants (`constants/`)
- **config.js**: All configuration constants, CORS origins, default values

### Utilities (`utils/`)
- **cors.js**: CORS header management and origin validation
- **crypto.js**: Cryptographic operations (random string generation)
- **storage.js**: R2 storage abstraction (CRUD operations, cleanup)
- **validation.js**: Input validation and utility functions

### Handlers (`handlers/`)
- **options.js**: CORS preflight handling
- **get.js**: Static file serving, health checks
- **post.js**: POST request routing to appropriate message handlers

### Message Handlers (`handlers/messages/`)
- **create.js**: Create new encrypted messages (`/api/create`)
- **view.js**: Retrieve and view messages (`/api/view`)
- **update.js**: Update message ownership (`/api/update`)
- **delete.js**: Delete secrets (`/api/delete-secret`)
- **list.js**: List user's owned secrets (`/api/list-secrets`)
- **pending.js**: List user's pending secrets (`/api/list-pending-secrets`)
- **customName.js**: Update custom names (`/api/update-custom-name`)

## Building

### Regular Build (Original)
```bash
node build.js
```

### Modular Build (New)
```bash
node build-modular.js
```

The modular build:
1. Recursively reads all `.js` files in the `src/` directory
2. Converts ES6 imports/exports to Worker-compatible format
3. Bundles all modules into a single file
4. Injects HTML templates
5. Creates the final `build/index.js`

## Benefits

1. **Better Organization**: Each functionality is in its own file
2. **Easier Maintenance**: LLMs can quickly identify which file to modify
3. **Reduced Context**: Instead of one large file, work with smaller focused files
4. **Clearer Separation**: Business logic, utilities, and configuration are separated
5. **Scalability**: Easy to add new message handlers or utilities

## Development Workflow

1. **Adding New Message Handler**: Create a new file in `handlers/messages/`
2. **Adding Utility Function**: Add to appropriate file in `utils/`
3. **Configuration Changes**: Modify `constants/config.js`
4. **New Route**: Add to `handlers/post.js` routing

## Migration

The original `index.js` remains unchanged. The new modular version is in `index-new.js` and uses the modular build process. Both versions produce functionally identical workers.

To switch to modular development:
1. Use `build-modular.js` instead of `build.js`
2. Modify files in the new modular structure
3. Deploy the built result from `build/index.js`