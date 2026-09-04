'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from './api';
import { Application, UserProfile } from './types';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  apps: Application[];
  selectedApp: Application | null;
  setSelectedApp: (app: Application | null) => void;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  refreshApps: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  apps: [],
  selectedApp: null,
  setSelectedApp: () => {},
  login: () => {},
  logout: () => {},
  refreshApps: async () => {},
  isLoading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshApps = async () => {
    try {
      const res = await api.get('/dashboard/apps');
      const appList: Application[] = res.data;
      setApps(appList);

      // Restore previously selected app or default to first
      const storedAppId = localStorage.getItem('volq_selected_app_id');
      if (storedAppId) {
        const found = appList.find((a) => a.id === storedAppId);
        if (found) {
          setSelectedApp(found);
          return;
        }
      }

      if (appList.length > 0 && !selectedApp) {
        setSelectedApp(appList[0]);
        localStorage.setItem('volq_selected_app_id', appList[0].id);
      }
    } catch (err) {
      console.error('Failed to load applications', err);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('volq_token');
    const storedUser = localStorage.getItem('volq_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      refreshApps().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleSetSelectedApp = (app: Application | null) => {
    setSelectedApp(app);
    if (app) {
      localStorage.setItem('volq_selected_app_id', app.id);
    } else {
      localStorage.removeItem('volq_selected_app_id');
    }
  };

  const login = (newToken: string, newUser: UserProfile) => {
    localStorage.setItem('volq_token', newToken);
    localStorage.setItem('volq_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    refreshApps();
  };

  const logout = () => {
    localStorage.removeItem('volq_token');
    localStorage.removeItem('volq_user');
    localStorage.removeItem('volq_selected_app_id');
    setToken(null);
    setUser(null);
    setApps([]);
    setSelectedApp(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        apps,
        selectedApp,
        setSelectedApp: handleSetSelectedApp,
        login,
        logout,
        refreshApps,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
