// Reuse crypto functions from index
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

async function getKeyMaterial(password) {
    const enc = new TextEncoder();
    return window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );
}

async function decrypt(encryptedData, salt, iv, password) {
    const keyMaterial = await getKeyMaterial(password);
    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
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

async function encrypt(plaintext, salt, iv, password) {
    const enc = new TextEncoder();
    const keyMaterial = await getKeyMaterial(password);
    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
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

function generatePassword(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

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
            const view = urlParams.get('view');
            const urlKey = urlParams.get('key');
            
            if (!view) {
                this.showError('No message ID provided');
                return;
            }
            
            // Get local credentials and backendUrl
            chrome.storage.local.get(['uid', 'pass', 'backendUrl'], async (result) => {
                let localUid = result.uid;
                let localPass = result.pass; // Needed for owner decryption
                const baseUrl = result.backendUrl || 'https://inigma.idone.su';
                const apiUrl = `${baseUrl}/api/view`;

                if (!localUid) {
                    localUid = this.generateAndSaveUid();
                    // After generating new UID/Pass, we need to get the new pass for the current operation.
                    const newCredentials = await new Promise(resolve => {
                        chrome.storage.local.get(['pass'], res => resolve(res));
                    });
                    localPass = newCredentials.pass;
                }
                
                try {
                    const response = await fetch(apiUrl, { // Use apiUrl
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ view, uid: localUid }) // use localUid
                    });
                    
                    const data = await response.json();
                    
                    if (data.redirect_root === 'true') {
                        this.showError(data.message);
                        return;
                    }
                    
                    this.messageData = data;
                    this.isOwner = data.uid === localUid; // Compare with localUid
                    
                    if (this.isOwner) {
                        if (localPass) {
                            await this.decryptMessage(localPass, baseUrl); // Pass baseUrl
                        } else {
                            this.showError('Credentials error. Your password is not found. Please regenerate credentials in the main popup and try again.');
                            this.loading = false;
                        }
                    } else if (urlKey) {
                        await this.decryptMessage(urlKey, baseUrl); // Pass baseUrl
                    } else {
                        this.needPassword = true;
                        this.loading = false;
                    }
                } catch (error) {
                    console.error('Error loading message:', error);
                    this.showError('Failed to load message. Check backend URL in settings and console.');
                }
            });
        },
        
        generateAndSaveUid() {
            const uid = generatePassword(12);
            const pass = generatePassword(24);
            chrome.storage.local.set({ uid: uid, pass: pass }, () => {
                console.log('New UID and Pass generated and saved to chrome.storage.');
            });
            return uid;
        },
        
        async decryptMessage(password, baseUrl) { // baseUrl needed for updateOwnership
            try {
                const encrypted = base64ToArrayBuffer(this.messageData.encrypted_message);
                const iv = base64ToArrayBuffer(this.messageData.iv);
                const salt = base64ToArrayBuffer(this.messageData.salt);
                
                const decrypted = await decrypt(encrypted, salt, iv, password);
                this.decryptedMessage = new TextDecoder().decode(decrypted);
                
                if (!this.isOwner) {
                    // Pass baseUrl to updateOwnership
                    await this.updateOwnership(this.decryptedMessage, baseUrl); 
                }
                
                this.loading = false;
                this.needPassword = false;
                this.decryptError = false;
            } catch (error) {
                console.error('Decryption failed:', error);
                if (this.needPassword) { // If we were in password input mode
                    this.decryptError = true; // Show incorrect password
                } else { // If auto-decryption failed (e.g. owner with bad pass, or bad URL key)
                    this.needPassword = true; // Fallback to asking for password
                    this.loading = false;
                }
            }
        },
        
        async updateOwnership(message, baseUrl) {
            const urlParams = new URLSearchParams(window.location.search);
            const view = urlParams.get('view');
            
            // Fetch fresh uid and pass for updating ownership
            const result = await new Promise(resolve => {
                chrome.storage.local.get(['uid', 'pass'], res => resolve(res));
            });

            const localUid = result.uid;
            const localPass = result.pass;

            if (!localUid || !localPass) {
                console.error("Cannot update ownership, UID or Pass not found in storage for re-encryption.");
                return;
            }

            const salt = window.crypto.getRandomValues(new Uint8Array(16));
            const iv = window.crypto.getRandomValues(new Uint8Array(16));
            
            const encrypted = await encrypt(message, salt, iv, localPass); 
            const apiUrlUpdate = `${baseUrl}/api/update`;
            
            try {
                const response = await fetch(apiUrlUpdate, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        view,
                        uid: localUid, 
                        encrypted_message: arrayBufferToBase64(encrypted),
                        iv: arrayBufferToBase64(iv),
                        salt: arrayBufferToBase64(salt)
                    })
                });
                if (!response.ok) {
                    throw new Error(`API update failed: ${response.statusText}`);
                }
                this.isOwner = true; 
                console.log("Ownership updated on server and locally.");
            } catch (error) {
                console.error("Failed to update ownership on server:", error);
            }
        },
        
        async decryptWithPassword() {
            if (!this.password || this.decrypting) return;
            
            this.decrypting = true;
            this.decryptError = false;
            
            const result = await new Promise(resolve => {
                chrome.storage.local.get('backendUrl', res => resolve(res));
            });
            const baseUrl = result.backendUrl || 'https://inigma.idone.su';
            await this.decryptMessage(this.password, baseUrl); 
            this.decrypting = false;
        },
        
        showError(message) {
            this.error = true;
            this.errorMessage = message;
            this.loading = false;
        },
        
        async copyMessage() {
            await navigator.clipboard.writeText(this.decryptedMessage);
            this.showToast = true;
            setTimeout(() => this.showToast = false, 3000);
        }
    }
}

document.addEventListener('alpine:init', () => { Alpine.data('viewApp', viewApp); });
