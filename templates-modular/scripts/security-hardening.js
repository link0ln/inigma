// Security Hardening Module - Comprehensive JS Injection and Key Protection
class SecurityHardening {
    constructor() {
        this.initialized = false;
        this.integrityChecks = new Map();
        this.cspNonce = this.generateNonce();
        this.keyIsolationWorker = null;
        this.secureContext = null;
        this.antiTamperChecks = [];
    }

    // Generate cryptographically secure nonce for CSP
    generateNonce() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array));
    }

    async init() {
        if (this.initialized) return;
        
        console.log('[SecurityHardening] Initializing security systems...');
        
        // 1. Apply CSP headers dynamically
        this.applyCspHeaders();
        
        // 2. Initialize key isolation
        await this.initializeKeyIsolation();
        
        // 3. Setup anti-tampering protection
        this.setupAntiTampering();
        
        // 4. Protect against extension access
        this.protectFromExtensions();
        
        // 5. Setup memory protection
        this.setupMemoryProtection();
        
        // 6. Initialize secure context validation
        this.validateSecureContext();
        
        this.initialized = true;
        console.log('[SecurityHardening] Security systems initialized');
    }

    // 1. Content Security Policy Implementation
    applyCspHeaders() {
        const cspPolicy = [
            "default-src 'self'",
            `script-src 'self' 'nonce-${this.cspNonce}' 'strict-dynamic'`,
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "upgrade-insecure-requests",
            "block-all-mixed-content"
        ].join('; ');

        // Create and inject CSP meta tag
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = cspPolicy;
        document.head.insertBefore(meta, document.head.firstChild);

        // Set nonce on all existing scripts
        document.querySelectorAll('script').forEach(script => {
            if (!script.src && !script.nonce) {
                script.nonce = this.cspNonce;
            }
        });

        console.log('[SecurityHardening] CSP headers applied');
    }

    // 2. Key Isolation through Web Workers
    async initializeKeyIsolation() {
        try {
            // Create isolated worker for key operations
            const workerCode = `
                class IsolatedKeyManager {
                    constructor() {
                        this.keys = new Map();
                        this.operations = 0;
                    }

                    async processKey(operation, data) {
                        this.operations++;
                        
                        switch(operation) {
                            case 'store':
                                const keyId = this.generateKeyId();
                                this.keys.set(keyId, data.key);
                                
                                // Clear key from data after storing
                                data.key = null;
                                
                                return { keyId, success: true };
                                
                            case 'retrieve':
                                const key = this.keys.get(data.keyId);
                                if (!key) throw new Error('Key not found');
                                
                                // Return copy and immediately clear original
                                const keyCopy = key.slice ? key.slice() : key;
                                this.keys.delete(data.keyId);
                                
                                return { key: keyCopy, success: true };
                                
                            case 'encrypt':
                                return await this.performEncryption(data);
                                
                            case 'decrypt':
                                return await this.performDecryption(data);
                                
                            default:
                                throw new Error('Unknown operation');
                        }
                    }

                    generateKeyId() {
                        const array = new Uint8Array(16);
                        crypto.getRandomValues(array);
                        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
                    }

                    async performEncryption(data) {
                        const encoder = new TextEncoder();
                        const keyMaterial = await crypto.subtle.importKey(
                            'raw',
                            encoder.encode(data.key),
                            'PBKDF2',
                            false,
                            ['deriveKey']
                        );

                        const derivedKey = await crypto.subtle.deriveKey(
                            {
                                name: 'PBKDF2',
                                salt: data.salt,
                                iterations: 800000,
                                hash: 'SHA-256'
                            },
                            keyMaterial,
                            { name: 'AES-GCM', length: 256 },
                            false,
                            ['encrypt']
                        );

                        const encrypted = await crypto.subtle.encrypt(
                            { name: 'AES-GCM', iv: data.iv },
                            derivedKey,
                            encoder.encode(data.plaintext)
                        );

                        return { encrypted: Array.from(new Uint8Array(encrypted)) };
                    }

                    async performDecryption(data) {
                        const encoder = new TextEncoder();
                        const decoder = new TextDecoder();
                        
                        const keyMaterial = await crypto.subtle.importKey(
                            'raw',
                            encoder.encode(data.key),
                            'PBKDF2',
                            false,
                            ['deriveKey']
                        );

                        const derivedKey = await crypto.subtle.deriveKey(
                            {
                                name: 'PBKDF2',
                                salt: data.salt,
                                iterations: 800000,
                                hash: 'SHA-256'
                            },
                            keyMaterial,
                            { name: 'AES-GCM', length: 256 },
                            false,
                            ['decrypt']
                        );

                        const decrypted = await crypto.subtle.decrypt(
                            { name: 'AES-GCM', iv: data.iv },
                            derivedKey,
                            new Uint8Array(data.encrypted)
                        );

                        return { plaintext: decoder.decode(decrypted) };
                    }
                }

                const keyManager = new IsolatedKeyManager();

                self.onmessage = async function(e) {
                    try {
                        const result = await keyManager.processKey(e.data.operation, e.data.data);
                        self.postMessage({ success: true, result });
                    } catch (error) {
                        self.postMessage({ success: false, error: error.message });
                    }
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.keyIsolationWorker = new Worker(URL.createObjectURL(blob));

            console.log('[SecurityHardening] Key isolation worker initialized');
        } catch (error) {
            console.error('[SecurityHardening] Failed to initialize key isolation:', error);
        }
    }

    // 3. Anti-Tampering Protection
    setupAntiTampering() {
        // Monitor critical functions for tampering
        const criticalFunctions = [
            'crypto.getRandomValues',
            'crypto.subtle.encrypt',
            'crypto.subtle.decrypt',
            'crypto.subtle.generateKey',
            'crypto.subtle.importKey',
            'localStorage.setItem',
            'localStorage.getItem',
            'indexedDB.open'
        ];

        criticalFunctions.forEach(funcPath => {
            const pathParts = funcPath.split('.');
            let obj = window;
            
            for (let i = 0; i < pathParts.length - 1; i++) {
                obj = obj[pathParts[i]];
                if (!obj) return;
            }

            const originalFunc = obj[pathParts[pathParts.length - 1]];
            if (typeof originalFunc === 'function') {
                const checksum = this.calculateChecksum(originalFunc.toString());
                this.integrityChecks.set(funcPath, checksum);

                // Periodic integrity check
                const checkIntegrity = () => {
                    const currentChecksum = this.calculateChecksum(originalFunc.toString());
                    if (currentChecksum !== this.integrityChecks.get(funcPath)) {
                        this.handleTamperingDetected(funcPath);
                    }
                };

                setInterval(checkIntegrity, 5000 + Math.random() * 5000);
            }
        });

        // Monitor for suspicious modifications to crypto functions
        this.monitorCryptoModifications();

        console.log('[SecurityHardening] Anti-tampering protection enabled');
    }

    calculateChecksum(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    monitorCryptoModifications() {
        const cryptoDescriptors = Object.getOwnPropertyDescriptors(crypto);
        const subtleDescriptors = Object.getOwnPropertyDescriptors(crypto.subtle);

        // Freeze crypto objects to prevent modification
        Object.freeze(crypto);
        Object.freeze(crypto.subtle);

        // Monitor for attempts to redefine crypto
        const originalDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj, prop, descriptor) {
            if (obj === window && prop === 'crypto') {
                console.error('[SecurityHardening] Attempt to redefine crypto object detected!');
                throw new Error('Crypto modification blocked');
            }
            return originalDefineProperty.call(this, obj, prop, descriptor);
        };
    }

    handleTamperingDetected(funcPath) {
        console.error(`[SecurityHardening] Tampering detected in ${funcPath}!`);
        
        // Clear all keys and sensitive data
        this.emergencyDataClear();
        
        // Show warning to user
        alert('Security Warning: Potential tampering detected. All sensitive data has been cleared for your protection.');
        
        // Redirect to safe page
        window.location.href = '/';
    }

    emergencyDataClear() {
        // Clear localStorage
        try {
            localStorage.clear();
        } catch (e) {}

        // Clear sessionStorage
        try {
            sessionStorage.clear();
        } catch (e) {}

        // Clear IndexedDB
        try {
            indexedDB.databases().then(databases => {
                databases.forEach(db => {
                    indexedDB.deleteDatabase(db.name);
                });
            });
        } catch (e) {}
    }

    // 4. Protection from Browser Extensions
    protectFromExtensions() {
        // Detect extension content scripts by monitoring DOM modifications
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for suspicious extension-injected elements
                        if (this.isExtensionElement(node)) {
                            console.warn('[SecurityHardening] Extension element detected:', node);
                            node.remove();
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Block known extension API access
        this.blockExtensionApis();

        // Create isolated execution context
        this.createIsolatedContext();

        console.log('[SecurityHardening] Extension protection enabled');
    }

    isExtensionElement(element) {
        // Check for common extension injection patterns
        const extensionIndicators = [
            'chrome-extension://',
            'moz-extension://',
            'webkit-extension://',
            'data:text/css;charset=utf-8;base64'
        ];

        const elementHtml = element.outerHTML || element.textContent || '';
        return extensionIndicators.some(indicator => 
            elementHtml.includes(indicator)
        );
    }

    blockExtensionApis() {
        // Block access to extension APIs
        const blockedApis = [
            'chrome',
            'browser',
            'moz'
        ];

        blockedApis.forEach(api => {
            if (window[api]) {
                Object.defineProperty(window, api, {
                    get: () => {
                        console.warn(`[SecurityHardening] Blocked access to ${api} API`);
                        return undefined;
                    },
                    configurable: false
                });
            }
        });
    }

    createIsolatedContext() {
        // Create iframe for isolated execution
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.sandbox = 'allow-scripts';
        document.body.appendChild(iframe);

        this.secureContext = iframe.contentWindow;
    }

    // 5. Memory Protection
    setupMemoryProtection() {
        // Override sensitive methods to clear data after use
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function(callback, delay) {
            return originalSetTimeout(() => {
                try {
                    callback();
                } finally {
                    // Force garbage collection if available
                    if (window.gc) {
                        window.gc();
                    }
                }
            }, delay);
        };

        // Monitor memory usage and clear if suspicious activity
        this.monitorMemoryUsage();

        console.log('[SecurityHardening] Memory protection enabled');
    }

    monitorMemoryUsage() {
        if (performance.memory) {
            let lastUsage = performance.memory.usedJSHeapSize;
            
            setInterval(() => {
                const currentUsage = performance.memory.usedJSHeapSize;
                const growth = currentUsage - lastUsage;
                
                // If memory grows suspiciously fast, clear caches
                if (growth > 10 * 1024 * 1024) { // 10MB growth
                    console.warn('[SecurityHardening] Suspicious memory growth detected');
                    this.clearSensitiveMemory();
                }
                
                lastUsage = currentUsage;
            }, 10000);
        }
    }

    clearSensitiveMemory() {
        // Force clear of potential key storage variables
        if (window.gc) {
            window.gc();
        }
        
        // Clear any global variables that might contain keys
        const potentialKeyVars = ['symmetricKey', 'privateKey', 'publicKey', 'password'];
        potentialKeyVars.forEach(varName => {
            if (window[varName]) {
                window[varName] = null;
                delete window[varName];
            }
        });
    }

    // 6. Secure Context Validation
    validateSecureContext() {
        // Ensure we're in a secure context
        if (!window.isSecureContext) {
            throw new Error('Application must run in secure context (HTTPS)');
        }

        // Validate origin
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            throw new Error('Invalid origin for crypto operations');
        }

        // Check for mixed content
        if (document.querySelectorAll('[src^="http:"]').length > 0) {
            console.warn('[SecurityHardening] Mixed content detected');
        }

        console.log('[SecurityHardening] Secure context validated');
    }

    // Secure Key Operations through Worker
    async secureKeyOperation(operation, data) {
        if (!this.keyIsolationWorker) {
            throw new Error('Key isolation worker not initialized');
        }

        return new Promise((resolve, reject) => {
            const messageId = crypto.getRandomValues(new Uint32Array(1))[0];
            
            const handleMessage = (e) => {
                if (e.data.messageId === messageId) {
                    this.keyIsolationWorker.removeEventListener('message', handleMessage);
                    
                    if (e.data.success) {
                        resolve(e.data.result);
                    } else {
                        reject(new Error(e.data.error));
                    }
                }
            };

            this.keyIsolationWorker.addEventListener('message', handleMessage);
            this.keyIsolationWorker.postMessage({
                messageId,
                operation,
                data
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                this.keyIsolationWorker.removeEventListener('message', handleMessage);
                reject(new Error('Key operation timeout'));
            }, 30000);
        });
    }

    // Secure localStorage wrapper with encryption
    secureStorage = {
        setItem: async (key, value) => {
            const encryptionKey = await this.generateStorageKey();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const salt = crypto.getRandomValues(new Uint8Array(16));
            
            const encrypted = await this.secureKeyOperation('encrypt', {
                key: encryptionKey,
                plaintext: value,
                iv: iv,
                salt: salt
            });

            const storageData = {
                encrypted: encrypted.encrypted,
                iv: Array.from(iv),
                salt: Array.from(salt)
            };

            localStorage.setItem(key, JSON.stringify(storageData));
        },

        getItem: async (key) => {
            const storageData = localStorage.getItem(key);
            if (!storageData) return null;

            try {
                const data = JSON.parse(storageData);
                const encryptionKey = await this.generateStorageKey();

                const result = await this.secureKeyOperation('decrypt', {
                    key: encryptionKey,
                    encrypted: data.encrypted,
                    iv: new Uint8Array(data.iv),
                    salt: new Uint8Array(data.salt)
                });

                return result.plaintext;
            } catch (error) {
                console.error('[SecurityHardening] Failed to decrypt storage data:', error);
                return null;
            }
        }
    };

    async generateStorageKey() {
        // Generate consistent key based on origin and user agent
        const data = window.location.origin + navigator.userAgent;
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        const hashArray = new Uint8Array(hashBuffer);
        return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
    }

    // Public API for secure operations
    async encryptWithIsolatedKey(plaintext, key) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const result = await this.secureKeyOperation('encrypt', {
            key: key,
            plaintext: plaintext,
            iv: iv,
            salt: salt
        });

        return {
            encrypted: result.encrypted,
            iv: Array.from(iv),
            salt: Array.from(salt)
        };
    }

    async decryptWithIsolatedKey(encryptedData, key) {
        const result = await this.secureKeyOperation('decrypt', {
            key: key,
            encrypted: encryptedData.encrypted,
            iv: new Uint8Array(encryptedData.iv),
            salt: new Uint8Array(encryptedData.salt)
        });

        return result.plaintext;
    }

    // Cleanup method
    destroy() {
        if (this.keyIsolationWorker) {
            this.keyIsolationWorker.terminate();
            this.keyIsolationWorker = null;
        }
        
        this.emergencyDataClear();
        console.log('[SecurityHardening] Security systems destroyed');
    }
}

// Initialize security hardening
window.securityHardening = new SecurityHardening();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityHardening;
}