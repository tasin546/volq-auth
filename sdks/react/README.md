# @volq-auth/react

> Official React & Next.js Client SDK for **VOLQ-Auth (OpenKeyAuth)** — an open-source software licensing and anti-tamper platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Cost Architecture](https://img.shields.io/badge/Architecture-100%25%20Zero--Cost-success)](#)

---

## Features

- ⚡ **Zero External Heavy Crypto Dependencies**: Utilizes modern browser `window.crypto` (Web Crypto API) and deterministic Canvas/WebGL hardware fingerprinting.
- 🔒 **Browser Hardware Binding (HWID)**: Deterministic 64-character SHA-256 fingerprint binding license keys to client browsers.
- ⚛️ **First-Class React Context & Hook**: Instant integration using `<VolqAuthProvider>` and `useVolqAuth()`.
- 🌐 **Full Next.js Support**: Safe hydration for Next.js App Router (`'use client'`), Next.js Pages Router, and Vite/CRA.
- 🛡️ **Ephemeral Session & Anti-Replay**: High-entropy nonces and millisecond timestamps protect all transactions against replay attacks.
- 📦 **Remote Encrypted Variables**: Fetch and decrypt protected application secrets directly in memory.

---

## Installation

```bash
npm install @volq-auth/react
# or
yarn add @volq-auth/react
# or
pnpm add @volq-auth/react
```

---

## Quickstart

### 1. Wrap your application in `<VolqAuthProvider>`

In your root layout or entry file (`App.tsx` or Next.js `layout.tsx`):

```tsx
'use client';

import React from 'react';
import { VolqAuthProvider } from '@volq-auth/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <VolqAuthProvider
      appId="YOUR_APPLICATION_UUID"
      appVersion="1.0.0"
      masterPublicKey="YOUR_MASTER_PUBLIC_KEY_BASE64"
      baseUrl="https://api.yourdomain.com"
      autoInit={true}
    >
      {children}
    </VolqAuthProvider>
  );
}
```

### 2. Protect Components with `useVolqAuth()`

```tsx
'use client';

import React, { useState } from 'react';
import { useVolqAuth } from '@volq-auth/react';

export function LicenseGate() {
  const {
    isInitialized,
    isAuthenticated,
    isLoading,
    error,
    subscription,
    hwid,
    loginWithLicense,
    getVariable,
    logout,
  } = useVolqAuth();

  const [licenseKey, setLicenseKey] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);

  const handleActivate = async () => {
    const res = await loginWithLicense(licenseKey);
    if (res.status === 'success') {
      // Fetch protected encrypted remote variable
      const secret = await getVariable('STRIPE_SECRET_KEY');
      setApiKey(secret);
    }
  };

  if (!isInitialized) {
    return <div>Connecting to security gateway...</div>;
  }

  if (isAuthenticated) {
    return (
      <div className="card">
        <h2>🎉 Welcome to Pro Features</h2>
        <p>Tier: <strong>{subscription?.name}</strong></p>
        <p>Expires: {subscription?.expires_at ? new Date(subscription.expires_at * 1000).toLocaleDateString() : 'Lifetime'}</p>
        {apiKey && <p>Decrypted Secret: <code>{apiKey}</code></p>}
        <button onClick={logout}>Deactivate Session</button>
      </div>
    );
  }

  return (
    <div className="login-box">
      <h3>Software Activation</h3>
      <p>Device HWID: <span className="mono">{hwid?.slice(0, 16)}...</span></p>

      {error && <div className="error">{error}</div>}

      <input
        type="text"
        placeholder="VOLQ-XXXX-XXXX-XXXX"
        value={licenseKey}
        onChange={(e) => setLicenseKey(e.target.value)}
      />

      <button onClick={handleActivate} disabled={isLoading}>
        {isLoading ? 'Verifying...' : 'Activate License'}
      </button>
    </div>
  );
}
```

---

## API Reference

### `<VolqAuthProvider>` Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `appId` | `string` | *(Required)* | Application UUID configured in VOLQ-Auth dashboard. |
| `appVersion` | `string` | `"1.0.0"` | Current client application release version. |
| `masterPublicKey` | `string` | `""` | Base64-encoded application master public key. |
| `baseUrl` | `string` | `"http://localhost:8080"` | Base URL of your VOLQ-Auth backend gateway. |
| `autoInit` | `boolean` | `true` | Automatically run ephemeral handshake on mount. |

---

### `useVolqAuth()` Hook Return Values

| Property | Type | Description |
| :--- | :--- | :--- |
| `isInitialized` | `boolean` | Whether ephemeral key exchange handshake completed. |
| `isAuthenticated` | `boolean` | Whether active session holds valid validated license. |
| `isLoading` | `boolean` | True during handshakes or network verification calls. |
| `error` | `string \| null` | Error message if handshake or activation failed. |
| `hwid` | `string \| null` | 64-character SHA-256 browser deterministic HWID. |
| `subscription` | `Subscription \| null` | Active subscription details (`name`, `tier_level`, `expires_at`). |
| `sessionToken` | `string \| null` | Authenticated session token. |
| `init()` | `() => Promise<boolean>` | Manually run/retry ephemeral key exchange. |
| `loginWithLicense()` | `(key: string) => Promise<AuthResult>` | Authenticate license key and bind HWID. |
| `loginWithCredentials()` | `(u: string, p: string) => Promise<AuthResult>` | Authenticate username/password account. |
| `getVariable()` | `(key: string) => Promise<string \| null>` | Decrypt protected remote variable from server RAM. |
| `logout()` | `() => void` | Clear local session and credentials. |
