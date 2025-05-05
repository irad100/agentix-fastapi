'use client';

import React, { useState, FormEvent, useRef, useEffect } from 'react';
import api from '@/lib/api';
import { useChat } from '@/context/ChatContext';
import { useSession } from '@/context/SessionContext';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { PanelLeftClose, PanelRightClose, Eraser } from 'lucide-react'; // Icons for toggle and Eraser
import ReactMarkdown from 'react-markdown';

// Define the structure of the JSON data expected within each SSE message
// Based on app/schemas/chat.py StreamResponse
interface StreamChunk {
  content: string;
  done: boolean;
}

// Define the message structure based on openapi.json
interface Message {
  role: 'user' | 'assistant' | 'system'; // System messages might not be displayed directly
  content: string;
}


// Define props
interface ChatInterfaceProps {
  toggleSidebar: () => void;
  isSidebarCollapsed: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ toggleSidebar, isSidebarCollapsed }) => {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { activeSessionInfo } = useSession();
  const { messages, setMessages, clearChatHistory, isLoadingMessages } = useChat();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Log the active session info whenever it changes or component mounts
  useEffect(() => {
    console.log("[ChatInterface] Active session info from context:", activeSessionInfo);
  }, [activeSessionInfo]);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      // Target the viewport div inside ScrollArea
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clean up fetch on component unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isSending || !activeSessionInfo) return;

    // Abort previous request if any
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const userMessage: Message = { role: 'user', content: input };
    const assistantPlaceholder: Message = { role: 'assistant', content: '' };
    const currentMessages = [...messages, userMessage, assistantPlaceholder];
    setMessages(currentMessages);
    setInput('');
    setIsSending(true);

    await new Promise(resolve => setTimeout(resolve, 0));
    scrollToBottom();

    try {
      // Get token directly from context state
      const token = activeSessionInfo?.token?.access_token;
      if (!token) {
        // This should ideally not happen due to the guard at the start of handleSubmit
        throw new Error("Session token is missing, cannot send message.");
      }

      const streamUrl = `${api.defaults.baseURL || ''}/api/v1/chatbot/chat/stream`;

      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${token}`, // Set header directly
        },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to get error details' }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      if (!response.body) throw new Error('Response body is null');
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';

      // Read the stream

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          console.log('Stream finished.');
          break; // Exit loop when stream is finished
        }

        buffer += value;
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep the last partial line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6);
              const chunk: StreamChunk = JSON.parse(jsonStr);

              if (chunk.done) {
                console.log('Stream marked as done by server.');
                // Final update might be empty if server sends done signal separately
                // No need to break here, the reader finishing will do it.
              } else {
                // Update the content of the last message (assistant's placeholder)
                setMessages((prevMessages) => {
                  const lastMessage = prevMessages[prevMessages.length - 1];
                  if (lastMessage && lastMessage.role === 'assistant') {
                    return [
                      ...prevMessages.slice(0, -1),
                      { ...lastMessage, content: lastMessage.content + chunk.content },
                    ];
                  }
                  return prevMessages; // Should not happen if placeholder was added
                });
              }
            } catch (e) {
              console.error('Failed to parse stream chunk:', e, "Chunk:", line);
            }
          }
        }
        // Scroll continuously as content arrives
        scrollToBottom();
      }

    } catch (error: unknown) {
      console.error('Error during chat stream:', error);

      let errorMessage = "An unexpected error occurred."; // Default message

      // Check if it's an Error instance to safely access properties
      if (error instanceof Error) {
        if (error.name !== 'AbortError') {
          errorMessage = error.message;
          setMessages((prevMessages) => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === '') {
              // Update placeholder if it exists
              return [
                ...prevMessages.slice(0, -1),
                { role: 'assistant', content: `Sorry, an error occurred: ${errorMessage}` },
              ];
            }
            // Otherwise, add a new error message
            return [
              ...prevMessages,
              { role: 'assistant', content: `Sorry, an error occurred: ${errorMessage}` },
            ];
          });
        } else {
          console.log("Fetch aborted by user."); // AbortError is expected, maybe just log it
        }
      } else {
        // Handle cases where the caught object is not an Error instance
        console.error("Caught a non-Error object:", error);
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: 'assistant', content: `Sorry, an unexpected error occurred.` }, // Use generic message
        ]);
      }

    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  // Handler for clearing chat
  const handleClearChat = async () => {
    console.log("Attempting to clear chat history...");
    try {
      await clearChatHistory();
    } catch (error) {
      console.error("Clear chat history failed:", error);
      // Optionally show an error message to the user (e.g., using a Toast component)
      alert("Failed to clear chat history. Please try again."); // Simple alert for now
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-card text-card-foreground">
        {/* Toggle Button */}
        <Button variant="ghost" size="icon" onClick={toggleSidebar} title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
          {isSidebarCollapsed ? <PanelRightClose className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
        {/* Title */}
        <h1 className="text-lg font-semibold mx-auto text-center truncate px-2" title={activeSessionInfo?.name || 'Chat'}>
          {activeSessionInfo?.name || 'Chat'}
        </h1>
        {/* Action Buttons Container (Remove Logout Button) */}
        <div className="flex items-center space-x-2 min-w-[80px] justify-end"> {/* Added min-width and justify-end */}
          {/* Clear History Button & Dialog */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Clear Chat History" disabled={!activeSessionInfo || isLoadingMessages || messages.length === 0}>
                <Eraser className="h-5 w-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently clear the message
                  history for this chat session.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Clear History
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Placeholder to maintain spacing, or add other icons here later */}
          <div className="w-[36px]"></div> {/* Adjust width as needed */}
        </div>
      </div>

      {/* Message Area */}
      <ScrollArea className="flex-1 p-4 min-h-0" ref={scrollAreaRef}>
        <div className="space-y-4">
          {/* Display loading indicator if messages are loading */}
          {isLoadingMessages && (
            <div className="p-4 text-center text-muted-foreground">
              Loading messages...
            </div>
          )}
          {/* Display messages from context */}
          {!isLoadingMessages && messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-card">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            disabled={isSending}
            autoComplete="off"
          />
          <Button type="submit" disabled={isSending || !input.trim()}>
            {/* Change button text slightly if needed */}
            {isSending ? '...' : 'Send'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface; 