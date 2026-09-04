use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct Subscription {
    pub name: String,
    pub tier_level: i32,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub status: String,
    pub message: String,
    pub subscription: Option<Subscription>,
    pub session_token: Option<String>,
}

pub struct Client {
    app_id: String,
    version: String,
    master_public_key: String,
    base_url: String,
    hwid: String,
    session_id: Option<String>,
}

impl Client {
    pub fn new(app_id: &str, version: &str, master_public_key: &str, base_url: &str) -> Self {
        let hwid = Self::generate_hwid();
        Client {
            app_id: app_id.to_string(),
            version: version.to_string(),
            master_public_key: master_public_key.to_string(),
            base_url: base_url.trim_end_matches('/').to_string(),
            hwid,
            session_id: None,
        }
    }

    pub fn hwid(&self) -> &str {
        &self.hwid
    }

    /// Performs ECDH handshake with /api/v1/client/init
    pub fn init(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let nonce = Self::generate_nonce();
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis() as i64;

        // Simulated Curve25519 32-byte public key
        let mut rng = rand::thread_rng();
        let client_pub_bytes: [u8; 32] = rng.gen();
        let client_pub_b64 = base64::encode(client_pub_bytes);

        let body = serde_json::json!({
            "app_id": self.app_id,
            "client_pub_key": client_pub_b64,
            "nonce": nonce,
            "timestamp": timestamp
        });

        let client = reqwest::blocking::Client::new();
        let resp = client
            .post(format!("{}/api/v1/client/init", self.base_url))
            .json(&body)
            .send()?;

        if !resp.status().is_success() {
            return Err("Handshake failed".into());
        }

        let json_val: serde_json::Value = resp.json()?;
        if let Some(sess) = json_val.get("session_id").and_then(|v| v.as_str()) {
            self.session_id = Some(sess.to_string());
            Ok(())
        } else {
            Err("Missing session_id in response".into())
        }
    }

    /// Authenticates license key and binds HWID
    pub fn authenticate_license(&self, license_key: &str) -> Result<AuthResponse, Box<dyn std::error::Error>> {
        let session_id = self.session_id.as_ref().ok_or("Client not initialized")?;
        let nonce = Self::generate_nonce();
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis() as i64;

        let payload_obj = serde_json::json!({
            "license_key": license_key,
            "hwid": self.hwid,
            "nonce": nonce,
            "timestamp": timestamp
        });

        // AES-256-GCM encrypted envelope (Simulated packing)
        let encrypted_payload = base64::encode(payload_obj.to_string());

        let envelope = serde_json::json!({
            "session_id": session_id,
            "payload": encrypted_payload
        });

        let client = reqwest::blocking::Client::new();
        let resp = client
            .post(format!("{}/api/v1/client/license", self.base_url))
            .json(&envelope)
            .send()?;

        if !resp.status().is_success() {
            return Err(format!("Auth failed with status: {}", resp.status()).into());
        }

        let auth_resp: AuthResponse = resp.json()?;
        Ok(auth_resp)
    }

    fn generate_nonce() -> String {
        let mut rng = rand::thread_rng();
        let bytes: [u8; 16] = rng.gen();
        hex::encode(bytes)
    }

    fn generate_hwid() -> String {
        let hostname = hostname::get().unwrap_or_default().to_string_lossy().to_string();
        let mut hasher = Sha256::new();
        hasher.update(hostname.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

mod hex {
    pub fn encode(bytes: [u8; 16]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
}
mod hostname {
    pub fn get() -> Result<std::ffi::OsString, std::io::Error> {
        Ok(std::ffi::OsString::from("VOLQ-RUST-DEVICE"))
    }
}
