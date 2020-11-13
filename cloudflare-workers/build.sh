#!/bin/bash

# Build script for Cloudflare Workers deployment
# This script combines HTML templates and static files into the worker

echo "Building Inigma for Cloudflare Workers..."

# Create build directory
mkdir -p build

# Read HTML templates and escape them for JavaScript
INDEX_HTML=$(cat ../templates/index.html | sed 's/\\/\\\\/g' | sed 's/`/\\`/g' | sed 's/\$/\\$/g' | tr '\n' ' ')
VIEW_HTML=$(cat ../templates/view.html | sed 's/\\/\\\\/g' | sed 's/`/\\`/g' | sed 's/\$/\\$/g' | tr '\n' ' ')
FALLBACK_CRYPTO=$(cat ../static/fallback-crypto.js | sed 's/\\/\\\\/g' | sed 's/`/\\`/g' | sed 's/\$/\\$/g' | tr '\n' ' ')

# Create the templates content
TEMPLATES_CONTENT="
// HTML Templates
const indexHTML = \`$INDEX_HTML\`;
const viewHTML = \`$VIEW_HTML\`;
const fallbackCryptoJS = \`$FALLBACK_CRYPTO\`;
"

# Replace placeholder in index.js
sed "s/\${TEMPLATE_PLACEHOLDER}/$TEMPLATES_CONTENT/g" src/index.js > build/index.js

echo "Build completed! Worker code is in build/index.js"
echo "To deploy: cd build && wrangler deploy --env production"
