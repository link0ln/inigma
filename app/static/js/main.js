// --- Helper Functions ---

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

async function getKeyMaterial(password) {
    const enc = new TextEncoder();
    return window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
}

async function deriveEncryptionKey(password, salt) {
    const keyMaterial = await getKeyMaterial(password);
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

async function encryptMessage(plaintext, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveEncryptionKey(password, salt);
    const enc = new TextEncoder();
    const encodedPlaintext = enc.encode(plaintext);

    const encryptedMessage = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encodedPlaintext
    );

    return {
        encryptedMessageBase64: arrayBufferToBase64(encryptedMessage),
        saltBase64: arrayBufferToBase64(salt),
        ivBase64: arrayBufferToBase64(iv),
    };
}

async function decryptMessage(encryptedMessageBase64, saltBase64, ivBase64, password) {
    const salt = base64ToArrayBuffer(saltBase64);
    const iv = base64ToArrayBuffer(ivBase64);
    const encryptedMessage = base64ToArrayBuffer(encryptedMessageBase64);
    const key = await deriveEncryptionKey(password, salt);

    try {
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encryptedMessage
        );
        const dec = new TextDecoder();
        return dec.decode(decrypted);
    } catch (e) {
        console.error("Decryption failed:", e);
        throw new Error("Decryption failed. Check password or data integrity.");
    }
}

// --- API Interaction Functions ---

async function createSecretAPI(payload) {
    const response = await fetch("/api/v1/secrets/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}

async function getSecretAPI(uniqueId) {
    const response = await fetch(`/api/v1/secrets/${uniqueId}`);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error("Secret not found or expired.");
        }
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// --- Event Handlers ---

document.addEventListener("DOMContentLoaded", () => {
    const createSecretBtn = document.getElementById("createSecretBtn");
    const decryptSecretBtn = document.getElementById("decryptSecretBtn");

    // --- Create Secret Page Logic ---
    if (createSecretBtn) {
        const secretMessageEl = document.getElementById("secretMessage");
        const secretPasswordEl = document.getElementById("secretPassword");
        const multiOpenEl = document.getElementById("multiOpen");
        const maxViewsEl = document.getElementById("maxViews");
        const maxViewsContainer = document.getElementById("maxViewsContainer");
        const ttlDaysEl = document.getElementById("ttlDays");
        const secretLinkAreaEl = document.getElementById("secretLinkArea");
        const errorAreaEl = document.getElementById("errorArea");

        // Toggle maxViews visibility based on multiOpen checkbox
        if (multiOpenEl && maxViewsContainer) {
            multiOpenEl.addEventListener('change', () => {
                maxViewsContainer.style.display = multiOpenEl.checked ? 'block' : 'none';
            });
            // Initial state
            maxViewsContainer.style.display = multiOpenEl.checked ? 'block' : 'none';
        }


        createSecretBtn.addEventListener("click", async () => {
            secretLinkAreaEl.innerHTML = "";
            errorAreaEl.innerHTML = "";

            const message = secretMessageEl.value;
            const password = secretPasswordEl.value;
            const isMultiOpen = multiOpenEl.checked;
            const views = isMultiOpen ? parseInt(maxViewsEl.value, 10) : 1;
            const ttl = parseInt(ttlDaysEl.value, 10);

            if (!message) {
                errorAreaEl.textContent = "Secret message cannot be empty.";
                return;
            }
            if (!password) {
                errorAreaEl.textContent = "Password cannot be empty.";
                return;
            }
            if (isNaN(views) || views < 1) {
                errorAreaEl.textContent = "Max views must be a positive number.";
                return;
            }
             if (isNaN(ttl) || ttl < 0) {
                errorAreaEl.textContent = "TTL (days) must be a non-negative number.";
                return;
            }


            try {
                createSecretBtn.disabled = true;
                createSecretBtn.textContent = "Creating...";

                const { encryptedMessageBase64, saltBase64, ivBase64 } = await encryptMessage(message, password);
                
                const payload = {
                    encrypted_message_b64: encryptedMessageBase64,
                    salt_b64: saltBase64,
                    iv_b64: ivBase64,
                    ttl_days: ttl,
                    multi_open: isMultiOpen,
                    max_views: views, 
                };

                const response = await createSecretAPI(payload);
                const link = `${window.location.origin}/s/${response.unique_id}`;
                secretLinkAreaEl.innerHTML = `Secret created! Link: <a href="${link}" target="_blank">${link}</a>`;
            
            } catch (error) {
                console.error("Error creating secret:", error);
                errorAreaEl.textContent = `Error: ${error.message}`;
            } finally {
                createSecretBtn.disabled = false;
                createSecretBtn.textContent = "Create Secret Link";
            }
        });
    }

    // --- View Secret Page Logic ---
    if (decryptSecretBtn) {
        // SECRET_ID is expected to be set globally via a script tag in view.html
        const uniqueId = typeof SECRET_ID !== 'undefined' ? SECRET_ID : null;
        
        const decryptPasswordEl = document.getElementById("decryptPassword");
        const statusAreaEl = document.getElementById("statusArea");
        const decryptedMessageAreaEl = document.getElementById("decryptedMessageArea");
        const secretDataContainerEl = document.getElementById("secretDataContainer");

        let fetchedSecretData = null;

        async function fetchSecret() {
            if (!uniqueId) {
                statusAreaEl.textContent = "Error: Secret ID not found.";
                return;
            }
            statusAreaEl.textContent = "Fetching secret...";
            try {
                fetchedSecretData = await getSecretAPI(uniqueId);
                statusAreaEl.textContent = "Secret data fetched. Ready to decrypt.";
                if (secretDataContainerEl) secretDataContainerEl.style.display = 'block';
            } catch (error) {
                console.error("Error fetching secret:", error);
                statusAreaEl.textContent = `Error: ${error.message}`;
                decryptedMessageAreaEl.innerHTML = ""; // Clear any old message
                decryptSecretBtn.disabled = true; // Disable button if fetch fails
            }
        }

        fetchSecret(); // Fetch on page load

        decryptSecretBtn.addEventListener("click", async () => {
            decryptedMessageAreaEl.innerHTML = "";
            statusAreaEl.innerHTML = "";

            const password = decryptPasswordEl.value;

            if (!fetchedSecretData) {
                statusAreaEl.textContent = "Secret data not fetched or fetch failed. Cannot decrypt.";
                return;
            }
            if (!password) {
                statusAreaEl.textContent = "Password cannot be empty.";
                return;
            }

            try {
                decryptSecretBtn.disabled = true;
                decryptSecretBtn.textContent = "Decrypting...";

                const decryptedText = await decryptMessage(
                    fetchedSecretData.encrypted_message_b64,
                    fetchedSecretData.salt_b64,
                    fetchedSecretData.iv_b64,
                    password
                );
                decryptedMessageAreaEl.textContent = decryptedText;
                statusAreaEl.textContent = "Secret decrypted successfully!";
                // Optionally, hide the decrypt button or password field after successful decryption
                // decryptSecretBtn.style.display = 'none';
                // decryptPasswordEl.style.display = 'none';

            } catch (error) {
                console.error("Error decrypting secret:", error);
                statusAreaEl.textContent = `Error: ${error.message}`;
            } finally {
                decryptSecretBtn.disabled = false;
                decryptSecretBtn.textContent = "Decrypt Secret";
            }
        });
    }
});
