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
        showCredentials: false,
        links: {
            full: '',
            noKey: '',
            keyOnly: ''
        },
        credentials: {
            uid: localStorage.getItem('uid') || generatePassword(12),
            pass: localStorage.getItem('pass') || generatePassword(24)
        },
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
        
        init() {
            console.log('Main app init - UID:', this.credentials.uid);
            // Save credentials if new
            if (!localStorage.getItem('uid')) {
                localStorage.setItem('uid', this.credentials.uid);
                console.log('Saved new UID to localStorage:', this.credentials.uid);
            }
            if (!localStorage.getItem('pass')) {
                localStorage.setItem('pass', this.credentials.pass);
            }
            
            // Load secrets on init
            this.loadSecrets();
            this.loadPendingSecrets();
            
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
        
        async processMessage() {
            if (!this.message || this.processing) return;
            
            this.processing = true;
            const password = generatePassword(20);
            
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            const iv = window.crypto.getRandomValues(new Uint8Array(16));
            
            try {
                const encrypted = await encrypt(this.message, salt, iv, password);
                
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
                
                this.links.full = `${data.url}view?view=${data.view}&key=${password}`;
                this.links.noKey = `${data.url}view?view=${data.view}`;
                this.links.keyOnly = password;
                
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
        
        saveCredentials() {
            // Save both UID and password to localStorage
            localStorage.setItem('uid', this.credentials.uid);
            localStorage.setItem('pass', this.credentials.pass);
            
            // Show brief confirmation
            this.toastMessage = 'Credentials saved!';
            this.showToast = true;
            setTimeout(() => this.showToast = false, 2000);
        },
        
        regenerateCredentials() {
            if (confirm('This will regenerate your credentials. You will lose access to any messages encrypted with current credentials. Continue?')) {
                this.credentials.uid = generatePassword(12);
                this.credentials.pass = generatePassword(24);
                localStorage.setItem('uid', this.credentials.uid);
                localStorage.setItem('pass', this.credentials.pass);
                this.loadSecrets(); // Reload secrets with new credentials
                this.loadPendingSecrets(); // Reload pending secrets
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
        
        openSecret(secretId) {
            const url = `/view?view=${secretId}&uid=${this.credentials.uid}`;
            window.open(url, '_blank');
        },
        
        async deleteSecret(secret) {
            if (!confirm(`Are you sure you want to delete "${secret.custom_name || 'Untitled Secret'}"? This action cannot be undone.`)) {
                return;
            }
            
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
        
    }
}