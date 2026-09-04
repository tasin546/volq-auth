# VOLQ-AUTH (OpenKeyAuth)

> **Production-Grade, 100% Free-Tier Software Licensing & Anti-Tamper Telemetry Platform**  
> Cryptographically hardened alternative to proprietary platforms (e.g., KeyAuth) designed to run completely free forever on public cloud free tiers.

---

## Key Capabilities & Philosophy

- **100% Zero-Cost Guarantee**: Architected explicitly to run within the permanent free allowances of Oracle Cloud Always Free (4 OCPU ARM, 24 GB RAM), Cloudflare Free (DDoS/WAF/Pages/R2), Neon/Supabase PostgreSQL, and Upstash Redis.
- **Zero Paywalled Features**: Remote variables, unlimited applications, custom key masking, reseller management, encrypted file downloads, and audit logs are 100% unlocked and open source.
- **Cryptographic Rigor**:
  - **Ephemeral Diffie-Hellman Handshake**: Curve25519 (X25519) session allocation with HKDF-SHA256 expansion.
  - **Authenticated Encryption**: All subsequent client-server exchanges use AES-256-GCM with 12-byte initialization vectors and Additional Authenticated Data (AAD).
  - **Digital Signatures**: Every server response is digitally signed with the application's Master Ed25519 Private Key and verified by client SDKs.
  - **Anti-Replay Nonce Store**: 16-byte nonce deduplication with 60s TTL and millisecond clock skew checks ($\le$ 30 seconds).
- **Multi-Platform Native SDKs**: Production-ready client implementations in **C++17**, **C# (.NET 6/8)**, **Python**, **Rust**, and **Go** with built-in hardware identification (HWID), anti-debugging watchdogs, and zero-disk memory decryption.
- **Dark Obsidian UI Design System**: High-contrast, clean developer dashboard matching the `#0B0D13` obsidian void aesthetic with live KPI stat cards, batch key generators, user vault, and real-time security logs.

---

## Architecture Overview

```
 [ Client Applications (C++ / C# / Python / Rust / Go) ]
                           │
                           ▼ (Encrypted TLS 1.3)
             [ Cloudflare Free Edge WAF ]
              - DDoS Mitigation & Strict SSL
              - Rate Limiting (60 req/min/IP)
                           │
                           ▼
          [ VOLQ-Auth API Gateway (Go / Gin) ]
         - Ephemeral ECDH X25519 Handshake
         - AES-256-GCM Encryption Engine
         - Ed25519 Digital Signature Minting
          ┌────────────────┴────────────────┐
          ▼                                 ▼
[ Upstash / In-Memory Cache ]     [ PostgreSQL Database ]
 - Rate-Limit Token Bucket         - Applications, Licenses
 - Session Offload Store           - HWID Hashes, Subscriptions
 - 60s Nonce Replay Guard          - Security Audit Events
          │
          ▼
 [ Cloudflare R2 Storage ]
 - Protected DLLs & Zero-Disk RAM Streaming Payloads
```

---

## Quickstart (1-Click Local Launch)

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose

### Run the Full Stack
```bash
git clone https://github.com/tasin546/volq-auth.git
cd volq-auth/deploy
docker compose up -d
```

- **Developer Dashboard**: `http://localhost:3000`
- **Backend API Gateway**: `http://localhost:8080`
- **Default Credentials**:
  - Username: `admin`
  - Password: `Admin1234!`

---

## Repository Structure

```
.
├── backend/                  # Go REST API Gateway & Cryptographic Engine
│   ├── cmd/server/main.go    # HTTP server entrypoint with Gin & graceful shutdown
│   ├── internal/             # Config, crypto, database pool, cache, models, handlers
│   └── migrations/           # PostgreSQL schema initialization scripts
├── frontend/                 # Obsidian Dark Theme Dashboard (Next.js 14 / TailwindCSS)
│   ├── src/app/              # Overview, apps, licenses, users, variables, files, logs
│   ├── src/components/       # Obsidian UI components (Sidebar, TopNav, StatCard, Modals)
│   └── src/lib/              # Axios API client, authentication context, types
├── sdks/                     # Multi-Platform Native Client SDKs
│   ├── cpp/                  # C++17 Header-only SDK (Win32 HWID, Anti-Debug, Memory Zeroing)
│   ├── csharp/               # C# / .NET 6+ Class Library & Demo Program
│   ├── python/               # Python SDK with cross-platform HWID
│   ├── rust/                 # Memory-safe Rust client with Cargo demo
│   ├── go/                   # Native Go Client SDK
│   └── react/                # React / Next.js Client SDK with browser HWID
├── render.yaml               # 1-Click Render Deployment Blueprint
├── deploy/                   # 1-Click Deployment & Infrastructure
│   ├── docker-compose.yml    # Full stack Docker compose manifest
│   ├── Dockerfile.backend    # Lightweight Alpine Go container
│   ├── Dockerfile.frontend   # Next.js standalone container
│   ├── nginx.conf            # Reverse proxy & rate-limiting configuration
│   └── cloudflare/           # WAF rules and Wrangler R2 configuration
└── docs/                     # Technical Specifications
    ├── ARCHITECTURE.md       # Zero-cost topology & connection pool scaling
    ├── CRYPTOGRAPHY.md       # Formal cryptographic handshake mathematical flow
    ├── API_SPEC.md           # Complete REST endpoint contracts
    └── DEPLOYMENT_GUIDE.md   # Oracle Cloud & Serverless deployment walkthrough
```

---

## Client SDK Quick Integration

### C++17
```cpp
#include "volq_auth.hpp"

VolqAuth::Client client("YOUR_APP_ID", "1.0.0", "MASTER_PUBLIC_KEY", "http://localhost:8080");
if (client.Init()) {
    auto auth = client.AuthenticateLicense("VOLQ-XXXX-XXXX-XXXX");
    if (auth.success) {
        std::cout << "Welcome! Tier: " << auth.subscription.name << std::endl;
        std::string secret = client.GetRemoteVariable("API_SECRET");
    }
}
```

### Python 3
```python
from volq_auth import VolqAuthClient

client = VolqAuthClient("YOUR_APP_ID", "1.0.0", "MASTER_PUBLIC_KEY", "http://localhost:8080")
if client.init():
    auth = client.authenticate_license("VOLQ-XXXX-XXXX-XXXX")
    if auth.get("status") == "success":
        print(f"Authenticated! Subscription: {auth['subscription']['name']}")
```

---

## License

This project is licensed under the **MIT License** and **AGPLv3**. Feel free to self-host, customize, and deploy commercially with zero vendor lock-in.
