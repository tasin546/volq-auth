using System;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace VolqAuth
{
    public class SubscriptionInfo
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("tier_level")]
        public int TierLevel { get; set; }

        [JsonPropertyName("expires_at")]
        public long ExpiresAt { get; set; }
    }

    public class AuthResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public SubscriptionInfo Subscription { get; set; } = new();
        public string SessionToken { get; set; } = string.Empty;
    }

    public class VolqAuthClient
    {
        private readonly string _appId;
        private readonly string _version;
        private readonly string _masterPublicKey;
        private readonly string _baseUrl;
        private readonly HttpClient _http;
        private string _sessionId = string.Empty;
        private byte[] _sessionKey = Array.Empty<byte>();
        private readonly string _hwid;

        public VolqAuthClient(string appId, string appVersion, string masterPublicKey, string baseUrl = "http://localhost:8080")
        {
            _appId = appId;
            _version = appVersion;
            _masterPublicKey = masterPublicKey;
            _baseUrl = baseUrl.TrimEnd('/');
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            _hwid = HardwareId.GetHWID();
        }

        public string GetHWID() => _hwid;

        // Perform Ephemeral Handshake (/api/v1/client/init)
        public async Task<bool> InitAsync()
        {
            string nonce = GenerateNonce();
            long timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            // Ephemeral client key generation
            byte[] clientPriv = new byte[32];
            byte[] clientPub = new byte[32];
            RandomNumberGenerator.Fill(clientPriv);
            RandomNumberGenerator.Fill(clientPub); // Simulated X25519 public key

            var initPayload = new
            {
                app_id = _appId,
                client_pub_key = Convert.ToBase64String(clientPub),
                nonce = nonce,
                timestamp = timestamp
            };

            var content = new StringContent(JsonSerializer.Serialize(initPayload), Encoding.UTF8, "application/json");
            var resp = await _http.PostAsync($"{_baseUrl}/api/v1/client/init", content);

            if (!resp.IsSuccessStatusCode)
                return false;

            var json = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            _sessionId = root.GetProperty("session_id").GetString() ?? string.Empty;
            _sessionKey = new byte[32];
            RandomNumberGenerator.Fill(_sessionKey); // In production, X25519 HKDF shared key
            return true;
        }

        // Authenticate with License Key (/api/v1/client/license)
        public async Task<AuthResult> AuthenticateLicenseAsync(string licenseKey)
        {
            if (string.IsNullOrEmpty(_sessionId))
            {
                return new AuthResult { Success = false, Message = "Client must be initialized first." };
            }

            var payloadObj = new
            {
                license_key = licenseKey,
                hwid = _hwid,
                nonce = GenerateNonce(),
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            string payloadJson = JsonSerializer.Serialize(payloadObj);
            string encryptedPayload = EncryptAESGCM(payloadJson, _sessionKey, $"{_appId}:{_sessionId}");

            var envelope = new
            {
                session_id = _sessionId,
                payload = encryptedPayload
            };

            var content = new StringContent(JsonSerializer.Serialize(envelope), Encoding.UTF8, "application/json");
            var resp = await _http.PostAsync($"{_baseUrl}/api/v1/client/license", content);

            if (!resp.IsSuccessStatusCode)
            {
                string errText = await resp.Content.ReadAsStringAsync();
                return new AuthResult { Success = false, Message = $"Server returned error: {resp.StatusCode}" };
            }

            var respJson = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(respJson);
            string respCiphertext = doc.RootElement.GetProperty("payload").GetString() ?? string.Empty;

            string decrypted = DecryptAESGCM(respCiphertext, _sessionKey, $"{_appId}:{_sessionId}");
            using var decDoc = JsonDocument.Parse(decrypted);

            return new AuthResult
            {
                Success = true,
                Message = decDoc.RootElement.GetProperty("message").GetString() ?? "Success",
                SessionToken = decDoc.RootElement.GetProperty("session_token").GetString() ?? "",
                Subscription = new SubscriptionInfo
                {
                    Name = decDoc.RootElement.GetProperty("subscription").GetProperty("name").GetString() ?? "Standard",
                    TierLevel = decDoc.RootElement.GetProperty("subscription").GetProperty("tier_level").GetInt32(),
                }
            };
        }

        // Retrieve Encrypted Remote Variable (/api/v1/client/var)
        public async Task<string> GetVariableAsync(string varKey)
        {
            var reqObj = new { var_key = varKey };
            string reqJson = JsonSerializer.Serialize(reqObj);
            string encReq = EncryptAESGCM(reqJson, _sessionKey, $"{_appId}:{_sessionId}");

            var envelope = new
            {
                session_token = _sessionId,
                payload = encReq
            };

            var content = new StringContent(JsonSerializer.Serialize(envelope), Encoding.UTF8, "application/json");
            var resp = await _http.PostAsync($"{_baseUrl}/api/v1/client/var", content);

            if (!resp.IsSuccessStatusCode) return string.Empty;

            var respJson = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(respJson);
            string respCipher = doc.RootElement.GetProperty("payload").GetString() ?? "";

            string decrypted = DecryptAESGCM(respCipher, _sessionKey, $"{_appId}:{_sessionId}");
            using var decDoc = JsonDocument.Parse(decrypted);
            return decDoc.RootElement.GetProperty("var_value").GetString() ?? "";
        }

        private static string GenerateNonce()
        {
            byte[] bytes = new byte[16];
            RandomNumberGenerator.Fill(bytes);
            return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        }

        private static string EncryptAESGCM(string plaintext, byte[] key, string aad)
        {
            byte[] nonce = new byte[12];
            RandomNumberGenerator.Fill(nonce);
            byte[] plainBytes = Encoding.UTF8.GetBytes(plaintext);
            byte[] tag = new byte[16];
            byte[] cipher = new byte[plainBytes.Length];

            using var aes = new AesGcm(key, 16);
            aes.Encrypt(nonce, plainBytes, cipher, tag, Encoding.UTF8.GetBytes(aad));

            byte[] combined = new byte[nonce.Length + cipher.Length + tag.Length];
            Buffer.BlockCopy(nonce, 0, combined, 0, nonce.Length);
            Buffer.BlockCopy(cipher, 0, combined, nonce.Length, cipher.Length);
            Buffer.BlockCopy(tag, 0, combined, nonce.Length + cipher.Length, tag.Length);

            return Convert.ToBase64String(combined);
        }

        private static string DecryptAESGCM(string base64Combined, byte[] key, string aad)
        {
            byte[] raw = Convert.FromBase64String(base64Combined);
            byte[] nonce = new byte[12];
            byte[] tag = new byte[16];
            byte[] cipher = new byte[raw.Length - 12 - 16];

            Buffer.BlockCopy(raw, 0, nonce, 0, 12);
            Buffer.BlockCopy(raw, 12, cipher, 0, cipher.Length);
            Buffer.BlockCopy(raw, 12 + cipher.Length, tag, 0, 16);

            byte[] decrypted = new byte[cipher.Length];
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(nonce, cipher, tag, decrypted, Encoding.UTF8.GetBytes(aad));

            return Encoding.UTF8.GetString(decrypted);
        }
    }
}
