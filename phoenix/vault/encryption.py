import base64
import hashlib
import json
import os
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings

ASYM_V1_PREFIX = "asym:v1:"


def _derive_fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _resolve_key_material(value_name: str, path_name: str):
    value = getattr(settings, value_name, None)
    if value:
        return value.encode("utf-8") if isinstance(value, str) else value

    key_path = getattr(settings, path_name, None)
    if not key_path:
        return None

    key_path_obj = Path(key_path)
    if not key_path_obj.exists():
        return None

    return key_path_obj.read_bytes()


@lru_cache(maxsize=1)
def get_public_key():
    key_material = _resolve_key_material("ASYMMETRIC_PUBLIC_KEY", "ASYMMETRIC_PUBLIC_KEY_PATH")
    if not key_material:
        return None
    return serialization.load_pem_public_key(key_material)


@lru_cache(maxsize=1)
def get_private_key():
    key_material = _resolve_key_material(
        "ASYMMETRIC_PRIVATE_KEY", "ASYMMETRIC_PRIVATE_KEY_PATH"
    )
    if not key_material:
        return None
    return serialization.load_pem_private_key(key_material, password=None)


def get_fernet() -> Fernet:
    key = getattr(settings, "FERNET_KEY", None)
    if key:
        if isinstance(key, str):
            key = key.encode("utf-8")
        return Fernet(key)
    secret = getattr(settings, "SECRET_KEY", "")
    return Fernet(_derive_fernet_key(secret))


def _encrypt_asymmetric(value: str):
    public_key = get_public_key()
    if public_key is None:
        return None

    data_key = os.urandom(32)
    nonce = os.urandom(12)
    ciphertext = AESGCM(data_key).encrypt(nonce, value.encode("utf-8"), None)
    encrypted_data_key = public_key.encrypt(
        data_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

    payload = {
        "alg": "RSA-OAEP-SHA256+AES-256-GCM",
        "ek": base64.urlsafe_b64encode(encrypted_data_key).decode("utf-8"),
        "n": base64.urlsafe_b64encode(nonce).decode("utf-8"),
        "ct": base64.urlsafe_b64encode(ciphertext).decode("utf-8"),
    }
    serialized = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return ASYM_V1_PREFIX + base64.urlsafe_b64encode(serialized).decode("utf-8")


def _decrypt_asymmetric(value: str):
    if not value.startswith(ASYM_V1_PREFIX):
        return None

    private_key = get_private_key()
    if private_key is None:
        return value

    try:
        payload_bytes = base64.urlsafe_b64decode(value[len(ASYM_V1_PREFIX) :].encode("utf-8"))
        payload = json.loads(payload_bytes.decode("utf-8"))
        encrypted_data_key = base64.urlsafe_b64decode(payload["ek"])
        nonce = base64.urlsafe_b64decode(payload["n"])
        ciphertext = base64.urlsafe_b64decode(payload["ct"])
        data_key = private_key.decrypt(
            encrypted_data_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        plaintext = AESGCM(data_key).decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")
    except Exception:
        return value


def encrypt_value(value: str) -> str:
    if value is None:
        return value
    if isinstance(value, str) and value.startswith(ASYM_V1_PREFIX):
        return value

    encrypted = _encrypt_asymmetric(value)
    if encrypted is not None:
        return encrypted

    token = get_fernet().encrypt(value.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_value(value: str) -> str:
    if value is None:
        return value

    asymmetric = _decrypt_asymmetric(value)
    if asymmetric is not None:
        return asymmetric

    try:
        decrypted = get_fernet().decrypt(value.encode("utf-8"))
    except InvalidToken:
        return value
    return decrypted.decode("utf-8")
