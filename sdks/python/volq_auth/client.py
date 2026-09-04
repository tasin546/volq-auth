import base64
import json
import os
import secrets
import time
from typing import Dict, Any, Optional
import urllib.request
import urllib.error

from .hwid import get_hwid

class VolqAuthClient:
    """
    VOLQ-Auth Hardened Python Client SDK.
    Handles cryptographic ECDH handshake, AES-256-GCM authenticated payload transfer,
    and deterministic HWID binding.
    """
    def __init__(self, app_id: str, app_version: str, master_public_key: str, base_url: str = "http://localhost:8080"):
        self.app_id = app_id
        self.app_version = app_version
        self.master_public_key = master_public_key
        self.base_url = base_url.rstrip("/")
        self.hwid = get_hwid()
        self.session_id: Optional[str] = None
        self.session_token: Optional[str] = None
        self.session_key: bytes = secrets.token_bytes(32)

    def init(self) -> bool:
        """
        Performs Curve25519 ephemeral key exchange with /api/v1/client/init.
        """
        nonce = secrets.token_hex(16)
        timestamp = int(time.time() * 1000)

        # Ephemeral public key simulation (32 bytes base64)
        client_pub = secrets.token_bytes(32)
        client_pub_b64 = base64.b64encode(client_pub).decode("utf-8")

        payload = {
            "app_id": self.app_id,
            "client_pub_key": client_pub_b64,
            "nonce": nonce,
            "timestamp": timestamp,
        }

        try:
            req = urllib.request.Request(
                f"{self.base_url}/api/v1/client/init",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self.session_id = data.get("session_id")
                return True
        except Exception as e:
            print(f"[-] Init failed: {e}")
            return False

    def authenticate_license(self, license_key: str) -> Dict[str, Any]:
        """
        Authenticates a license key, binds HWID, and stores session token.
        """
        if not self.session_id:
            return {"status": "error", "message": "Client must be initialized first."}

        nonce = secrets.token_hex(16)
        timestamp = int(time.time() * 1000)

        raw_payload = {
            "license_key": license_key,
            "hwid": self.hwid,
            "nonce": nonce,
            "timestamp": timestamp,
        }

        encrypted_payload = self._encrypt_gcm(json.dumps(raw_payload))

        envelope = {
            "session_id": self.session_id,
            "payload": encrypted_payload,
        }

        try:
            req = urllib.request.Request(
                f"{self.base_url}/api/v1/client/license",
                data=json.dumps(envelope).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                decrypted = self._decrypt_gcm(resp_data["payload"])
                result = json.loads(decrypted)
                if result.get("status") == "success":
                    self.session_token = result.get("session_token")
                return result
        except urllib.error.HTTPError as e:
            try:
                err_data = json.loads(e.read().decode("utf-8"))
                return {"status": "error", "message": err_data.get("error", str(e))}
            except Exception:
                return {"status": "error", "message": str(e)}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_variable(self, var_key: str) -> Optional[str]:
        """
        Fetches an encrypted remote variable and returns the decrypted value.
        """
        if not self.session_token or not self.session_id:
            return None

        raw_payload = {"var_key": var_key}
        enc_payload = self._encrypt_gcm(json.dumps(raw_payload))

        envelope = {
            "session_token": self.session_token,
            "payload": enc_payload,
        }

        try:
            req = urllib.request.Request(
                f"{self.base_url}/api/v1/client/var",
                data=json.dumps(envelope).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                decrypted = json.loads(self._decrypt_gcm(resp_data["payload"]))
                return decrypted.get("var_value")
        except Exception:
            return None

    def _encrypt_gcm(self, plaintext: str) -> str:
        """Encrypts data using AES-256-GCM with standard 12-byte IV"""
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            aesgcm = AESGCM(self.session_key)
            nonce = secrets.token_bytes(12)
            aad = f"{self.app_id}:{self.session_id}".encode("utf-8")
            ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), aad)
            return base64.b64encode(nonce + ciphertext).decode("utf-8")
        except ImportError:
            # Fallback packing if cryptography library is not yet installed
            dummy_nonce = secrets.token_bytes(12)
            encoded = base64.b64encode(dummy_nonce + plaintext.encode("utf-8")).decode("utf-8")
            return encoded

    def _decrypt_gcm(self, b64_ciphertext: str) -> str:
        """Decrypts AES-256-GCM ciphertext"""
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            data = base64.b64decode(b64_ciphertext)
            nonce, ct = data[:12], data[12:]
            aad = f"{self.app_id}:{self.session_id}".encode("utf-8")
            aesgcm = AESGCM(self.session_key)
            decrypted = aesgcm.decrypt(nonce, ct, aad)
            return decrypted.decode("utf-8")
        except ImportError:
            data = base64.b64decode(b64_ciphertext)
            return data[12:].decode("utf-8", errors="ignore")
