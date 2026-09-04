'use client';

import React, { useState } from 'react';
import { Code2, Terminal, Shield, Check, Copy } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { TopNav } from '../../components/TopNav';
import { CodeBlock } from '../../components/CodeBlock';
import { useAuth } from '../../lib/authContext';

export default function DocsPage() {
  const { selectedApp } = useAuth();
  const [selectedLang, setSelectedLang] = useState<'cpp' | 'csharp' | 'python' | 'rust' | 'go' | 'react'>('react');

  const appId = selectedApp ? selectedApp.id : 'YOUR_APPLICATION_UUID';
  const appVersion = selectedApp ? selectedApp.version : '1.0.0';
  const masterPubKey = selectedApp ? selectedApp.master_public_key : 'YOUR_MASTER_PUBLIC_KEY_BASE64';

  const snippets = {
    cpp: `// ============================================================================
// VOLQ-AUTH (OPENKEYAUTH) - C++17 INTEGRATION EXAMPLE
// ============================================================================
#include "volq_auth.hpp"
#include <iostream>

int main() {
    // 1. Initialize VolqAuth Client with App Credentials
    VolqAuth::Client client(
        "${appId}",
        "${appVersion}",
        "${masterPubKey}",
        "https://api.yourdomain.com"
    );

    std::cout << "[+] Performing Ephemeral ECDH Key Exchange..." << std::endl;
    if (!client.Init()) {
        std::cerr << "[-] Handshake failed or server response tampered!" << std::endl;
        return 1;
    }

    // 2. Authenticate License Key with Native Win32 HWID
    std::string licenseKey;
    std::cout << "[?] Enter License Key: ";
    std::cin >> licenseKey;

    auto result = client.AuthenticateLicense(licenseKey);
    if (!result.success) {
        std::cerr << "[-] Authentication Error: " << result.errorMessage << std::endl;
        return 1;
    }

    std::cout << "[+] Welcome! Tier: " << result.subscriptionName << std::endl;

    // 3. Decrypt Remote Variable Directly in Memory
    std::string secretUrl = client.GetRemoteVariable("API_ENDPOINT");
    std::cout << "[+] Decrypted Remote Variable: " << secretUrl << std::endl;

    // Run protected application logic here...
    return 0;
}`,
    csharp: `// ============================================================================
// VOLQ-AUTH (OPENKEYAUTH) - C# / .NET 6+ INTEGRATION EXAMPLE
// ============================================================================
using System;
using System.Threading.Tasks;
using VolqAuth;

namespace MyApp
{
    class Program
    {
        static async Task Main(string[] args)
        {
            var client = new VolqAuthClient(
                appId: "${appId}",
                appVersion: "${appVersion}",
                masterPublicKey: "${masterPubKey}",
                baseUrl: "https://api.yourdomain.com"
            );

            Console.WriteLine("[+] Initializing ECDH Handshake...");
            bool initSuccess = await client.InitAsync();
            if (!initSuccess)
            {
                Console.WriteLine("[-] Handshake or signature validation failed!");
                return;
            }

            Console.Write("[?] Enter License Key: ");
            string licenseKey = Console.ReadLine();

            var result = await client.AuthenticateLicenseAsync(licenseKey);
            if (!result.Success)
            {
                Console.WriteLine($"[-] Login Failed: {result.Message}");
                return;
            }

            Console.WriteLine($"[+] Authenticated! Tier: {result.Subscription.Name}");

            string apiSecret = await client.GetVariableAsync("API_SECRET");
            Console.WriteLine($"[+] Retrieved Secret: {apiSecret}");
        }
    }
}`,
    python: `# ============================================================================
# VOLQ-AUTH (OPENKEYAUTH) - PYTHON 3 CLIENT INTEGRATION
# ============================================================================
from volq_auth import VolqAuthClient

def main():
    client = VolqAuthClient(
        app_id="${appId}",
        app_version="${appVersion}",
        master_public_key="${masterPubKey}",
        base_url="https://api.yourdomain.com"
    )

    print("[+] Initiating Curve25519 Ephemeral Key Exchange...")
    if not client.init():
        print("[-] Handshake failed or server Ed25519 signature invalid!")
        return

    license_key = input("[?] Enter your license key: ").strip()
    auth = client.authenticate_license(license_key)

    if not auth.get("status") == "success":
        print(f"[-] Authentication Failed: {auth.get('message')}")
        return

    print(f"[+] Successfully logged in! Tier: {auth['subscription']['name']}")

    # Fetch encrypted remote variable
    stripe_key = client.get_variable("STRIPE_KEY")
    print(f"[+] Loaded secure variable in RAM: {stripe_key}")

if __name__ == "__main__":
    main()`,
    rust: `// ============================================================================
// VOLQ-AUTH (OPENKEYAUTH) - RUST ZERO-DEPENDENCY INTEGRATION
// ============================================================================
use volq_auth::Client;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = Client::new(
        "${appId}",
        "${appVersion}",
        "${masterPubKey}",
        "https://api.yourdomain.com",
    );

    println!("[+] Running ECDH Handshake...");
    client.init()?;

    let license_key = "VOLQ-XXXX-XXXX-XXXX";
    let auth = client.authenticate_license(license_key)?;

    println!("[+] Authenticated: {} (Tier: {})", auth.status, auth.subscription.name);
    Ok(())
}`,
    go: `// ============================================================================
// VOLQ-AUTH (OPENKEYAUTH) - GO CLIENT INTEGRATION
// ============================================================================
package main

import (
	"fmt"
	"log"
	"github.com/tasin546/volq-auth/sdks/go"
)

func main() {
	client := volqauth.NewClient(
		"${appId}",
		"${appVersion}",
		"${masterPubKey}",
		"https://api.yourdomain.com",
	)

	fmt.Println("[+] Handshaking with VOLQ-Auth Gateway...")
	if err := client.Init(); err != nil {
		log.Fatalf("[-] Handshake failed: %v", err)
	}

	result, err := client.AuthenticateLicense("VOLQ-XXXX-XXXX-XXXX")
	if err != nil {
		log.Fatalf("[-] Auth error: %v", err)
	}

	fmt.Printf("[+] Success! Welcome: %s\n", result.Subscription.Name)
}`,
    react: `// ============================================================================
// VOLQ-AUTH (OPENKEYAUTH) - REACT & NEXT.JS SDK INTEGRATION
// ============================================================================
// 1. Install SDK: npm install @volq-auth/react
// 2. Wrap your application with <VolqAuthProvider>
// 3. Use useVolqAuth() anywhere in your component tree

import React, { useState } from 'react';
import { VolqAuthProvider, useVolqAuth } from '@volq-auth/react';

// Example: Protected License Gate Component
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
  const [stripeSecret, setStripeSecret] = useState<string | null>(null);

  const handleUnlock = async () => {
    // Authenticates license and binds deterministic Browser HWID
    const res = await loginWithLicense(licenseKey);
    if (res.status === 'success') {
      // Decrypt protected remote application variable directly in memory
      const secret = await getVariable('STRIPE_SECRET_KEY');
      setStripeSecret(secret);
    }
  };

  if (!isInitialized) {
    return <div className="text-text-muted">Performing Ephemeral Handshake...</div>;
  }

  if (isAuthenticated) {
    return (
      <div className="p-6 bg-obsidian-card border border-emerald-500/30 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-status-success font-bold">● Active License</span>
          <span className="text-xs px-2.5 py-1 bg-status-success/15 text-status-success rounded-md font-mono">
            Tier: {subscription?.name} (Lvl {subscription?.tier_level})
          </span>
        </div>
        <p className="text-xs text-text-muted font-mono">Bound HWID: {hwid}</p>
        {stripeSecret && (
          <p className="text-xs text-brand font-mono">Decrypted Variable: {stripeSecret}</p>
        )}
        <button
          onClick={logout}
          className="px-3 py-1.5 bg-obsidian-hover hover:bg-obsidian-border text-xs rounded-lg transition text-text-secondary"
        >
          Lock Session
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-obsidian-card border border-obsidian-border rounded-xl space-y-4 max-w-md">
      <h3 className="font-semibold text-text-primary">License Activation Required</h3>
      <p className="text-xs text-text-muted">Browser HWID: {hwid?.slice(0, 16)}...</p>

      {error && <p className="text-xs text-status-error">{error}</p>}

      <input
        type="text"
        placeholder="VOLQ-XXXX-XXXX-XXXX"
        value={licenseKey}
        onChange={(e) => setLicenseKey(e.target.value)}
        className="w-full px-3.5 py-2 bg-obsidian-void border border-obsidian-border rounded-lg text-xs font-mono text-text-primary focus:border-brand outline-none"
      />

      <button
        onClick={handleUnlock}
        disabled={isLoading || !licenseKey.trim()}
        className="w-full py-2 bg-brand hover:bg-brand/90 font-medium text-xs text-white rounded-lg transition disabled:opacity-50"
      >
        {isLoading ? 'Verifying with Gateway...' : 'Unlock Application'}
      </button>
    </div>
  );
}

// Wrap in Root Layout or Entry App
export default function App() {
  return (
    <VolqAuthProvider
      appId="${appId}"
      appVersion="${appVersion}"
      masterPublicKey="${masterPubKey}"
      baseUrl="https://api.yourdomain.com"
      autoInit={true}
    >
      <LicenseGate />
    </VolqAuthProvider>
  );
}`,
  };

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Client SDK Integration & Code Generator</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Production integration snippets with credentials pre-injected for{' '}
            <span className="text-text-secondary font-medium">{selectedApp?.name || 'Workspace'}</span>
          </p>
        </div>

        {/* Language Tabs */}
        <div className="flex items-center gap-2 bg-obsidian-card border border-obsidian-border p-1.5 rounded-xl w-fit">
          {[
            { id: 'react', name: 'React / Next.js' },
            { id: 'cpp', name: 'C++17 (Native)' },
            { id: 'csharp', name: 'C# / .NET' },
            { id: 'python', name: 'Python' },
            { id: 'rust', name: 'Rust' },
            { id: 'go', name: 'Go' },
          ].map((lang) => (
            <button
              key={lang.id}
              onClick={() => setSelectedLang(lang.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedLang === lang.id
                  ? 'bg-brand text-white font-semibold shadow-md shadow-brand/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-obsidian-hover'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>

        {/* Code Snippet Display */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
              <Terminal className="w-4 h-4 text-brand" />
              <span>
                Language: <strong className="text-text-primary uppercase">{selectedLang}</strong>
              </span>
            </div>
            <span className="text-[10px] font-mono text-status-success bg-status-success/10 px-2 py-0.5 rounded border border-status-success/20">
              Credentials Automatically Injected
            </span>
          </div>

          <CodeBlock
            code={snippets[selectedLang]}
            language={selectedLang}
            title={`${selectedLang.toUpperCase()} SDK Integration Example`}
          />
        </div>
      </main>
    </div>
  );
}
