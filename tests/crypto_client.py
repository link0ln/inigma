"""
Python reimplementation of Inigma's browser-side crypto operations.

Replicates: AES-256-GCM encryption with PBKDF2-SHA256 key derivation (800k iterations).
"""

import base64
import hashlib
import os
import secrets
import string

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


class InigmaCryptoClient:
    CHARSET = string.ascii_letters + string.digits  # A-Za-z0-9 (62 chars)
    PBKDF2_ITERATIONS = 800_000

    def generate_symmetric_key(self, length: int = 32) -> str:
        return "".join(secrets.choice(self.CHARSET) for _ in range(length))

    def generate_uid(self, symmetric_key: str) -> str:
        return hashlib.sha256(symmetric_key.encode()).hexdigest()[:12]

    def _derive_key(self, password: str, salt: bytes) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=self.PBKDF2_ITERATIONS,
        )
        return kdf.derive(password.encode())

    def encrypt(self, plaintext: str, password: str) -> tuple[str, str, str]:
        """Encrypt plaintext with password. Returns (encrypted_b64, iv_b64, salt_b64)."""
        salt = os.urandom(16)
        iv = os.urandom(12)
        key = self._derive_key(password, salt)
        aesgcm = AESGCM(key)
        ct = aesgcm.encrypt(iv, plaintext.encode(), None)
        return (
            base64.b64encode(ct).decode(),
            base64.b64encode(iv).decode(),
            base64.b64encode(salt).decode(),
        )

    def decrypt(self, encrypted_b64: str, iv_b64: str, salt_b64: str, password: str) -> str:
        """Decrypt base64-encoded ciphertext with password. Returns plaintext string."""
        ct = base64.b64decode(encrypted_b64)
        iv = base64.b64decode(iv_b64)
        salt = base64.b64decode(salt_b64)
        key = self._derive_key(password, salt)
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(iv, ct, None).decode()
