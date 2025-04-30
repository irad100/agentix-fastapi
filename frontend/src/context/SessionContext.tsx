'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { useAuth } from './AuthContext'; // Import useAuth to access user token

// --- Interfaces (Copied from AuthContext) ---
interface Token {
    access_token: string;
    token_type: string;
    expires_at: string;
}

export interface SessionInfo {
    session_id: string;
    name: string;
    token: Token;
}

interface SessionResponse {
    session_id: string;
    name: string;
    token: { access_token: string; token_type: string; expires_at: string; };
}

// --- Context Definition ---

interface SessionContextType {
    sessions: SessionInfo[];
    activeSessionInfo: SessionInfo | null;
    isSessionLoading: boolean; // Loading state for session operations
    fetchSessions: () => Promise<void>;
    createNewSession: () => Promise<SessionInfo | null>; // Return the new session
    switchActiveSession: (sessionInfo: SessionInfo | null) => void;
    renameSession: (sessionId: string, newName: string) => Promise<void>;
    deleteSession: (sessionId: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { userToken } = useAuth(); // Get user token and auth status

    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [activeSessionInfo, setActiveSessionInfo] = useState<SessionInfo | null>(null);
    const [isSessionLoading, setIsSessionLoading] = useState(true); // Initially true until first fetch

    // Renamed setActiveSession for clarity within this context
    const switchActiveSession = useCallback((sessionInfo: SessionInfo | null) => {
        console.log("[SessionContext] Setting active session to:", sessionInfo?.session_id ?? 'null');
        setActiveSessionInfo(sessionInfo);
        if (sessionInfo) {
            localStorage.setItem('activeSessionId', sessionInfo.session_id); // Still useful for restoring preference
            localStorage.setItem('activeSessionInfo', JSON.stringify(sessionInfo));
        } else {
            localStorage.removeItem('activeSessionId');
            localStorage.removeItem('activeSessionInfo');
        }
    }, []);

    // Forward declare createNewSession for fetchSessions dependency
    const createNewSessionFn: () => Promise<SessionInfo | null> = useCallback(async (): Promise<SessionInfo | null> => {
        if (!userToken) {
            console.error("[SessionContext] Cannot create session, user not authenticated.");
            return null;
        }
        console.log("[SessionContext] Creating new session...");
        setIsSessionLoading(true); // Indicate loading during creation
        try {
            // Interceptor adds userToken
            const response = await api.post<SessionResponse>('/api/v1/auth/session', null);
            const newSession: SessionInfo = { ...response.data, name: response.data.name || 'Untitled Chat' }; // Ensure name default
            console.log("[SessionContext] New session created:", newSession.session_id);
            // Add to list and set active *before* refetching to improve UI responsiveness
            setSessions(prev => [...prev, newSession]);
            switchActiveSession(newSession);
            // Optional: could skip immediate refetch if confident state is correct
            // await fetchSessions(); // Fetch updated list maybe redundant now
            return newSession;
        } catch (error) {
            console.error("[SessionContext] Failed to create new session:", error);
            return null;
        } finally {
            setIsSessionLoading(false);
        }
    }, [userToken, switchActiveSession]);

    const fetchSessions = useCallback(async () => {
        if (!userToken) {
            setSessions([]);
            switchActiveSession(null); // Clear active session if not authenticated
            setIsSessionLoading(false);
            return;
        }
        setIsSessionLoading(true);
        let fetchedSessions: SessionInfo[] = [];
        try {
            console.log("[SessionContext] Fetching sessions...");
            // Interceptor will add the userToken
            const response = await api.get<SessionInfo[]>('/api/v1/auth/sessions');
            fetchedSessions = response.data.map(s => ({ ...s, name: s.name || 'Untitled Chat' }));
            setSessions(fetchedSessions);
            console.log("[SessionContext] Fetched sessions:", fetchedSessions.length);

            // Restore or set active session
            const lastStoredActiveId = localStorage.getItem('activeSessionId');
            let sessionToActivate: SessionInfo | null = null;
            if (lastStoredActiveId) {
                sessionToActivate = fetchedSessions.find(s => s.session_id === lastStoredActiveId) || null;
            }
            if (!sessionToActivate && fetchedSessions.length > 0) {
                sessionToActivate = fetchedSessions[fetchedSessions.length - 1]; // Default to newest
            }

            switchActiveSession(sessionToActivate); // Use the internal setter

        } catch (error) {
            console.error("[SessionContext] Failed to fetch sessions:", error);
            setSessions([]);
            switchActiveSession(null);
        } finally {
            setIsSessionLoading(false);
            // If fetch succeeded but list was empty, create one
            if (fetchedSessions.length === 0) {
                console.log("[SessionContext] No existing sessions found, creating a new one.");
                await createNewSessionFn(); // Call the const directly
            }
        }
    }, [userToken, switchActiveSession, createNewSessionFn]); // Add createNewSessionFn to dependencies

    const renameSession = useCallback(async (sessionId: string, newName: string) => {
        const sessionToRename = sessions.find(s => s.session_id === sessionId);
        if (!sessionToRename?.token?.access_token) {
            console.error("[SessionContext] Cannot rename session, token not found for:", sessionId);
            return;
        }
        const token = sessionToRename.token.access_token;
        const sanitizedName = newName.trim() || "Untitled Chat";
        console.log(`[SessionContext] Renaming session ${sessionId} to '${sanitizedName}'`);
        const formData = new URLSearchParams();
        formData.append('name', sanitizedName);

        try {
            // Manual header needed for specific session token
            const response = await api.patch<SessionInfo>(`/api/v1/auth/session/${sessionId}/name`, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${token}`
                }
            });
            const updatedSession = { ...response.data, name: sanitizedName };
            console.log(`[SessionContext] Session ${sessionId} renamed successfully.`);
            const updatedSessions = sessions.map(s => s.session_id === sessionId ? updatedSession : s);
            setSessions(updatedSessions);
            if (activeSessionInfo?.session_id === sessionId) {
                switchActiveSession(updatedSession);
            }
        } catch (error) {
            console.error(`[SessionContext] Failed to rename session ${sessionId}:`, error);
        }
    }, [sessions, activeSessionInfo, switchActiveSession]);

    const deleteSession = useCallback(async (sessionId: string) => {
        const sessionToDelete = sessions.find(s => s.session_id === sessionId);
        if (!sessionToDelete?.token?.access_token) {
            console.error("[SessionContext] Cannot delete session, token not found for:", sessionId);
            return;
        }
        const token = sessionToDelete.token.access_token;
        console.log(`[SessionContext] Deleting session: ${sessionId}`);
        try {
            // Manual header required if backend expects session token for delete
            // If backend expects USER token, this needs changing back & interceptor should handle it.
            await api.delete(`/api/v1/auth/session/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${token}` // Assuming delete needs SESSION token now
                }
            });
            console.log(`[SessionContext] Session ${sessionId} deleted successfully.`);
            const remainingSessions = sessions.filter(s => s.session_id !== sessionId);
            setSessions(remainingSessions);
            if (activeSessionInfo?.session_id === sessionId) {
                const sessionToActivate = remainingSessions.length > 0 ? remainingSessions[remainingSessions.length - 1] : null;
                switchActiveSession(sessionToActivate);
                // If no sessions left, create a new one
                if (!sessionToActivate) {
                    await createNewSessionFn();
                }
            }
        } catch (error) {
            console.error(`[SessionContext] Failed to delete session ${sessionId}:`, error);
        }
        // Dependencies adjusted
    }, [sessions, activeSessionInfo, switchActiveSession, createNewSessionFn]);

    // Effect to fetch sessions when user logs in (userToken becomes available)
    useEffect(() => {
        if (userToken) {
            console.log("[SessionContext] Auth token available, fetching sessions.");
            fetchSessions();
        } else {
            console.log("[SessionContext] No auth token, clearing sessions.");
            setSessions([]);
            switchActiveSession(null);
            setIsSessionLoading(false); // Not loading if not authenticated
        }
    }, [userToken, fetchSessions, switchActiveSession]); // React to userToken changes and include switchActiveSession


    const contextValue = useMemo(() => ({
        sessions,
        activeSessionInfo,
        isSessionLoading,
        fetchSessions,
        createNewSession: createNewSessionFn,
        switchActiveSession,
        renameSession,
        deleteSession,
    }), [
        sessions,
        activeSessionInfo,
        isSessionLoading,
        fetchSessions,
        createNewSessionFn,
        switchActiveSession,
        renameSession,
        deleteSession
    ]);

    return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextType => {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}; 