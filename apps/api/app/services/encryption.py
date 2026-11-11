"""Fernet symmetric encryption for provider credentials and secrets."""

from __future__ import annotations

import base64
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

logger = logging.getLogger(__name__)

_fernet_instance: Fernet | None = None


def _get_fernet() -> Fernet:
    """Return (or lazily create) the Fernet cipher instance."""
    global _fernet_instance
    if _fernet_instance is None:
        settings = get_settings()
        key = settings.ENCRYPTION_KEY
        if not key:
            logger.warning(
                "ENCRYPTION_KEY is not set — generating an ephemeral key. "
                "This is acceptable for development only."
            )
            key = Fernet.generate_key().decode()
        # Ensure the key is valid Fernet-format (32 url-safe base64 bytes)
        try:
            _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
        except (ValueError, Exception) as exc:
            raise ValueError(
                "ENCRYPTION_KEY must be a valid 32-byte URL-safe base64 Fernet key. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            ) from exc
    return _fernet_instance


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string and return the ciphertext as a URL-safe base64 string."""
    fernet = _get_fernet()
    token = fernet.encrypt(plaintext.encode("utf-8"))
    return base64.urlsafe_b64encode(token).decode("ascii")


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a ciphertext string previously produced by ``encrypt_value``."""
    fernet = _get_fernet()
    try:
        raw_token = base64.urlsafe_b64decode(ciphertext.encode("ascii"))
        return fernet.decrypt(raw_token).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt value — invalid token or wrong key") from exc
