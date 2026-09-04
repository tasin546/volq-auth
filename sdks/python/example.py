#!/usr/bin/env python3
"""
VOLQ-AUTH (OPENKEYAUTH) - PYTHON CLIENT DEMO
"""
from volq_auth import VolqAuthClient

def main():
    print("=" * 80)
    print("          VOLQ-AUTH (OPENKEYAUTH) - PYTHON CLIENT DEMO")
    print("=" * 80)

    client = VolqAuthClient(
        app_id="9f1c7d2e-4b6a-4d2c-9a1b-3f4e5a6b7c8d",
        app_version="1.0.0",
        master_public_key="G6h8Yt...MasterPublicKeyBase64...",
        base_url="http://localhost:8080"
    )

    print(f"[+] Machine Hardware ID (HWID): {client.hwid}")
    print("[+] Initiating Ephemeral ECDH Handshake (/init)...")

    if not client.init():
        print("[-] Handshake failed or server unreachable!")
        return

    print("[+] Ephemeral Curve25519 Handshake Complete. Session Allocated.")

    license_key = input("[?] Enter License Key (press Enter for default): ").strip()
    if not license_key:
        license_key = "VOLQ-TEST-KEY-1234"

    print(f"[+] Authenticating License: {license_key}...")
    auth = client.authenticate_license(license_key)

    if auth.get("status") != "success":
        print(f"[-] Authentication Failed: {auth.get('message')}")
        return

    print("[+] Success! Session Verified.")
    sub = auth.get("subscription", {})
    print(f"    Tier Name : {sub.get('name')}")
    print(f"    Tier Level: {sub.get('tier_level')}")
    print(f"    Expires At: {sub.get('expires_at') or 'Lifetime'}")

    # Fetch Remote Encrypted Variable
    print("[+] Fetching Remote Variable 'API_KEY' in RAM...")
    var_val = client.get_variable("API_KEY")
    print(f"[+] Variable Value: {var_val or 'None'}")

if __name__ == "__main__":
    main()
