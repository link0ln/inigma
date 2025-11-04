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

            // Read encryption key from URL fragment (hash) - NOT sent to server!
            const hash = window.location.hash.substring(1); // Remove # symbol
            const hashParams = new URLSearchParams(hash);
            const urlKey = SecurityUtils.sanitizeUrlParam(hashParams.get('key') || '');

            // Immediately clean URL to remove key from address bar
            if (urlKey) {
                window.history.replaceState(null, '', `/view?view=${view}`);
            }

            if (!view || !SecurityUtils.isValidMessageId(view)) {
                this.showError('Invalid or missing message ID');
                return;
            }

            // Initialize crypto system to get User ID
            let uid;
            try {
                const cryptoSystem = await initializeCryptoSystem();
                const symmetricKey = await getDecryptedSymmetricKey(cryptoSystem.keyPair);
                uid = await generateUserIdFromSymmetricKey(symmetricKey);
                clearSymmetricKeyFromMemory(symmetricKey);
                console.log('Generated UID from crypto system for view:', uid);
            } catch (error) {
                console.error('Failed to initialize crypto system for view:', error);
                // Fallback to a temporary UID for this session
                uid = 'temp_' + Math.random().toString(36).substring(2, 14);
                console.log('Using temporary UID for view:', uid);
            }
            
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
                this.isOwner = data.is_owner;
                
                // Try to decrypt
                if (urlKey) {
                    // Decode URI component and use provided key
                    const decodedKey = decodeURIComponent(urlKey);
                    await this.decryptMessage(decodedKey);
                } else if (this.isOwner) {
                    // For owned secrets, use user's main symmetric key
                    try {
                        const cryptoSystem = await initializeCryptoSystem();
                        const mainSymmetricKey = await getDecryptedSymmetricKey(cryptoSystem.keyPair);
                        await this.decryptMessage(mainSymmetricKey);
                        clearSymmetricKeyFromMemory(mainSymmetricKey);
                    } catch (error) {
                        console.error('Failed to decrypt with main key:', error);
                        this.needPassword = true;
                        this.loading = false;
                    }
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
            
            try {
                // Initialize crypto system to get UID and re-encrypt with user's main key
                const cryptoSystem = await initializeCryptoSystem();
                const symmetricKey = await getDecryptedSymmetricKey(cryptoSystem.keyPair);
                const uid = await generateUserIdFromSymmetricKey(symmetricKey);
                
                // Re-encrypt the message with user's main symmetric key
                const salt = window.crypto.getRandomValues(new Uint8Array(16));
                const iv = window.crypto.getRandomValues(new Uint8Array(16));
                const encrypted = await encrypt(message, salt, iv, symmetricKey);
                
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
                
                // Update local state - now user is owner
                this.isOwner = true;
                
                // Clear symmetric key from memory
                clearSymmetricKeyFromMemory(symmetricKey);
                
            } catch (error) {
                console.error('Failed to update ownership:', error);
                throw error;
            }
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