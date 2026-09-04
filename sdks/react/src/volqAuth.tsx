import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { AuthResult, Subscription, VolqAuthConfig, VolqAuthContextType } from './types';
import { VolqAuthClient } from './client';

const VolqAuthContext = createContext<VolqAuthContextType | undefined>(undefined);

export interface VolqAuthProviderProps extends VolqAuthConfig {
  children: React.ReactNode;
}

export const VolqAuthProvider: React.FC<VolqAuthProviderProps> = ({
  appId,
  appVersion = '1.0.0',
  masterPublicKey = '',
  baseUrl = 'http://localhost:8080',
  autoInit = true,
  children,
}) => {
  const client = useMemo(
    () =>
      new VolqAuthClient({
        appId,
        appVersion,
        masterPublicKey,
        baseUrl,
      }),
    [appId, appVersion, masterPublicKey, baseUrl]
  );

  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(autoInit);
  const [error, setError] = useState<string | null>(null);
  const [hwid, setHwid] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const init = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const devHwid = await client.getHWID();
      setHwid(devHwid);

      const ok = await client.init();
      setIsInitialized(ok);
      if (!ok) {
        setError('Handshake failed. Check backend connectivity or App ID.');
      }
      return ok;
    } catch (err: any) {
      setError(err.message || 'Initialization failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (autoInit) {
      init();
    }
  }, [autoInit, init]);

  const loginWithLicense = useCallback(
    async (licenseKey: string): Promise<AuthResult> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.authenticateLicense(licenseKey);
        if (result.status === 'success') {
          setIsAuthenticated(true);
          setSubscription(result.subscription || null);
          setSessionToken(result.session_token || null);
        } else {
          setError(result.message);
        }
        return result;
      } catch (err: any) {
        const msg = err.message || 'Authentication error';
        setError(msg);
        return { status: 'error', message: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const loginWithCredentials = useCallback(
    async (username: string, password: string): Promise<AuthResult> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.authenticateUser(username, password);
        if (result.status === 'success') {
          setIsAuthenticated(true);
          setSubscription(result.subscription || null);
          setSessionToken(result.session_token || null);
        } else {
          setError(result.message);
        }
        return result;
      } catch (err: any) {
        const msg = err.message || 'Authentication error';
        setError(msg);
        return { status: 'error', message: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const getVariable = useCallback(
    async (varKey: string): Promise<string | null> => {
      try {
        return await client.getVariable(varKey);
      } catch (err) {
        return null;
      }
    },
    [client]
  );

  const logout = useCallback(() => {
    client.setSessionToken(null);
    setIsAuthenticated(false);
    setSubscription(null);
    setSessionToken(null);
    setError(null);
  }, [client]);

  const value = useMemo<VolqAuthContextType>(
    () => ({
      isInitialized,
      isAuthenticated,
      isLoading,
      error,
      hwid,
      subscription,
      sessionToken,
      init,
      loginWithLicense,
      loginWithCredentials,
      getVariable,
      logout,
    }),
    [
      isInitialized,
      isAuthenticated,
      isLoading,
      error,
      hwid,
      subscription,
      sessionToken,
      init,
      loginWithLicense,
      loginWithCredentials,
      getVariable,
      logout,
    ]
  );

  return <VolqAuthContext.Provider value={value}>{children}</VolqAuthContext.Provider>;
};

export function useVolqAuth(): VolqAuthContextType {
  const context = useContext(VolqAuthContext);
  if (!context) {
    throw new Error('useVolqAuth must be used within a <VolqAuthProvider>');
  }
  return context;
}
