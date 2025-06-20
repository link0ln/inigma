const fs = require('fs');
const path = require('path');

console.log('Building modular Inigma for Cloudflare Workers...');

// First, build templates from modular structure
function buildTemplate(templatePath, outputPath) {
    console.log(`Building ${templatePath}...`);
    
    let templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Process all {{> filename }} includes
    templateContent = templateContent.replace(/\{\{>\s*([^}]+)\s*\}\}/g, (match, filename) => {
        const trimmedFilename = filename.trim();
        
        // Determine the file type and directory
        let filePath;
        if (trimmedFilename.endsWith('.css')) {
            filePath = path.join(__dirname, '../templates-modular/styles', trimmedFilename);
        } else if (trimmedFilename.endsWith('.js')) {
            filePath = path.join(__dirname, '../templates-modular/scripts', trimmedFilename);
        } else {
            // Assume it's an HTML component
            filePath = path.join(__dirname, '../templates-modular/components', trimmedFilename + '.html');
        }
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.warn(`Warning: File not found: ${filePath}`);
            return `<!-- Missing: ${trimmedFilename} -->`;
        }
        
        // Read and return file content
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`  ✓ Included: ${trimmedFilename}`);
        return content;
    });
    
    return templateContent;
}

// Build templates
console.log('Building templates from modular structure...');
const indexHTML = buildTemplate(
    path.join(__dirname, '../templates-modular/pages/index.html')
);
const viewHTML = buildTemplate(
    path.join(__dirname, '../templates-modular/pages/view.html')
);

// Create build directory
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

// Function to recursively read and bundle all JS files
function bundleModules(dir, basePath = '') {
  let bundledCode = '';
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const relativePath = path.join(basePath, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      // Recursively bundle subdirectories
      bundledCode += bundleModules(filePath, relativePath);
    } else if (file.endsWith('.js') && file !== 'index-new.js' && file !== 'index.js') {
      console.log(`Bundling: ${relativePath}`);
      let fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Convert ES6 imports/exports to regular functions for Workers environment
      fileContent = convertToWorkerFormat(fileContent, relativePath);
      
      bundledCode += `\n// === ${relativePath} ===\n${fileContent}\n`;
    }
  }
  
  return bundledCode;
}

// Convert ES6 modules to Worker-compatible format
function convertToWorkerFormat(content, filePath) {
  // Remove import statements and collect them
  const imports = [];
  content = content.replace(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?\n?/g, (match, imports_str, from) => {
    imports.push({ imports: imports_str.trim(), from });
    return '';
  });
  
  // Convert export statements to global assignments
  content = content.replace(/export\s+(async\s+)?function\s+(\w+)/g, (match, async_keyword, funcName) => {
    return `${async_keyword || ''}function ${funcName}`;
  });
  
  content = content.replace(/export\s+const\s+(\w+)/g, 'const $1');
  
  // Make functions globally available
  const functionMatches = content.match(/(async\s+)?function\s+(\w+)/g);
  if (functionMatches) {
    functionMatches.forEach(match => {
      const funcName = match.replace(/(async\s+)?function\s+/, '');
      if (!content.includes(`globalThis.${funcName} =`)) {
        content += `\nglobalThis.${funcName} = ${funcName};`;
      }
    });
  }
  
  // Make constants globally available
  const constMatches = content.match(/const\s+([A-Z_][A-Z0-9_]*)\s*=/g);
  if (constMatches) {
    constMatches.forEach(match => {
      const constName = match.replace(/const\s+([A-Z_][A-Z0-9_]*)\s*=/, '$1');
      if (!content.includes(`globalThis.${constName} =`)) {
        content += `\nglobalThis.${constName} = ${constName};`;
      }
    });
  }
  
  return content;
}

// Read fallback crypto file
const fallbackCryptoJS = fs.readFileSync(path.join(__dirname, '../static/fallback-crypto.js'), 'utf8');

// Bundle all modules
const srcDir = path.join(__dirname, 'src');
const bundledModules = bundleModules(srcDir);

// Read the main worker file
let mainWorkerCode = fs.readFileSync(path.join(__dirname, 'src/index.js'), 'utf8');

// Remove ES6 imports from main file
mainWorkerCode = mainWorkerCode.replace(/import\s+{[^}]+}\s+from\s+['"][^'"]+['"];?\n?/g, '');

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

// Make templates globally available
globalThis.indexHTML = indexHTML;
globalThis.viewHTML = viewHTML;
globalThis.fallbackCryptoJS = fallbackCryptoJS;
`;

// Combine everything
const finalCode = `/**
 * Inigma - Secure Message Sharing Service
 * Cloudflare Workers Implementation (Bundled)
 * Generated from modular source
 */

${bundledModules}

${templatesContent}

${mainWorkerCode}`;

// Write the built file
fs.writeFileSync(path.join(buildDir, 'index.js'), finalCode);

// Copy wrangler.toml to build directory
fs.copyFileSync(path.join(__dirname, 'wrangler.toml'), path.join(buildDir, 'wrangler.toml'));

console.log('✅ Modular build completed!');
console.log('📁 Worker code is in build/index.js');
console.log('🚀 To deploy: cd build && wrangler deploy --env production');
console.log('');
console.log('📂 Modular structure:');
console.log('  - constants/     - Configuration and constants');
console.log('  - utils/         - Utility functions (crypto, CORS, validation)');
console.log('  - handlers/      - Request handlers');
console.log('    - messages/    - Message-specific handlers');
console.log('');
console.log('Next steps:');
console.log('1. Update wrangler.toml with correct configuration');
console.log('2. Set up custom domain in Cloudflare dashboard');
console.log('3. Deploy: wrangler deploy --env production');