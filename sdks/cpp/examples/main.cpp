#include "../include/volq_auth.hpp"
#include <iostream>

int main() {
    std::cout << "================================================================================" << std::endl;
    std::cout << "          VOLQ-AUTH (OPENKEYAUTH) - C++17 CLIENT INTEGRATION DEMO" << std::endl;
    std::cout << "================================================================================" << std::endl;

    // 1. Initialize client
    VolqAuth::Client client(
        "9f1c7d2e-4b6a-4d2c-9a1b-3f4e5a6b7c8d", // App ID
        "1.0.0",                                 // App Version
        "G6h8Yt...MasterPublicKeyBase64...",    // Master Public Key
        "http://localhost:8080"                  // API Gateway URL
    );

    std::cout << "[+] Hardware Identifier (HWID): " << client.GetHWID() << std::endl;
    std::cout << "[+] Performing Cryptographic Handshake (/init)..." << std::endl;

    if (!client.Init()) {
        std::cerr << "[-] Error: Failed to initialize secure session or anti-tamper detected!" << std::endl;
        return 1;
    }

    std::cout << "[+] Ephemeral ECDH Handshake Successful!" << std::endl;

    // 2. Authenticate
    std::string licenseKey = "VOLQ-TEST-KEY-1234";
    std::cout << "[+] Authenticating License Key: " << licenseKey << "..." << std::endl;

    auto authResult = client.AuthenticateLicense(licenseKey);
    if (!authResult.success) {
        std::cerr << "[-] License Error: " << authResult.errorMessage << std::endl;
        return 1;
    }

    std::cout << "[+] Authentication Successful!" << std::endl;
    std::cout << "    Subscription Tier : " << authResult.subscription.name << std::endl;
    std::cout << "    Tier Level        : " << authResult.subscription.tierLevel << std::endl;
    std::cout << "    Session Token     : " << authResult.sessionToken << std::endl;

    // 3. Retrieve Remote Encrypted Variable
    std::cout << "[+] Fetching Protected Variable 'API_SECRET' in RAM..." << std::endl;
    std::string secret = client.GetRemoteVariable("API_SECRET");
    std::cout << "[+] Remote Value: " << secret << std::endl;

    std::cout << "\n[+] Secure application execution permitted. Press Enter to exit..." << std::endl;
    std::cin.get();
    return 0;
}
