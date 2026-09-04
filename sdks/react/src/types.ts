export interface Subscription {
  name: string;
  tier_level: number;
  expires_at: number;
}

export interface AuthResult {
  status: 'success' | 'error';
  message: string;
  subscription?: Subscription;
  session_token?: string;
}

export interface VolqAuthConfig {
  appId: string;
  appVersion?: string;
  masterPublicKey?: string;
  baseUrl?: string;
  autoInit?: boolean;
}

export interface VolqAuthContextType {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hwid: string | null;
  subscription: Subscription | null;
  sessionToken: string | null;
  init: () => Promise<boolean>;
  loginWithLicense: (licenseKey: string) => Promise<AuthResult>;
  loginWithCredentials: (username: string, password: string) => Promise<AuthResult>;
  getVariable: (varKey: string) => Promise<string | null>;
  logout: () => void;
}
