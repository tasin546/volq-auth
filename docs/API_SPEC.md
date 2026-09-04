# VOLQ-AUTH REST API Specification

## 1. Client SDK Endpoints (Rate Limited: 60 req/min/IP)

### 1.1 Ephemeral Handshake
- **Method**: `POST`
- **Endpoint**: `/api/v1/client/init`
- **Request Body**:
```json
{
  "app_id": "9f1c7d2e-4b6a-4d2c-9a1b-3f4e5a6b7c8d",
  "client_pub_key": "x25519_base64_encoded_key",
  "nonce": "a1f9c8b4d2e7e3a1f9c8b4d2",
  "timestamp": 1788509372000
}
```
- **Response Body** (HTTP 200):
```json
{
  "session_id": "sess_88f92a1c0d3e",
  "server_pub_key": "x25519_base64_server_key",
  "app_version": "1.0.0",
  "signature": "ed25519_signature_base64"
}
```

---

### 1.2 License Authentication & HWID Binding
- **Method**: `POST`
- **Endpoint**: `/api/v1/client/license`
- **Request Body**:
```json
{
  "session_id": "sess_88f92a1c0d3e",
  "payload": "AES-256-GCM(IV + Ciphertext + Tag)"
}
```
*Decrypted Payload Content*:
```json
{
  "license_key": "VOLQ-9941-FA23-99BC",
  "hwid": "9b64c71829e3a6154bcf...",
  "binary_hash": "e3b0c44298fc1c149afb...",
  "nonce": "c9a1d3f5b7e9a2c4",
  "timestamp": 1788509375000
}
```
- **Response Body** (HTTP 200):
```json
{
  "payload": "AES-256-GCM(AuthResult)",
  "signature": "ed25519_signature"
}
```

---

### 1.3 End-User Authentication (Mode B)
- **Method**: `POST`
- **Endpoint**: `/api/v1/client/login`
- **Decrypted Payload**:
```json
{
  "username": "user123",
  "password": "userpass",
  "hwid": "9b64c71829e3a6154bcf...",
  "nonce": "c9a1d3f5b7e9a2c4",
  "timestamp": 1788509375000
}
```

---

### 1.4 Encrypted Remote Variable
- **Method**: `POST`
- **Endpoint**: `/api/v1/client/var`
- **Request Envelope**:
```json
{
  "session_token": "tok_991823abce...",
  "payload": "AES-256-GCM({'var_key': 'API_KEY'})"
}
```

---

## 2. Developer Dashboard API (Protected by JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/dashboard/auth/register` | Register developer platform account |
| `POST` | `/api/v1/dashboard/auth/login` | Login developer / reseller and obtain JWT |
| `GET`  | `/api/v1/dashboard/auth/me` | Fetch active user profile and permissions |
| `GET`  | `/api/v1/dashboard/apps` | List all scoped workspaces |
| `POST` | `/api/v1/dashboard/apps/create` | Create application and generate Ed25519 keys |
| `GET`  | `/api/v1/dashboard/apps/:id` | Get application details |
| `PUT`  | `/api/v1/dashboard/apps/:id` | Update version, integrity hash, or pause state |
| `DELETE` | `/api/v1/dashboard/apps/:id` | Permanently delete application workspace |
| `GET`  | `/api/v1/dashboard/apps/:id/licenses` | List licenses with status filter and search |
| `POST` | `/api/v1/dashboard/apps/:id/licenses/generate` | Batch generate keys with custom mask |
| `PUT`  | `/api/v1/dashboard/apps/:id/licenses/:lic_id/reset-hwid` | One-click reset of hardware lock |
| `PUT`  | `/api/v1/dashboard/apps/:id/licenses/:lic_id/status` | Pause, ban, or unban license |
| `DELETE` | `/api/v1/dashboard/apps/:id/licenses/:lic_id` | Delete license key |
| `GET`  | `/api/v1/dashboard/apps/:id/licenses/export` | Export licenses to CSV file |
| `GET`  | `/api/v1/dashboard/apps/:id/users` | List Mode B registered end-users |
| `PUT`  | `/api/v1/dashboard/apps/:id/users/:user_id/ban` | Ban or unban end-user account |
| `GET`  | `/api/v1/dashboard/apps/:id/variables` | List remote variables |
| `POST` | `/api/v1/dashboard/apps/:id/variables` | Create or update remote variable |
| `GET`  | `/api/v1/dashboard/apps/:id/files` | List hosted cloud payloads |
| `POST` | `/api/v1/dashboard/apps/:id/files` | Register R2 payload file |
| `GET`  | `/api/v1/dashboard/apps/:id/logs` | Real-time security audit log stream |
| `GET`  | `/api/v1/dashboard/apps/:id/resellers` | List reseller accounts |
| `POST` | `/api/v1/dashboard/apps/:id/resellers/create` | Create reseller account |
| `POST` | `/api/v1/dashboard/apps/:id/resellers/:id/credits` | Add or deduct reseller credits |
