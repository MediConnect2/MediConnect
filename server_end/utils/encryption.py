from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import base64
from dotenv import load_dotenv

# Load .env from the server_end directory
load_dotenv()

# Should be a 256-bit (32-byte) key — load securely via environment
AES_KEY = base64.urlsafe_b64decode(os.getenv("AES_KEY"))

def encrypt(plaintext: str) -> dict:
    aesgcm = AESGCM(AES_KEY)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "nonce": base64.b64encode(nonce).decode()
    }

def decrypt(ciphertext: str, nonce: str) -> str:
    aesgcm = AESGCM(AES_KEY)
    ct = base64.b64decode(ciphertext)
    iv = base64.b64decode(nonce)
    return aesgcm.decrypt(iv, ct, None).decode()
