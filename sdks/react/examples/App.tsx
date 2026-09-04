import React, { useState } from 'react';
import { VolqAuthProvider, useVolqAuth } from '../src';

function LicenseProtection() {
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
  const [remoteSecret, setRemoteSecret] = useState<string | null>(null);

  const handleUnlock = async () => {
    const res = await loginWithLicense(licenseKey);
    if (res.status === 'success') {
      const secret = await getVariable('LICENSE_ENCRYPTION_KEY');
      setRemoteSecret(secret);
    }
  };

  if (!isInitialized) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h3>Connecting to VOLQ-Auth Security Gateway...</h3>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif', background: '#0F172A', color: '#FFF', borderRadius: 12 }}>
        <h2>🎉 Access Granted</h2>
        <p>Tier: <strong>{subscription?.name}</strong> (Level {subscription?.tier_level})</p>
        <p>Browser HWID: <code>{hwid}</code></p>
        {remoteSecret && (
          <p>Decrypted Variable: <code>{remoteSecret}</code></p>
        )}
        <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Log Out
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 400 }}>
      <h2>Software License Activation</h2>
      <p style={{ fontSize: 12, color: '#666' }}>Browser HWID: {hwid?.slice(0, 16)}...</p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <input
        type="text"
        placeholder="VOLQ-XXXX-XXXX-XXXX"
        value={licenseKey}
        onChange={(e) => setLicenseKey(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }}
      />

      <button
        onClick={handleUnlock}
        disabled={isLoading || !licenseKey.trim()}
        style={{ width: '100%', padding: 10, cursor: 'pointer' }}
      >
        {isLoading ? 'Verifying...' : 'Unlock Application'}
      </button>
    </div>
  );
}

export default function App() {
  return (
    <VolqAuthProvider
      appId="YOUR_APPLICATION_UUID"
      appVersion="1.0.0"
      masterPublicKey="YOUR_MASTER_PUBLIC_KEY"
      baseUrl="http://localhost:8080"
    >
      <LicenseProtection />
    </VolqAuthProvider>
  );
}
