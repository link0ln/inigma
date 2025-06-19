const fs = require('fs');
const path = require('path');

console.log('Building Inigma for Cloudflare Workers...');

// Create build directory
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

// Read template files
const indexHTML = fs.readFileSync(path.join(__dirname, '../templates/index.html'), 'utf8');
const viewHTML = fs.readFileSync(path.join(__dirname, '../templates/view.html'), 'utf8');
const fallbackCryptoJS = fs.readFileSync(path.join(__dirname, '../static/fallback-crypto.js'), 'utf8');

// Read the main worker file
let workerCode = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf8');

// Escape strings for JavaScript
function escapeForJS(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\r?\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

// Create the templates content
const templatesContent = `
// HTML Templates
const indexHTML = \`${escapeForJS(indexHTML)}\`;
const viewHTML = \`${escapeForJS(viewHTML)}\`;
const fallbackCryptoJS = \`${escapeForJS(fallbackCryptoJS)}\`;
`;

// Replace placeholder in worker code
workerCode = workerCode.replace('// ${TEMPLATE_PLACEHOLDER}', templatesContent);

// Write the built file
fs.writeFileSync(path.join(buildDir, 'index.js'), workerCode);

// Copy wrangler.toml to build directory
fs.copyFileSync(path.join(__dirname, 'wrangler.toml'), path.join(buildDir, 'wrangler.toml'));

console.log('✅ Build completed!');
console.log('📁 Worker code is in build/index.js');
console.log('🚀 To deploy: cd build && wrangler deploy --env production');
console.log('');
console.log('Next steps:');
console.log('1. Create R2 bucket: wrangler r2 bucket create inigma-storage');
console.log('2. Update wrangler.toml with correct KV namespace ID (optional)');
console.log('3. Set up custom domain in Cloudflare dashboard');
console.log('4. Deploy: wrangler deploy --env production');
