// Security Hardening Module - Secure Context Validation
class SecurityHardening {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        console.log('[SecurityHardening] Initializing security systems...');

        this.validateSecureContext();

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
}

// Initialize security hardening
window.securityHardening = new SecurityHardening();
