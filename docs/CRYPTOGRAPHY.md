# VOLQ-AUTH Cryptographic Handshake & Transport Security

## 1. Threat Model & Protected Vectors

VOLQ-Auth is designed to protect software vendors against modern client reverse-engineering attacks:

1. **Man-In-The-Middle (MITM) & Proxy Inspection**:
   - Attackers install custom root CA certificates and route traffic through tools such as Fiddler, Charles, Wireshark, or HTTPDebugger to view plaintext REST responses.
   - *Protection*: All payload data transferred after handshake is encrypted with AES-256-GCM using an ephemeral session key negotiated via Curve25519 (X25519). Plaintext REST proxies only see high-entropy ciphertext.

2. **Replay Attacks**:
   - Attackers capture valid past authentication requests and re-transmit them verbatim.
   - *Protection*: Every client request includes a 16-byte cryptographic nonce and a millisecond timestamp. The server enforces clock skew (`|Server_Time - Client_Time| <= 30,000ms`) and records nonces in an atomic cache store with a 60-second TTL. Duplicate nonces are rejected as `REPLAY_ATTACK_DETECTED`.

3. **Response Tampering & Spoofing**:
   - Attackers modify server responses (e.g., flipping `{"status": "error"}` to `{"status": "success"}`).
   - *Protection*: All critical response payloads are digitally signed using the application's private Ed25519 master key. The client SDK verifies this signature against the application's compiled-in master public key before evaluating any authorization flags.

---

## 2. Cryptographic Handshake Pipeline

```
       CLIENT                                          SERVER
         │                                               │
         │  1. Generate Ephemeral (Client_Priv, Pub)     │
         │──────────────────────────────────────────────>│
         │     POST /api/v1/client/init                  │
         │     { app_id, client_pub_key, nonce, time }   │
         │                                               │
         │                                               │ 2. Validate Nonce & Clock Skew
         │                                               │ 3. Generate (Server_Priv, Pub)
         │                                               │ 4. Compute Shared Secret:
         │                                               │    SS = X25519(Server_Priv, Client_Pub)
         │                                               │ 5. HKDF-SHA256 Derives:
         │                                               │    - Session_Encryption_Key (AES-256)
         │                                               │    - Session_MAC_Key
         │                                               │ 6. Sign Response with Ed25519 Master Key
         │                                               │
         │<──────────────────────────────────────────────│
         │     Response:                                 │
         │     { session_id, server_pub_key, sig }       │
         │                                               │
         │ 7. Compute Shared Secret:                     │
         │    SS = X25519(Client_Priv, Server_Pub)       │
         │ 8. HKDF Derives Session Keys                  │
         │ 9. Verify Server Ed25519 Signature            │
         │                                               │
         │═══════════════════════════════════════════════│
         │    Subsequent Encrypted Requests (/license)   │
         │═══════════════════════════════════════════════│
         │                                               │
         │ 10. Encrypt payload with AES-256-GCM          │
         │     AAD: "App_ID:Session_ID"                  │
         │──────────────────────────────────────────────>│
         │     POST /api/v1/client/license               │
         │     { session_id, payload }                   │
         │                                               │
         │                                               │ 11. Decrypt with AES-GCM + Verify AAD
         │                                               │ 12. Validate Nonce & HWID Binding
         │                                               │ 13. Encrypt Response & Sign Payload
         │<──────────────────────────────────────────────│
         │     { payload, signature }                    │
```

---

## 3. Cryptographic Primitives

| Component | Standard / Primitive | Key Length | Description |
|-----------|----------------------|------------|-------------|
| Key Exchange | Curve25519 (X25519) | 256 bits | Ephemeral Diffie-Hellman forward secrecy |
| Key Derivation | HKDF-SHA256 (RFC 5869) | 256 bits | Expands shared secret into session encryption keys |
| Authenticated Encryption | AES-256-GCM (NIST SP 800-38D) | 256 bits | 12-byte unique IV per message with AAD binding |
| Digital Signatures | Ed25519 (RFC 8032) | 256 bits | High-speed response authenticity and tamper detection |
| Password Hashing | Argon2id (RFC 9106) | 256 bits | Resistant to GPU/ASIC brute-force dictionary attacks |
