import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getStoredToken, signIn as googleSignIn, signOut as googleSignOut, trySilentSignIn } from '../lib/googleAuth';

const AuthContext = createContext(null);
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // renew 5 min before expiry

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => getStoredToken()?.accessToken || null);
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const refreshTimer = useRef(null);

  const scheduleRefresh = useCallback((expiresAt) => {
    clearTimeout(refreshTimer.current);
    const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN_MS, 0);
    refreshTimer.current = setTimeout(async () => {
      const renewed = await trySilentSignIn();
      if (renewed) {
        setAccessToken(renewed.accessToken);
        scheduleRefresh(renewed.expiresAt);
      } else {
        setAccessToken(null);
      }
    }, delay);
  }, []);

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      scheduleRefresh(stored.expiresAt);
      return;
    }
    // Harmless no-UI attempt — succeeds only if the browser still has an
    // active, previously-consented Google session for this app.
    trySilentSignIn().then((token) => {
      if (token) { setAccessToken(token.accessToken); scheduleRefresh(token.expiresAt); }
    });
    return () => clearTimeout(refreshTimer.current);
  }, [scheduleRefresh]);

  const signIn = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const token = await googleSignIn();
      setAccessToken(token.accessToken);
      scheduleRefresh(token.expiresAt);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setSigningIn(false);
    }
  }, [scheduleRefresh]);

  const signOut = useCallback(() => {
    clearTimeout(refreshTimer.current);
    googleSignOut();
    setAccessToken(null);
  }, []);

  const value = {
    isSignedIn: !!accessToken,
    accessToken,
    signIn,
    signOut,
    signingIn,
    authError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
