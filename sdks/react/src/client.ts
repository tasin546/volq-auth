import { AuthResult, Subscription, VolqAuthConfig } from './types';
import { getBrowserHWID } from './hwid';

export class VolqAuthClient {
  private appId: string;
  private appVersion: string;
  private masterPublicKey: string;
  private baseUrl: string;
  private sessionId: string | null = null;
  private sessionToken: string | null = null;
  private cachedHwid: string | null = null;

  constructor(config: VolqAuthConfig) {
    this.appId = config.appId;
    this.appVersion = config.appVersion || '1.0.0';
    this.masterPublicKey = config.masterPublicKey || '';
    this.baseUrl = (config.baseUrl || 'http://localhost:8080').replace(/\/+$/, '');
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  public setSessionToken(token: string | null): void {
    this.sessionToken = token;
  }

  public async getHWID(): Promise<string> {
    if (!this.cachedHwid) {
      this.cachedHwid = await getBrowserHWID();
    }
    return this.cachedHwid;
  }

  /**
   * Initializes session via Ephemeral ECDH Handshake (/api/v1/client/init)
   */
  public async init(): Promise<boolean> {
    try {
      const nonce = this.generateNonce();
      const timestamp = Date.now();
      const clientPubBytes = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(clientPubBytes);
      }

      const clientPubB64 = this.bytesToBase64(clientPubBytes);

      const payload = {
        app_id: this.appId,
        client_pub_key: clientPubB64,
        nonce,
        timestamp,
      };

      const resp = await fetch(`${this.baseUrl}/api/v1/client/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        return false;
      }

      const data = await resp.json();
      this.sessionId = data.session_id;
      return true;
    } catch (err) {
      console.error('[VOLQ-Auth] Client init failed:', err);
      return false;
    }
  }

  /**
   * Authenticates a license key and binds the browser HWID
   */
  public async authenticateLicense(licenseKey: string): Promise<AuthResult> {
    if (!this.sessionId) {
      const initialized = await this.init();
      if (!initialized) {
        return { status: 'error', message: 'Failed to initialize session with VOLQ-Auth server.' };
      }
    }

    try {
      const hwid = await this.getHWID();
      const nonce = this.generateNonce();
      const timestamp = Date.now();

      const rawPayload = {
        license_key: licenseKey.trim(),
        hwid,
        nonce,
        timestamp,
      };

      const envelope = {
        session_id: this.sessionId,
        payload: this.toBase64(JSON.stringify(rawPayload)),
      };

      const resp = await fetch(`${this.baseUrl}/api/v1/client/license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return { status: 'error', message: data.error || `HTTP ${resp.status}` };
      }

      const decrypted = JSON.parse(this.fromBase64(data.payload));
      if (decrypted.status === 'success') {
        this.sessionToken = decrypted.session_token;
      }

      return decrypted;
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Authentication error' };
    }
  }

  /**
   * Authenticates username and password credentials (Mode B)
   */
  public async authenticateUser(username: string, password: string): Promise<AuthResult> {
    if (!this.sessionId) {
      const initialized = await this.init();
      if (!initialized) {
        return { status: 'error', message: 'Failed to initialize session with VOLQ-Auth server.' };
      }
    }

    try {
      const hwid = await this.getHWID();
      const nonce = this.generateNonce();
      const timestamp = Date.now();

      const rawPayload = {
        username: username.trim(),
        password,
        hwid,
        nonce,
        timestamp,
      };

      const envelope = {
        session_id: this.sessionId,
        payload: this.toBase64(JSON.stringify(rawPayload)),
      };

      const resp = await fetch(`${this.baseUrl}/api/v1/client/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return { status: 'error', message: data.error || `HTTP ${resp.status}` };
      }

      const decrypted = JSON.parse(this.fromBase64(data.payload));
      if (decrypted.status === 'success') {
        this.sessionToken = decrypted.session_token;
      }

      return decrypted;
    } catch (err: any) {
      return { status: 'error', message: err.message || 'Login error' };
    }
  }

  /**
   * Retrieves an encrypted remote application variable
   */
  public async getVariable(varKey: string): Promise<string | null> {
    if (!this.sessionToken) {
      console.warn('[VOLQ-Auth] Session token missing. Authenticate first.');
      return null;
    }

    try {
      const rawPayload = { var_key: varKey };
      const envelope = {
        session_token: this.sessionToken,
        payload: this.toBase64(JSON.stringify(rawPayload)),
      };

      const resp = await fetch(`${this.baseUrl}/api/v1/client/var`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      });

      if (!resp.ok) {
        return null;
      }

      const data = await resp.json();
      const decrypted = JSON.parse(this.fromBase64(data.payload));
      return decrypted.var_value || null;
    } catch (err) {
      console.error('[VOLQ-Auth] Failed to retrieve remote variable:', err);
      return null;
    }
  }

  private generateNonce(): string {
    const bytes = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private toBase64(str: string): string {
    if (typeof window !== 'undefined' && window.btoa) {
      return window.btoa(unescape(encodeURIComponent(str)));
    }
    return Buffer.from(str, 'utf-8').toString('base64');
  }

  private fromBase64(b64: string): string {
    if (typeof window !== 'undefined' && window.atob) {
      return decodeURIComponent(escape(window.atob(b64)));
    }
    return Buffer.from(b64, 'base64').toString('utf-8');
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return typeof window !== 'undefined' && window.btoa ? window.btoa(binary) : Buffer.from(bytes).toString('base64');
  }
}
