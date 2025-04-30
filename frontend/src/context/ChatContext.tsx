'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import { useSession } from './SessionContext'; // Import useSession to access session info

// Define the Message structure (matching backend schema)
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Define the structure for the ChatResponse (matching backend schema)
interface ChatResponse {
  messages: Message[];
}

interface ChatContextType {
  messages: Message[];
  isLoadingMessages: boolean;
  fetchMessages: () => Promise<void>;
  clearChatHistory: () => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>; // Allow direct setting for streaming updates
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { activeSessionInfo } = useSession(); // Get active session info from SessionContext
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!activeSessionInfo?.token?.access_token) {
      // console.log("[ChatContext] Cannot fetch messages, no active session token.");
      setMessages([]); // Clear messages if no active session
      return;
    }
    const token = activeSessionInfo.token.access_token;
    const sessionId = activeSessionInfo.session_id;
    console.log(`[ChatContext] Fetching messages for session: ${sessionId}`);
    setIsLoadingMessages(true);
    try {
      // Interceptor will add the active session token based on the URL
      const response = await api.get<ChatResponse>(`/api/v1/chatbot/messages`); // Removed manual header
      setMessages(response.data.messages || []);
      console.log(`[ChatContext] Fetched ${response.data.messages?.length || 0} messages for session ${sessionId}.`);
    } catch (error: any) {
      console.error(`[ChatContext] Failed to fetch messages for session ${sessionId}:`, error);
      // Handle specific errors, e.g., 404 might mean no history, not necessarily an error display
       if (error.response?.status === 404) {
           setMessages([]); // Set empty array if chat history doesn't exist yet
           console.log(`[ChatContext] No message history found for session ${sessionId}.`);
       } else {
          // TODO: Maybe show a toast notification for other errors
       }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [activeSessionInfo]);

  const clearChatHistory = useCallback(async () => {
    if (!activeSessionInfo?.token?.access_token) {
      console.error("[ChatContext] Cannot clear chat history, no active session or token found.");
      return;
    }
    const token = activeSessionInfo.token.access_token;
    const sessionId = activeSessionInfo.session_id;

    console.log(`[ChatContext] Clearing chat history for session: ${sessionId}`);
    try {
      // Interceptor will add the active session token based on the URL
      await api.delete('/api/v1/chatbot/messages'); // Removed manual header
      setMessages([]); // Clear messages in the state immediately
      console.log(`[ChatContext] Chat history for session ${sessionId} cleared successfully.`);
      // Optionally: Show success toast
    } catch (error) {
      console.error(`[ChatContext] Failed to clear chat history for session ${sessionId}:`, error);
      // Optionally show an error message to the user
    }
  }, [activeSessionInfo]);

  // Fetch messages when the active session changes
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]); // fetchMessages dependency includes activeSessionInfo

  const contextValue = {
    messages,
    isLoadingMessages,
    fetchMessages,
    clearChatHistory,
    setMessages, // Expose setMessages
  };

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 