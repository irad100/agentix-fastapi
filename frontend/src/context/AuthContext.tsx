'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

// --- Interfaces (Keep User, Remove Token/SessionInfo) ---

interface User {
    id: number | null;
    email: string | null;
}

// --- Context Definition (Remove session state/functions) ---
interface AuthContextType {
  userToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (newToken: string, expiresAt: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  // Removed: activeSessionInfo, sessions, createNewSession, switchActiveSession, fetchSessions, deleteSession, renameSession
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // Removed: activeSessionInfo, sessions state
  const [isLoading, setIsLoading] = useState(true); // Keep auth loading state
  const router = useRouter();

  // Removed: Forward declare createNewSessionFn

  // Keep fetchUserDetails
  const fetchUserDetails = useCallback(async (token: string) => {
    console.log("[AuthContext] Fetching user details...");
    try {
      // Interceptor will add token
      const response = await api.get<User>('/api/v1/auth/me');
      setUser({ id: response.data.id, email: response.data.email });
      console.log("[AuthContext] User details fetched:", response.data.email);
      return true; // Indicate success
    } catch (error) {
      console.error("Failed to fetch user details:", error);
      setUser(null); // Clear user details on error
      return false; // Indicate failure
    }
  }, []); 

  // Removed: setActiveSession, fetchSessions, createNewSessionFn, renameSession, deleteSession

  // Keep logout
  const logout = useCallback(() => {
      console.log("[AuthContext] Logging out...");
      localStorage.removeItem('authToken');
      localStorage.removeItem('authTokenExpiry');
      // Remove session items handled by SessionContext reacting to userToken being null
      localStorage.removeItem('activeSessionId'); 
      localStorage.removeItem('activeSessionInfo');
      setUserToken(null); // This will trigger SessionContext useEffect
      setUser(null);
      // SessionContext will handle clearing its state
      router.push('/login');
  }, [router]);

  // Keep checkAuth, but simplify - only responsible for token and user details
  const checkAuth = useCallback(async () => {
        console.log("[AuthContext] [checkAuth] Starting check...");
        setIsLoading(true);
        let foundValidToken = false;
        try {
            const storedToken = localStorage.getItem('authToken');
            const expiry = localStorage.getItem('authTokenExpiry');

            if (storedToken && expiry) {
                const expiryDate = new Date(expiry);
                if (expiryDate > new Date()) {
                    console.log("[AuthContext] [checkAuth] Valid token found in storage.");
                    setUserToken(storedToken);
                    // Fetch user details using the valid token
                    await fetchUserDetails(storedToken); 
                    foundValidToken = true;
                } else {
                    console.log("[AuthContext] [checkAuth] Token expired.");
                    // No need to call logout(), just don't set the token
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('authTokenExpiry');
                }
            } else {
                 console.log("[AuthContext] [checkAuth] No token found.");
            }
        } catch (error) {
            console.error("[AuthContext] [checkAuth] Error during auth check:", error);
            // Don't call logout(), just ensure token is null
            setUserToken(null);
        } finally {
             // If no valid token was found after checking, ensure state reflects logged out
             if (!foundValidToken) {
                 setUserToken(null);
                 setUser(null);
             }
             setIsLoading(false);
             console.log("[AuthContext] [checkAuth] Finalized check, loading false.");
        }
  }, [fetchUserDetails]); // Only depends on fetchUserDetails now

  useEffect(() => {
    checkAuth();
  }, [checkAuth]); // Run only on mount

  // Keep login, but simplify - only sets token and fetches user
  const login = useCallback(async (newToken: string, expiresAt: string) => {
    console.log("[AuthContext] Logging in...");
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('authTokenExpiry', expiresAt);
    setUserToken(newToken); // Setting token triggers SessionContext fetch
    // Fetch user details immediately after login
    await fetchUserDetails(newToken); 
    // Session fetching is now handled by SessionContext reacting to userToken
    router.push('/');
  }, [router, fetchUserDetails]); // Depends on fetchUserDetails

  // Keep isAuthenticated
  const isAuthenticated = useMemo(() => !!userToken && !!user, [userToken, user]);

  // Update contextValue
  const contextValue = useMemo(() => ({
    userToken,
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
  }), [
    userToken,
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth
  ]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// Keep useAuth
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 