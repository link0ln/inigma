// Fallback crypto functions for non-HTTPS environments
// WARNING: This is less secure than client-side encryption!

const FallbackCrypto = {
    // Simple XOR encryption as fallback (NOT CRYPTOGRAPHICALLY SECURE!)
    // This is only for development/testing when HTTPS is not available
    
    generateKey: function(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let key = '';
        for (let i = 0; i < length; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    },
    
    xorEncrypt: function(text, key) {
        let encrypted = '';
        for (let i = 0; i < text.length; i++) {
            encrypted += String.fromCharCode(
                text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return btoa(encrypted); // Base64 encode
    },
    
    xorDecrypt: function(encryptedBase64, key) {
        let encrypted = atob(encryptedBase64); // Base64 decode
        let decrypted = '';
        for (let i = 0; i < encrypted.length; i++) {
            decrypted += String.fromCharCode(
                encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return decrypted;
    },
    
    // Wrapper functions to match the main API
    encrypt: async function(plaintext, salt, iv, password) {
        // Combine salt, iv, and password to create a key
        const combinedKey = btoa(salt + ':' + iv + ':' + password);
        const encrypted = this.xorEncrypt(plaintext, combinedKey);
        
        // Return as ArrayBuffer to match the API
        const encoder = new TextEncoder();
        return encoder.encode(encrypted).buffer;
    },
    
    decrypt: async function(encryptedData, salt, iv, password) {
        // Convert ArrayBuffer to string
        const decoder = new TextDecoder();
        const encryptedStr = decoder.decode(encryptedData);
        
        // Combine salt, iv, and password to create a key
        const combinedKey = btoa(salt + ':' + iv + ':' + password);
        const decrypted = this.xorDecrypt(encryptedStr, combinedKey);
        
        // Return as ArrayBuffer to match the API
        const encoder = new TextEncoder();
        return encoder.encode(decrypted).buffer;
    },
    
    showWarning: function() {
        console.warn('⚠️ Using fallback encryption. This is NOT secure!');
        console.warn('Please use HTTPS for production deployment.');
        
        // Show warning in UI
        const warningEl = document.createElement('div');
        warningEl.className = 'fixed top-4 right-4 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg z-50';
        warningEl.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i>Insecure mode - For testing only!';
        document.body.appendChild(warningEl);
        
        setTimeout(() => {
            warningEl.remove();
        }, 5000);
    }
};

// Override crypto functions if Web Crypto API is not available
if (!window.crypto || !window.crypto.subtle) {
    console.warn('Web Crypto API not available. Using fallback encryption.');
    
    // Create a mock crypto.subtle interface
    window.crypto = window.crypto || {};
    window.crypto.subtle = {
        importKey: async () => ({ mock: true }),
        deriveKey: async () => ({ mock: true }),
        encrypt: async (algo, key, data) => {
            const decoder = new TextDecoder();
            const text = decoder.decode(data);
            const password = 'fallback-key'; // This is not secure!
            return FallbackCrypto.encrypt(text, new Uint8Array(16), new Uint8Array(16), password);
        },
        decrypt: async (algo, key, data) => {
            const password = 'fallback-key'; // This is not secure!
            return FallbackCrypto.decrypt(data, new Uint8Array(16), new Uint8Array(16), password);
        }
    };
    
    // Override the main encrypt/decrypt functions
    window.encryptFallback = FallbackCrypto.encrypt.bind(FallbackCrypto);
    window.decryptFallback = FallbackCrypto.decrypt.bind(FallbackCrypto);
    
    // Show warning on page load
    document.addEventListener('DOMContentLoaded', () => {
        FallbackCrypto.showWarning();
    });
}
