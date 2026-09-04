# VOLQ-AUTH Architecture & Topology Specification

## 1. Zero-Cost Infrastructure Model

VOLQ-Auth is engineered from the ground up to operate indefinitely within the permanent free allowances of major cloud providers, eliminating recurring licensing and infrastructure expenses.

```
       [ Client Applications: C++ / C# / Python / Rust / Go ]
                                  │
                                  ▼
                   [ Cloudflare Free Tier (Edge) ]
              - Free TLS 1.3 / SSL Termination
              - DDoS Mitigation & Bot Fight Mode
              - WAF & Reverse Proxy Routing
                                  │
                                  ▼
             [ VOLQ-Auth Gateway (Go / Gin Engine) ]
    Hosted on: Oracle Cloud Always Free (4 OCPU ARM, 24GB RAM)
               OR Render / Fly.io / Koyeb Free Web Containers
                                  │
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
      [ PostgreSQL Database ]             [ Cache & Replay Guard ]
  - Neon.tech / Supabase Free         - Upstash Redis Free (10k cmd/day)
  - Connection Pool: 15 active conns    OR Local In-Memory Goroutine Store
  - PgBouncer compatibility
                │
                ▼
     [ Cloudflare R2 Storage ]
  - 10 GB Free Storage
  - $0 Bandwidth / Egress Fees
  - Memory-only Zero-Disk Payload Streaming
```

---

## 2. Microservice Offloading & Caching Strategy

1. **Ephemeral Heartbeats & Session Offloading**:
   - Client authentication checks do not hit PostgreSQL directly on each ping or variable fetch.
   - Sessions are cached in Redis (or in-memory cache) with a 1 to 2 hour TTL.
   - Primary database writes are restricted to:
     - New account registrations
     - First-time license key activation and rolling expiry computation
     - Security audit events and tamper records.

2. **Database Connection Pooling**:
   - Supabase and Neon free tiers enforce strict connection limits (typically 20-50).
   - The Go backend pool is explicitly capped at `MaxOpenConns = 15` and `MaxIdleConns = 5`, fully compatible with PgBouncer session pooling.

3. **Dual-Mode Cache Fallback**:
   - If `REDIS_URL` is omitted or unavailable, the backend automatically activates a thread-safe in-memory cache engine with concurrent background TTL janitor goroutines, requiring zero external services for local development or single-node VM deployments.
