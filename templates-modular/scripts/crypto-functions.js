// Crypto functions
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// Convert URL-safe base64 key back to regular format for crypto operations
function decodeUrlSafeKey(urlSafeKey) {
    // Restore base64 padding and special characters
    let key = urlSafeKey
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    // Add padding if needed
    while (key.length % 4) {
        key += '=';
    }
    
    return key;
}

// IndexedDB utilities for storing non-extractable keys
class KeyStorage {
    constructor() {
        this.dbName = 'InigmaCryptoKeys';
        this.dbVersion = 1;
        this.storeName = 'keys';
    }

    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    async storeKeyPair(keyPair) {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.put({
                id: 'rsa_keypair',
                publicKey: keyPair.publicKey,
                privateKey: keyPair.privateKey
            });
            
            request.onsuccess = () => {
                db.close();
                resolve();
            };
            
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    }

    async getKeyPair() {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.get('rsa_keypair');
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    resolve({
                        publicKey: result.publicKey,
                        privateKey: result.privateKey
                    });
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async clearKeys() {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.delete('rsa_keypair');
            
            request.onsuccess = () => {
                db.close();
                resolve();
            };
            
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    }
}

// Generate RSA key pair for asymmetric encryption (non-extractable)
async function generateAsymmetricKeyPair() {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Crypto API not available. Please use HTTPS or localhost.');
    }
    
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        false, // Non-extractable for security
        ["encrypt", "decrypt"]
    );
}

// Generate symmetric key for secrets encryption
function generateSymmetricKey(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(array[i] % chars.length);
    }
    return result;
}

// Encrypt symmetric key with RSA public key
async function encryptSymmetricKey(symmetricKey, publicKey) {
    const enc = new TextEncoder();
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "RSA-OAEP",
        },
        publicKey,
        enc.encode(symmetricKey)
    );
    return arrayBufferToBase64(encrypted);
}

// Decrypt symmetric key with RSA private key
async function decryptSymmetricKey(encryptedSymmetricKey, privateKey) {
    const encryptedBuffer = base64ToArrayBuffer(encryptedSymmetricKey);
    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "RSA-OAEP",
        },
        privateKey,
        encryptedBuffer
    );
    const dec = new TextDecoder();
    return dec.decode(decrypted);
}

// Generate User ID from symmetric key using SHA-256
async function generateUserIdFromSymmetricKey(symmetricKey) {
    const enc = new TextEncoder();
    const keyData = enc.encode(symmetricKey);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', keyData);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 12); // First 12 characters
}

// Initialize or get stored asymmetric keys and encrypted symmetric key
async function initializeCryptoSystem() {
    const ENCRYPTED_SYMMETRIC_KEY_STORAGE_KEY = 'inigma_encrypted_symmetric_key';
    const keyStorage = new KeyStorage();
    
    let keyPair, encryptedSymmetricKey;
    
    // Try to load existing RSA keys from IndexedDB
    try {
        keyPair = await keyStorage.getKeyPair();
        if (keyPair) {
            console.log('RSA keys loaded from IndexedDB successfully');
        }
    } catch (error) {
        console.log('Failed to load RSA keys from IndexedDB:', error);
        keyPair = null;
    }
    
    // If no RSA keys or failed to load, generate new ones
    if (!keyPair) {
        console.log('Generating new RSA key pair...');
        keyPair = await generateAsymmetricKeyPair();
        
        // Store the new RSA keys in IndexedDB
        try {
            await keyStorage.storeKeyPair(keyPair);
            console.log('New RSA keys generated and stored in IndexedDB');
        } catch (error) {
            console.error('Failed to store RSA keys in IndexedDB:', error);
            // Continue anyway - keys will be in memory for this session
        }
    }
    
    // Check for existing encrypted symmetric key
    encryptedSymmetricKey = localStorage.getItem(ENCRYPTED_SYMMETRIC_KEY_STORAGE_KEY);
    
    if (!encryptedSymmetricKey) {
        console.log('Generating new symmetric key...');
        // Generate and encrypt new symmetric key
        const symmetricKey = generateSymmetricKey();
        encryptedSymmetricKey = await encryptSymmetricKey(symmetricKey, keyPair.publicKey);
        localStorage.setItem(ENCRYPTED_SYMMETRIC_KEY_STORAGE_KEY, encryptedSymmetricKey);
        
        // Clear symmetric key from memory
        clearSymmetricKeyFromMemory(symmetricKey);
        console.log('New symmetric key generated and encrypted');
    } else {
        console.log('Using existing encrypted symmetric key');
        
        // Test if we can decrypt the stored key with current RSA keys
        try {
            const testDecrypt = await decryptSymmetricKey(encryptedSymmetricKey, keyPair.privateKey);
            clearSymmetricKeyFromMemory(testDecrypt);
            console.log('Successfully verified encrypted symmetric key');
        } catch (error) {
            console.log('Cannot decrypt stored symmetric key with current RSA keys, generating new one');
            // Generate new symmetric key and encrypt with current RSA keys
            const symmetricKey = generateSymmetricKey();
            encryptedSymmetricKey = await encryptSymmetricKey(symmetricKey, keyPair.publicKey);
            localStorage.setItem(ENCRYPTED_SYMMETRIC_KEY_STORAGE_KEY, encryptedSymmetricKey);
            clearSymmetricKeyFromMemory(symmetricKey);
        }
    }
    
    return { keyPair, encryptedSymmetricKey, keyStorage };
}

// Get decrypted symmetric key for operations
async function getDecryptedSymmetricKey(keyPair) {
    const ENCRYPTED_SYMMETRIC_KEY_STORAGE_KEY = 'inigma_encrypted_symmetric_key';
    const encryptedSymmetricKey = localStorage.getItem(ENCRYPTED_SYMMETRIC_KEY_STORAGE_KEY);
    
    if (!encryptedSymmetricKey) {
        throw new Error('No encrypted symmetric key found');
    }
    
    return await decryptSymmetricKey(encryptedSymmetricKey, keyPair.privateKey);
}

// Clear symmetric key from memory (for security)
function clearSymmetricKeyFromMemory(symmetricKey) {
    if (typeof symmetricKey === 'string') {
        // Overwrite string with random data
        symmetricKey = null;
    }
}

async function getKeyMaterial(password) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Crypto API not available. Please use HTTPS or localhost.');
    }
    const enc = new TextEncoder();
    return window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );
}

async function encrypt(plaintext, salt, iv, password) {
    const enc = new TextEncoder();
    const keyMaterial = await getKeyMaterial(password);
    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 800000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    return window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(plaintext)
    );
}

async function decrypt(encryptedData, salt, iv, password) {
    const keyMaterial = await getKeyMaterial(password);
    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 800000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    return window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encryptedData
    );
}

function generatePassword(length) {
    // Use cryptographically secure random generation
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(array[i] % chars.length);
    }
    return result;
}
