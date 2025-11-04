// Alpine.js app
function app() {
    return {
        message: '',
        customName: '',
        ttl: 30,
        processing: false,
        showModal: false,
        showToast: false,
        toastMessage: 'Copied to clipboard!',
        showDeleteModal: false,
        secretToDelete: null,
        showExportKeyModal: false,
        showImportKeyModal: false,
        exportedSymmetricKey: '',
        showExportedKey: false,
        importSymmetricKey: '',
        importingKey: false,
        links: {
            full: '',
            noKey: '',
            keyOnly: ''
        },
        credentials: {
            uid: '',
        },
        cryptoSystem: null,
        secrets: [],
        loadingSecrets: false,
        deletingSecrets: {},
        pagination: {
            page: 1,
            per_page: 10,
            total: 0,
            has_more: false
        },
        pendingSecrets: [],
        loadingPendingSecrets: false,
        pendingPagination: {
            page: 1,
            per_page: 10,
            total: 0,
            has_more: false
        },
        
        async init() {
            console.log('Main app init - Initializing security and crypto system...');
            
            // Initialize security hardening first
            try {
                if (window.securityHardening && typeof window.securityHardening.init === 'function') {
                    await window.securityHardening.init();
                    console.log('Security hardening initialized');
                } else {
                    console.warn('Security hardening not available - running without enhanced security');
                }
            } catch (error) {
                console.error('Failed to initialize security hardening:', error);
                console.warn('Continuing without enhanced security features');
            }
            
            // Clean up old localStorage entries
            localStorage.removeItem('uid');
            localStorage.removeItem('pass');
            
            try {
                // Initialize crypto system
                this.cryptoSystem = await initializeCryptoSystem();
                
                // Generate User ID from symmetric key
                await this.updateUserIdFromSymmetricKey();
                
                console.log('Crypto system initialized, UID:', this.credentials.uid);
                
                // Load secrets on init
                this.loadSecrets();
                this.loadPendingSecrets();
            } catch (error) {
                console.error('Failed to initialize crypto system:', error);
                alert('Failed to initialize encryption system: ' + error.message);
            }
            
            // Watch for modal close to update lists
            this.$watch('showModal', (newValue, oldValue) => {
                if (oldValue === true && newValue === false) {
                    // Modal was closed - reload lists and clear form
                    this.message = '';
                    this.customName = '';
                    this.loadSecrets();
                    this.loadPendingSecrets();
                }
            });
        },
        
        async updateUserIdFromSymmetricKey() {
            try {
                const symmetricKey = await getDecryptedSymmetricKey(this.cryptoSystem.keyPair);
                this.credentials.uid = await generateUserIdFromSymmetricKey(symmetricKey);
                
                // Clear symmetric key from memory
                clearSymmetricKeyFromMemory(symmetricKey);
            } catch (error) {
                console.error('Failed to generate User ID:', error);
                this.credentials.uid = 'Error loading';
            }
        },
        
        async regenerateCryptoSystem() {
            if (!confirm('This will regenerate your entire crypto system. You will lose access to all current secrets. Continue?')) {
                return;
            }
            
            try {
                // Clear IndexedDB keys
                if (this.cryptoSystem.keyStorage) {
                    await this.cryptoSystem.keyStorage.clearKeys();
                }
                
                // Clear localStorage
                localStorage.removeItem('inigma_encrypted_symmetric_key');
                
                // Reinitialize crypto system
                this.cryptoSystem = await initializeCryptoSystem();
                
                // Update User ID
                await this.updateUserIdFromSymmetricKey();
                
                // Show success message
                this.toastMessage = 'Crypto system regenerated!';
                this.showToast = true;
                setTimeout(() => this.showToast = false, 3000);
                
                // Reload secrets (should be empty now)
                this.loadSecrets();
                this.loadPendingSecrets();
                
            } catch (error) {
                console.error('Failed to regenerate crypto system:', error);
                alert('Failed to regenerate crypto system: ' + error.message);
            }
        },
        
        
        async processMessage() {
            if (!this.message || this.processing) return;
            
            this.processing = true;
            
            try {
                // Generate new unique symmetric key for this secret (not the user's main key)
                const secretSymmetricKey = generateSymmetricKey();
                
                const salt = window.crypto.getRandomValues(new Uint8Array(16));
                const iv = window.crypto.getRandomValues(new Uint8Array(16));
                
                const encrypted = await encrypt(this.message, salt, iv, secretSymmetricKey);
                
                const response = await fetch('/api/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        encrypted_message: arrayBufferToBase64(encrypted),
                        iv: arrayBufferToBase64(iv),
                        salt: arrayBufferToBase64(salt),
                        ttl: parseInt(this.ttl) || 0,
                        custom_name: this.customName,
                        creator_uid: this.credentials.uid
                    })
                });
                
                const data = await response.json();
                
                this.links.full = `${data.url}view?view=${data.view}#key=${encodeURIComponent(secretSymmetricKey)}`;
                this.links.noKey = `${data.url}view?view=${data.view}`;
                this.links.keyOnly = secretSymmetricKey;
                
                
                // Clear secret symmetric key from memory
                clearSymmetricKeyFromMemory(secretSymmetricKey);
                
                // Auto-copy full link
                await navigator.clipboard.writeText(this.links.full);
                this.toastMessage = 'Link copied to clipboard!';
                this.showToast = true;
                setTimeout(() => this.showToast = false, 3000);
                
                this.showModal = true;
            } catch (error) {
                console.error('Error:', error);
                if (error.message.includes('Crypto API not available')) {
                    alert('Crypto API not available. Please use HTTPS or access via localhost.');
                } else {
                    alert('Failed to create secure link: ' + error.message);
                }
            } finally {
                this.processing = false;
            }
        },
        
        async copyToClipboard(text) {
            await navigator.clipboard.writeText(text);
            this.toastMessage = 'Copied to clipboard!';
            this.showToast = true;
            setTimeout(() => this.showToast = false, 3000);
        },
        
        async exportSymmetricKey() {
            try {
                const symmetricKey = await getDecryptedSymmetricKey(this.cryptoSystem.keyPair);
                this.exportedSymmetricKey = symmetricKey;
                this.showExportedKey = false;
                this.showExportKeyModal = true;
                
                // Clear symmetric key from memory after showing modal
                setTimeout(() => {
                    clearSymmetricKeyFromMemory(symmetricKey);
                }, 100);
            } catch (error) {
                console.error('Failed to export symmetric key:', error);
                alert('Failed to export key: ' + error.message);
            }
        },
        
        toggleExportedKeyVisibility() {
            this.showExportedKey = !this.showExportedKey;
        },
        
        async copyExportedKeyToClipboard() {
            await navigator.clipboard.writeText(this.exportedSymmetricKey);
            this.toastMessage = 'Key copied to clipboard!';
            this.showToast = true;
            setTimeout(() => this.showToast = false, 3000);
        },
        
        closeImportKeyModal() {
            this.showImportKeyModal = false;
            this.importSymmetricKey = '';
            this.importingKey = false;
        },
        
        async saveImportedKey() {
            if (!this.importSymmetricKey.trim()) {
                alert('Please enter a symmetric key');
                return;
            }
            
            this.importingKey = true;
            
            try {
                // Encrypt the imported symmetric key with current RSA public key
                const encryptedSymmetricKey = await encryptSymmetricKey(
                    this.importSymmetricKey.trim(), 
                    this.cryptoSystem.keyPair.publicKey
                );
                
                // Save to localStorage
                localStorage.setItem('inigma_encrypted_symmetric_key', encryptedSymmetricKey);
                
                // Update User ID
                await this.updateUserIdFromSymmetricKey();
                
                // Close modal and clear data
                this.closeImportKeyModal();
                
                // Show success message
                this.toastMessage = 'Key imported successfully!';
                this.showToast = true;
                setTimeout(() => this.showToast = false, 3000);
                
                // Reload secrets with new key
                this.loadSecrets();
                this.loadPendingSecrets();
                
            } catch (error) {
                console.error('Failed to import symmetric key:', error);
                alert('Failed to import key: ' + error.message);
            } finally {
                this.importingKey = false;
            }
        },
        
        async loadSecrets(page = 1) {
            this.loadingSecrets = true;
            
            try {
                const response = await fetch('/api/list-secrets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: this.credentials.uid,
                        page: page,
                        per_page: 10
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    this.secrets = data.secrets;
                    this.pagination = {
                        page: data.page,
                        per_page: data.per_page,
                        total: data.total,
                        has_more: data.has_more
                    };
                } else {
                    console.error('Error loading secrets:', data);
                    this.secrets = [];
                }
            } catch (error) {
                console.error('Error loading secrets:', error);
                this.secrets = [];
            } finally {
                this.loadingSecrets = false;
            }
        },
        
        async loadPendingSecrets(page = 1) {
            this.loadingPendingSecrets = true;
            
            try {
                const response = await fetch('/api/list-pending-secrets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uid: this.credentials.uid,
                        page: page,
                        per_page: 10
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    this.pendingSecrets = data.secrets;
                    this.pendingPagination = {
                        page: data.page,
                        per_page: data.per_page,
                        total: data.total,
                        has_more: data.has_more
                    };
                } else {
                    console.error('Error loading pending secrets:', data);
                    this.pendingSecrets = [];
                }
            } catch (error) {
                console.error('Error loading pending secrets:', error);
                this.pendingSecrets = [];
            } finally {
                this.loadingPendingSecrets = false;
            }
        },
        
        generatePendingSecretLink(secretId) {
            const domain = window.location.origin;
            return `${domain}/view?view=${secretId}`;
        },
        
        async updateSecretName(secret, newName) {
            const sanitizedName = SecurityUtils.sanitizeCustomName(newName);
            
            if (secret.custom_name === sanitizedName) return;
            
            // Rate limiting check
            if (!SecurityUtils.checkRateLimit(`updateSecret_${secret.id}`, 5, 60000)) {
                alert('Too many update requests. Please wait a moment.');
                return;
            }
            
            secret.updating = true;
            
            try {
                const response = await fetch('/api/update-custom-name', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        view: secret.id,
                        uid: this.credentials.uid,
                        custom_name: sanitizedName
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.status === 'success') {
                    secret.custom_name = sanitizedName;
                    this.toastMessage = 'Secret name updated!';
                    this.showToast = true;
                    setTimeout(() => this.showToast = false, 3000);
                } else {
                    alert('Failed to update secret name: ' + SecurityUtils.sanitizeText(data.message || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error updating secret name:', error);
                alert('Failed to update secret name');
            } finally {
                secret.updating = false;
            }
        },
        
        async openSecret(secretId) {
            try {
                // For owned secrets, open without key parameter - they should be encrypted with user's main key
                const url = `/view?view=${secretId}`;
                window.open(url, '_blank');
            } catch (error) {
                console.error('Failed to open secret:', error);
                alert('Failed to open secret: ' + error.message);
            }
        },
        
        async deleteSecret(secret) {
            this.secretToDelete = secret;
            this.showDeleteModal = true;
        },
        
        cancelDelete() {
            this.showDeleteModal = false;
            this.secretToDelete = null;
        },
        
        async confirmDelete() {
            const secret = this.secretToDelete;
            if (!secret) return;
            
            this.deletingSecrets[secret.id] = true;
            
            try {
                const response = await fetch('/api/delete-secret', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        view: secret.id,
                        uid: this.credentials.uid
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.status === 'success') {
                    // Remove secret from both lists
                    const secretsIndex = this.secrets.findIndex(s => s.id === secret.id);
                    if (secretsIndex !== -1) {
                        this.secrets.splice(secretsIndex, 1);
                    }
                    const pendingIndex = this.pendingSecrets.findIndex(s => s.id === secret.id);
                    if (pendingIndex !== -1) {
                        this.pendingSecrets.splice(pendingIndex, 1);
                    }
                    
                    this.toastMessage = 'Secret deleted successfully!';
                    this.showToast = true;
                    setTimeout(() => this.showToast = false, 3000);
                    
                    // Close modal
                    this.showDeleteModal = false;
                    this.secretToDelete = null;
                } else {
                    alert('Failed to delete secret: ' + SecurityUtils.sanitizeText(data.message || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error deleting secret:', error);
                alert('Failed to delete secret');
            } finally {
                delete this.deletingSecrets[secret.id];
            }
        },
        
        async regenerateCryptoSystem() {
            if (!confirm('This will regenerate your entire crypto system. You will lose access to all current secrets. Continue?')) {
                return;
            }
            
            try {
                // Clear IndexedDB keys
                if (this.cryptoSystem.keyStorage) {
                    await this.cryptoSystem.keyStorage.clearKeys();
                }
                
                // Clear localStorage
                localStorage.removeItem('inigma_encrypted_symmetric_key');
                
                // Reinitialize crypto system
                this.cryptoSystem = await initializeCryptoSystem();
                
                // Update User ID
                await this.updateUserIdFromSymmetricKey();
                
                // Show success message
                this.toastMessage = 'Crypto system regenerated!';
                this.showToast = true;
                setTimeout(() => this.showToast = false, 3000);
                
                // Reload secrets (should be empty now)
                this.loadSecrets();
                this.loadPendingSecrets();
                
            } catch (error) {
                console.error('Failed to regenerate crypto system:', error);
                alert('Failed to regenerate crypto system: ' + error.message);
            }
        },
    }
}