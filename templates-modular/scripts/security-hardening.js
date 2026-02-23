// Security Hardening Module - Key Isolation via Web Workers
class SecurityHardening {
    constructor() {
        this.initialized = false;
        this.keyIsolationWorker = null;
    }

    async init() {
        if (this.initialized) return;

        console.log('[SecurityHardening] Initializing security systems...');

        // 1. Validate secure context
        this.validateSecureContext();

        // 2. Initialize key isolation worker
        await this.initializeKeyIsolation();

        this.initialized = true;
        console.log('[SecurityHardening] Security systems initialized');
    }

    // Secure Context Validation
    validateSecureContext() {
        if (!window.isSecureContext) {
            throw new Error('Application must run in secure context (HTTPS)');
        }

        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            throw new Error('Invalid origin for crypto operations');
        }

        console.log('[SecurityHardening] Secure context validated');
    }

    // Key Isolation through Web Workers
    async initializeKeyIsolation() {
        try {
            const workerCode = `
                class IsolatedKeyManager {
                    constructor() {
                        this.keys = new Map();
                    }

                    async processKey(operation, data) {
                        switch(operation) {
                            case 'store': {
                                const keyId = this.generateKeyId();
                                this.keys.set(keyId, data.key);
                                data.key = null;
                                return { keyId, success: true };
                            }
                            case 'retrieve': {
                                const key = this.keys.get(data.keyId);
                                if (!key) throw new Error('Key not found');
                                const keyCopy = key.slice ? key.slice() : key;
                                this.keys.delete(data.keyId);
                                return { key: keyCopy, success: true };
                            }
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
                            'raw', encoder.encode(data.key), 'PBKDF2', false, ['deriveKey']
                        );
                        const derivedKey = await crypto.subtle.deriveKey(
                            { name: 'PBKDF2', salt: data.salt, iterations: 800000, hash: 'SHA-256' },
                            keyMaterial,
                            { name: 'AES-GCM', length: 256 },
                            false, ['encrypt']
                        );
                        const encrypted = await crypto.subtle.encrypt(
                            { name: 'AES-GCM', iv: data.iv }, derivedKey, encoder.encode(data.plaintext)
                        );
                        return { encrypted: Array.from(new Uint8Array(encrypted)) };
                    }

                    async performDecryption(data) {
                        const encoder = new TextEncoder();
                        const decoder = new TextDecoder();
                        const keyMaterial = await crypto.subtle.importKey(
                            'raw', encoder.encode(data.key), 'PBKDF2', false, ['deriveKey']
                        );
                        const derivedKey = await crypto.subtle.deriveKey(
                            { name: 'PBKDF2', salt: data.salt, iterations: 800000, hash: 'SHA-256' },
                            keyMaterial,
                            { name: 'AES-GCM', length: 256 },
                            false, ['decrypt']
                        );
                        const decrypted = await crypto.subtle.decrypt(
                            { name: 'AES-GCM', iv: data.iv }, derivedKey, new Uint8Array(data.encrypted)
                        );
                        return { plaintext: decoder.decode(decrypted) };
                    }
                }

                const keyManager = new IsolatedKeyManager();

                self.onmessage = async function(e) {
                    try {
                        const result = await keyManager.processKey(e.data.operation, e.data.data);
                        self.postMessage({ success: true, result, messageId: e.data.messageId });
                    } catch (error) {
                        self.postMessage({ success: false, error: error.message, messageId: e.data.messageId });
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
            this.keyIsolationWorker.postMessage({ messageId, operation, data });

            setTimeout(() => {
                this.keyIsolationWorker.removeEventListener('message', handleMessage);
                reject(new Error('Key operation timeout'));
            }, 30000);
        });
    }

    // Public API
    async encryptWithIsolatedKey(plaintext, key) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const result = await this.secureKeyOperation('encrypt', {
            key, plaintext, iv, salt
        });

        return {
            encrypted: result.encrypted,
            iv: Array.from(iv),
            salt: Array.from(salt)
        };
    }

    async decryptWithIsolatedKey(encryptedData, key) {
        const result = await this.secureKeyOperation('decrypt', {
            key,
            encrypted: encryptedData.encrypted,
            iv: new Uint8Array(encryptedData.iv),
            salt: new Uint8Array(encryptedData.salt)
        });

        return result.plaintext;
    }

    // Cleanup
    destroy() {
        if (this.keyIsolationWorker) {
            this.keyIsolationWorker.terminate();
            this.keyIsolationWorker = null;
        }
        console.log('[SecurityHardening] Security systems destroyed');
    }
}

// Initialize security hardening
window.securityHardening = new SecurityHardening();
