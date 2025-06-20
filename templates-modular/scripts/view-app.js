// Alpine.js view app
function viewApp() {
    return {
        loading: true,
        error: false,
        errorMessage: '',
        needPassword: false,
        password: '',
        decrypting: false,
        decryptError: false,
        decryptedMessage: '',
        showToast: false,
        isOwner: false,
        messageData: null,
        
        async init() {
            const urlParams = new URLSearchParams(window.location.search);
            const view = SecurityUtils.sanitizeUrlParam(urlParams.get('view') || '');
            const urlKey = SecurityUtils.sanitizeUrlParam(urlParams.get('key') || '');
            
            if (!view || !SecurityUtils.isValidMessageId(view)) {
                this.showError('Invalid or missing message ID');
                return;
            }
            
            // Get local credentials
            const uid = localStorage.getItem('uid') || this.generateAndSaveUid();
            
            try {
                const response = await fetch('/api/view', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ view, uid })
                });
                
                const data = await response.json();
                
                if (data.redirect_root === 'true') {
                    this.showError(data.message);
                    return;
                }
                
                this.messageData = data;
                this.isOwner = data.uid === uid;
                
                // Try to decrypt
                if (this.isOwner) {
                    // Use local password
                    await this.decryptMessage(localStorage.getItem('pass'));
                } else if (urlKey) {
                    // Use URL key
                    await this.decryptMessage(urlKey);
                } else {
                    // Need password
                    this.needPassword = true;
                    this.loading = false;
                }
            } catch (error) {
                console.error('Error loading message:', error);
                this.showError('Failed to load message');
            }
        },
        
        generateAndSaveUid() {
            const uid = generatePassword(12);
            const pass = generatePassword(24);
            localStorage.setItem('uid', uid);
            localStorage.setItem('pass', pass);
            return uid;
        },
        
        async decryptMessage(password) {
            try {
                const encrypted = base64ToArrayBuffer(this.messageData.encrypted_message);
                const iv = base64ToArrayBuffer(this.messageData.iv);
                const salt = base64ToArrayBuffer(this.messageData.salt);
                
                const decrypted = await decrypt(encrypted, salt, iv, password);
                this.decryptedMessage = new TextDecoder().decode(decrypted);
                
                // If not owner and successful, update ownership
                if (!this.isOwner) {
                    await this.updateOwnership(this.decryptedMessage);
                }
                
                this.loading = false;
                this.needPassword = false;
                this.decryptError = false;
            } catch (error) {
                console.error('Decryption failed:', error);
                if (this.needPassword) {
                    this.decryptError = true;
                } else {
                    this.needPassword = true;
                    this.loading = false;
                }
            }
        },
        
        async updateOwnership(message) {
            const urlParams = new URLSearchParams(window.location.search);
            const view = urlParams.get('view');
            const uid = localStorage.getItem('uid');
            const password = localStorage.getItem('pass');
            
            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            const iv = window.crypto.getRandomValues(new Uint8Array(16));
            
            const encrypted = await encrypt(message, salt, iv, password);
            
            await fetch('/api/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    view,
                    uid,
                    encrypted_message: arrayBufferToBase64(encrypted),
                    iv: arrayBufferToBase64(iv),
                    salt: arrayBufferToBase64(salt)
                })
            });
        },
        
        async decryptWithPassword() {
            if (!this.password || this.decrypting) return;
            
            this.decrypting = true;
            this.decryptError = false;
            
            await this.decryptMessage(this.password);
            this.decrypting = false;
        },
        
        showError(message) {
            this.error = true;
            this.errorMessage = SecurityUtils.sanitizeText(message);
            this.loading = false;
        },
        
        async copyMessage() {
            await navigator.clipboard.writeText(this.decryptedMessage);
            this.showToast = true;
            setTimeout(() => this.showToast = false, 3000);
        }
    }
}