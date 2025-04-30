'use client'; // Needs to be a client component for hooks

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatInterface from "@/app/components/ChatInterface";
import SessionSidebar from "@/app/components/SessionSidebar"; // Import Sidebar
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { ImperativePanelGroupHandle } from "react-resizable-panels"; // Correct import type

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const layoutGroupRef = useRef<ImperativePanelGroupHandle>(null); // Use correct ref type
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarDefaultSize = 25;
  const sidebarCollapsedSize = 4; // Small size to potentially show icons later

  useEffect(() => {
    // If not loading and not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const toggleSidebar = () => {
    const group = layoutGroupRef.current;
    if (group) {
      if (isSidebarCollapsed) {
        // Expand: Set layout to default sizes
        group.setLayout([sidebarDefaultSize, 100 - sidebarDefaultSize]);
        setIsSidebarCollapsed(false);
      } else {
        // Collapse: Set layout with collapsed size for sidebar
        group.setLayout([sidebarCollapsedSize, 100 - sidebarCollapsedSize]);
        setIsSidebarCollapsed(true);
      }
    }
  };

  // Handle panel resize/collapse/expand events to keep state in sync
  const handleLayout = (sizes: number[]) => {
    // Check if the first panel (sidebar) is at collapsed size
    if (sizes[0] <= sidebarCollapsedSize) {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  };

  // Show loading state or null while checking auth or redirecting
  if (isLoading || !isAuthenticated) {
    // TODO: Use a proper loading component (e.g., shadcn Skeleton)
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Render ChatInterface only if authenticated
  return (
    <main className="min-h-screen h-screen flex flex-col">
      <ResizablePanelGroup
        ref={layoutGroupRef}
        direction="horizontal"
        className="flex-1 border"
        onLayout={handleLayout} // Sync state on layout change
      >
        <ResizablePanel
          defaultSize={sidebarDefaultSize}
          minSize={15}
          maxSize={40}
          collapsible={true} // Enable collapsible prop
          collapsedSize={sidebarCollapsedSize}
          order={1} // Explicitly set order
          className={isSidebarCollapsed ? "min-w-[50px] transition-all duration-300 ease-in-out" : ""} // Style collapsed panel if needed
        >
          <SessionSidebar isCollapsed={isSidebarCollapsed} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize={75}
          order={2} // Explicitly set order
        >
          {/* Pass props to ChatInterface */}
          <ChatInterface toggleSidebar={toggleSidebar} isSidebarCollapsed={isSidebarCollapsed} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
