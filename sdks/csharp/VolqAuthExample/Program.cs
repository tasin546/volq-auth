using System;
using System.Threading.Tasks;
using VolqAuth;

namespace VolqAuthExample
{
    internal class Program
    {
        static async Task Main(string[] args)
        {
            Console.WriteLine("================================================================================");
            Console.WriteLine("          VOLQ-AUTH (OPENKEYAUTH) - C# / .NET CLIENT DEMONSTRATION");
            Console.WriteLine("================================================================================");

            var client = new VolqAuthClient(
                appId: "9f1c7d2e-4b6a-4d2c-9a1b-3f4e5a6b7c8d",
                appVersion: "1.0.0",
                masterPublicKey: "G6h8Yt...MasterPublicKeyBase64...",
                baseUrl: "http://localhost:8080"
            );

            Console.WriteLine($"[+] Machine HWID Digest: {client.GetHWID()}");
            Console.WriteLine("[+] Initiating ECDH Handshake (/init)...");

            bool initOk = await client.InitAsync();
            if (!initOk)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[-] Handshake failed or server response tampered!");
                Console.ResetColor();
                return;
            }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("[+] Secure Session Established!");
            Console.ResetColor();

            Console.Write("[?] Enter License Key: ");
            string? key = Console.ReadLine();
            if (string.IsNullOrWhiteSpace(key)) key = "VOLQ-TEST-KEY-1234";

            var result = await client.AuthenticateLicenseAsync(key);
            if (!result.Success)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"[-] Authentication Failed: {result.Message}");
                Console.ResetColor();
                return;
            }

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine($"[+] Authenticated! Status: {result.Message}");
            Console.WriteLine($"    Subscription Tier : {result.Subscription.Name}");
            Console.WriteLine($"    Tier Level        : {result.Subscription.TierLevel}");
            Console.WriteLine($"    Session Token     : {result.SessionToken}");
            Console.ResetColor();

            Console.WriteLine("\n[+] Press Enter to exit...");
            Console.ReadLine();
        }
    }
}
