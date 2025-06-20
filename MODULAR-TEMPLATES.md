# Modular Templates Structure

This document describes the modular structure for HTML templates in the Inigma project.

## Overview

The templates are organized into smaller, focused components for better maintainability and LLM understanding. The application now uses templates-modular/ directly without needing to build into templates/.

## Directory Structure

```
templates-modular/
├── components/          # Reusable HTML components
│   ├── head.html           # HTML head section with meta tags and CDN links
│   ├── header.html         # Main page header with logo and title
│   ├── toast.html          # Toast notification component
│   ├── message-input.html  # Message creation form
│   ├── success-modal.html  # Success modal after creating messages
│   ├── credentials-section.html  # User credentials management
│   ├── secrets-list.html   # "My Secrets" section
│   ├── pending-secrets.html  # "Pending Secrets" section
│   └── features.html       # Features showcase section
├── scripts/             # JavaScript modules
│   ├── security-utils.js   # XSS prevention and security utilities
│   ├── crypto-functions.js # Encryption/decryption functions
│   ├── main-app.js        # Main Alpine.js application
│   └── view-app.js        # View page Alpine.js application
├── styles/              # CSS modules
│   └── main.css           # Main stylesheet with animations
└── pages/               # Main page templates
    ├── index.html         # Home page template with includes
    └── view.html          # View message page template
```

## Component Breakdown

### HTML Components (`components/`)

| Component | Purpose | Used In |
|-----------|---------|---------|
| `head.html` | HTML head with meta tags, CDN links | Both pages |
| `header.html` | Page header with logo | index.html |
| `toast.html` | Toast notifications | Both pages |
| `message-input.html` | Message creation form | index.html |
| `success-modal.html` | Success modal with links | index.html |
| `credentials-section.html` | Credential management UI | index.html |
| `secrets-list.html` | Owned secrets list | index.html |
| `pending-secrets.html` | Pending secrets list | index.html |
| `features.html` | Feature showcase cards | index.html |

### JavaScript Modules (`scripts/`)

| Module | Purpose | Size | Key Functions |
|--------|---------|------|---------------|
| `security-utils.js` | XSS prevention | ~70 lines | sanitizeText, htmlEncode, checkRateLimit |
| `crypto-functions.js` | Cryptography | ~80 lines | encrypt, decrypt, generatePassword |
| `main-app.js` | Main Alpine.js app | ~200 lines | processMessage, loadSecrets, deleteSecret |
| `view-app.js` | View page app | ~120 lines | decryptMessage, updateOwnership |

### Styles (`styles/`)

| File | Purpose | Contains |
|------|---------|----------|
| `main.css` | Main stylesheet | gradient-bg, glass-morphism, animations |

## Template Syntax

The modular templates use a simple include syntax:

```html
{{> filename }}
```

**Examples:**
- `{{> head }}` → includes `components/head.html`
- `{{> main.css }}` → includes `styles/main.css`
- `{{> crypto-functions.js }}` → includes `scripts/crypto-functions.js`

## Build Process

### Main Application

The main FastAPI application (`main.py`) uses the `build_template_from_modular()` function to build templates on-demand from the modular structure.

### Cloudflare Workers

For Cloudflare Workers deployment:

```bash
cd cloudflare-workers && node build-modular.js
```

This builds templates from modular components and bundles them into the worker.

## Benefits for LLM Development

### Before (Monolithic)
- **index.html**: 900+ lines - hard to navigate
- **Mixed concerns**: HTML, CSS, JS all in one file
- **Context overhead**: LLM needs to read entire file for small changes

### After (Modular)
- **Focused files**: 20-80 lines each
- **Clear separation**: HTML, CSS, JS in separate files
- **Targeted edits**: LLM reads only relevant component

## Common Development Tasks

### Adding a New Component
1. Create file in `templates-modular/components/new-component.html`
2. Add `{{> new-component }}` to page template
3. Run `node build-templates.js`

### Modifying JavaScript
1. Edit relevant file in `templates-modular/scripts/`
2. Run `node build-templates.js`
3. Changes appear in built templates

### Updating Styles
1. Edit `templates-modular/styles/main.css`
2. Run `node build-templates.js`

## Migration Notes

- Modular source is in `templates-modular/` (hand-edited)
- Main application builds templates on-demand from modular components
- Cloudflare Workers build process combines modular files into bundled templates
- No need for intermediate `templates/` directory

## File Size Comparison

| File | Before | After (Total) | Largest Module |
|------|--------|---------------|----------------|
| index.html | 900 lines | 900 lines | main-app.js (200 lines) |
| view.html | 450 lines | 450 lines | view-app.js (120 lines) |

**Key Benefit**: Instead of working with 900-line files, LLMs now work with focused 20-200 line modules.

## Future Enhancements

1. **Component Library**: Reusable UI components across pages
2. **CSS Modules**: Further split styles by component
3. **TypeScript**: Add type safety to JavaScript modules
4. **Testing**: Unit tests for individual components
5. **Hot Reload**: Development server with auto-rebuild