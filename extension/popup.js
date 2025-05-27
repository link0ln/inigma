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

// Alpine.js app
function app() {
    return {
        message: '',
        ttl: 30,
        processing: false,
        showModal: false,
        showToast: false,
        showCredentials: false,
        links: {
            full: '',
            noKey: '',
            keyOnly: ''
        },
        credentials: {
            uid: '', // Will be loaded from chrome.storage
            pass: ''  // Will be loaded from chrome.storage
        },
        
        init() {
            chrome.storage.local.get(['uid', 'pass'], (result) => {
                if (result.uid && result.pass) {
                    this.credentials.uid = result.uid;
                    this.credentials.pass = result.pass;
                } else {
                    this.credentials.uid = generatePassword(12);
                    this.credentials.pass = generatePassword(24);
                    chrome.storage.local.set({ 
                        uid: this.credentials.uid, 
                        pass: this.credentials.pass 
                    });
                }
            });
        },
        
        async processMessage() {
            if (!this.message || this.processing) return;
            
            this.processing = true;
            
            chrome.storage.local.get('backendUrl', async (result) => {
                const baseUrl = result.backendUrl || 'https://inigma.idone.su';
                const apiUrl = `${baseUrl}/api/create`;

                const password = generatePassword(20); 
                
                const salt = window.crypto.getRandomValues(new Uint8Array(16));
                const iv = window.crypto.getRandomValues(new Uint8Array(16));
                
                try {
                    const encrypted = await encrypt(this.message, salt, iv, password);
                    
                    const response = await fetch(apiUrl, { // Use apiUrl here
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            encrypted_message: arrayBufferToBase64(encrypted),
                            encrypted: "true",
                            iv: arrayBufferToBase64(iv),
                            salt: arrayBufferToBase64(salt),
                            ttl: parseInt(this.ttl) || 30,
                            multiopen: true // Assuming this is still a desired parameter
                        })
                    });
                    
                    const data = await response.json();
                    
                    let viewUrl = data.url;
                    if (data.url && !data.url.startsWith('http')) {
                        viewUrl = baseUrl + data.url;
                    } else if (!data.url) {
                        // If data.url is missing, construct from baseUrl and view id
                        viewUrl = `${baseUrl}/view?view=${data.view}`;
                    }

                    this.links.full = `${viewUrl}&key=${password}`;
                    this.links.noKey = viewUrl;
                this.links.keyOnly = password;
                
                // Auto-copy full link
                await navigator.clipboard.writeText(this.links.full);
                this.showToast = true;
                setTimeout(() => this.showToast = false, 3000);
                
                this.showModal = true;
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to create secure link. Check console for details and ensure backend URL is correct.');
            } finally {
                this.processing = false;
            }
        });
        },
        
        async copyToClipboard(text) {
            await navigator.clipboard.writeText(text);
            this.showToast = true;
            setTimeout(() => this.showToast = false, 3000);
        },
        
        regenerateCredentials() {
            if (confirm('This will regenerate your credentials. You will lose access to any messages encrypted with current credentials. Continue?')) {
                this.credentials.uid = generatePassword(12);
                this.credentials.pass = generatePassword(24);
                chrome.storage.local.set({ 
                    uid: this.credentials.uid, 
                    pass: this.credentials.pass 
                }, () => {
                    // Optional: add a notification or log
                    console.log('Credentials regenerated and saved.');
                });
            }
        }
    }
}

document.addEventListener('alpine:init', () => { Alpine.data('app', app); });
