# VOLQ-AUTH Zero-Cost Production Deployment Guide

This guide details how to launch and host VOLQ-Auth completely for free ($0.00/month recurring cost) using production-grade public cloud free tiers.

---

## 1. Quickstart: 1-Click Local Docker Compose

If running on your local machine or a self-managed server:

```bash
# Navigate to deploy directory
cd deploy

# Launch PostgreSQL, Redis, Backend Gateway, and Next.js Dashboard
docker compose up -d
```

- **Web Dashboard**: `http://localhost:3000`
- **Backend API Gateway**: `http://localhost:8080`
- **Default Superadmin**:
  - Username: `admin`
  - Password: `Admin1234!`

---

## 2. Option A: Oracle Cloud Always Free (Dedicated VM)

Oracle Cloud provides the most generous permanent free tier in the cloud industry:
- **Compute**: 4 ARM Ampere OCPUs, 24 GB RAM, 200 GB NVMe Storage.
- **Bandwidth**: 10 TB/Month Outbound.

### Setup Instructions:
1. Create a free account at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/).
2. Create an **Ampere A1 Compute Instance** (Ubuntu 22.04 LTS, 4 OCPU, 24 GB RAM).
3. Open ports in the Oracle VCN Security List: `80`, `443`, `8080`, `3000`.
4. SSH into your VM and install Docker:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-v2 git
   ```
5. Clone and start:
   ```bash
   git clone https://github.com/tasin546/volq-auth.git
   cd volq-auth/deploy
   docker compose up -d
   ```

---

## 3. Option B: Serverless Multi-Cloud Free Stack

If you prefer a 100% serverless deployment without maintaining a virtual machine:

| Component | Free Provider | Free Tier Quota | Setup |
|-----------|---------------|-----------------|-------|
| **Database** | [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com) | 0.5 GB - 1 GB PostgreSQL | Copy connection string to `DATABASE_URL` |
| **Cache** | [Upstash](https://upstash.com) | 10,000 commands/day | Copy Redis URL to `REDIS_URL` |
| **Backend** | [Render](https://render.com) or [Fly.io](https://fly.io) | 512 MB Web Service | Deploy `deploy/Dockerfile.backend` |
| **Storage** | [Cloudflare R2](https://cloudflare.com) | 10 GB Storage, $0 Egress | Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` |
| **Frontend** | [Cloudflare Pages](https://pages.cloudflare.com) or [Vercel](https://vercel.com) | Unlimited Bandwidth | Deploy `frontend` directory via Git |

---

## 4. Cloudflare Edge WAF & SSL Configuration

1. Route your root domain through Cloudflare Free DNS (Orange Cloud enabled).
2. Set SSL/TLS mode to **Full (Strict)**.
3. In **Security > WAF > Custom Rules**, import the rules from `deploy/cloudflare/cloudflare-rules.json` to block debugger user-agents and rate limit `/api/v1/client/*` to 60 req/min/IP.
