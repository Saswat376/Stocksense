import React, { createContext, useContext, useState, useCallback } from 'react';
import { authApi } from '../api/authApi.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'stocksense_token';

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  const persist = useCallback((tok, usr) => {
    localStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    setUser(usr);
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await authApi.login(credentials);
    persist(data.token, data.user);
    return data;
  }, [persist]);

  const signup = useCallback(async (details) => {
    const { data } = await authApi.signup(details);
    persist(data.token, data.user);
    return data;
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
