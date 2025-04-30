'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSession, SessionInfo } from '@/context/SessionContext';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlusCircle, Trash2, Pencil, MessageSquare, LogOut } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Define component props
interface SessionSidebarProps {
    isCollapsed: boolean;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({ isCollapsed }) => {
    const {
        sessions, // Now contains SessionInfo[]
        activeSessionInfo, // Now contains SessionInfo | null
        createNewSession,
        switchActiveSession, // Expects SessionInfo
        deleteSession, // Get delete function
        renameSession, // Get rename function
        isSessionLoading, // Use session loading state here
    } = useSession();

    const {
        isLoading: isAuthLoading,
        logout, // Get logout function
        user, // Get user object from context
    } = useAuth();

    // State for rename dialog
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [sessionToRename, setSessionToRename] = useState<SessionInfo | null>(null);
    const [newName, setNewName] = useState("");

    // State for delete confirmation dialog
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);

    // Use the email from the user object
    const displayEmail = user?.email || "User"; // Fallback if user or email is null
    const userInitials = displayEmail?.charAt(0)?.toUpperCase() || "U";

    // Fetch sessions on initial mount if not already loading (handled by SessionContext useEffect)
    // useEffect(() => {
    //     if (!isAuthLoading && !isSessionLoading) { // Check both loading states if needed?
    //         fetchSessions();
    //     }
    // }, [isAuthLoading, isSessionLoading, fetchSessions]);

    const handleNewChat = async () => {
        await createNewSession();
        // setActiveSession is called within createNewSession
        // The chat interface should clear itself based on activeSessionInfo changing
    };

    // Pass the full session object when switching
    const handleSelectSession = (session: SessionInfo) => {
        console.log("Switching to session:", session.session_id);
        switchActiveSession(session);
    };

    // Open delete confirmation
    const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation(); // Prevent triggering handleSelectSession
        setSessionToDeleteId(sessionId);
        setIsDeleteDialogOpen(true);
    };

    // Confirm deletion
    const confirmDelete = () => {
        if (sessionToDeleteId) {
            console.log("Deleting session:", sessionToDeleteId);
            deleteSession(sessionToDeleteId);
            setSessionToDeleteId(null); // Reset after deletion
            // Dialog closes automatically via AlertDialogAction/Cancel
        } else {
            console.error("Session ID to delete is null");
        }
    };

    // Functions for rename dialog
    const openRenameDialog = (e: React.MouseEvent, session: SessionInfo) => {
        e.stopPropagation(); // Prevent triggering select
        setSessionToRename(session);
        setNewName(session.name || ""); // Pre-fill with current name
        setIsRenameDialogOpen(true);
    };

    const handleRenameSubmit = () => {
        if (sessionToRename && newName.trim()) {
            renameSession(sessionToRename.session_id, newName.trim());
            setIsRenameDialogOpen(false); // Close dialog
            setSessionToRename(null);
            setNewName("");
        }
    };

    return (
        <div className={cn("flex flex-col h-full border-r", isCollapsed ? "items-center" : "")}>
            <div className={cn("p-4 flex justify-between items-center border-b", isCollapsed ? "px-2" : "")}>
                {!isCollapsed && <h2 className="text-lg font-semibold">Chats</h2>}
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleNewChat} title="New Chat">
                                <PlusCircle className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        {!isCollapsed && <TooltipContent side="bottom"><p>New Chat</p></TooltipContent>}
                    </Tooltip>
                </TooltipProvider>
            </div>
            <ScrollArea className="flex-1 p-2">
                <div className={cn("space-y-1", isCollapsed ? "flex flex-col items-center" : "")}>
                    {sessions.map((session: SessionInfo) => (
                        <TooltipProvider key={session.session_id} delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center space-x-1 group w-full">
                                        <Button
                                            variant={activeSessionInfo?.session_id === session.session_id ? "secondary" : "ghost"}
                                            className={cn(
                                                "flex-1 justify-start truncate",
                                                isCollapsed ? "w-10 h-10 p-0 justify-center" : "w-full"
                                            )}
                                            onClick={() => handleSelectSession(session)}
                                            aria-label={session.name || 'Untitled Chat'}
                                        >
                                            {isCollapsed ? (
                                                <MessageSquare className="h-5 w-5" />
                                            ) : (
                                                session.name || 'Untitled Chat'
                                            )}
                                        </Button>
                                        {!isCollapsed && (
                                            <>
                                                <Dialog open={isRenameDialogOpen && sessionToRename?.session_id === session.session_id} onOpenChange={(open) => { if (!open) setIsRenameDialogOpen(false); }}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => openRenameDialog(e, session)} title="Rename Chat"> <Pencil className="h-4 w-4" /> </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Rename Chat</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="grid gap-4 py-4">
                                                            <div className="grid grid-cols-4 items-center gap-4">
                                                                <Label htmlFor="name" className="text-right">Name</Label>
                                                                <Input
                                                                    id="name"
                                                                    value={newName}
                                                                    onChange={(e) => setNewName(e.target.value)}
                                                                    className="col-span-3"
                                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <DialogFooter>
                                                            <DialogClose asChild>
                                                                <Button variant="outline">Cancel</Button>
                                                            </DialogClose>
                                                            <Button onClick={handleRenameSubmit} disabled={!newName.trim()}>Save</Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                                <AlertDialog open={isDeleteDialogOpen && sessionToDeleteId === session.session_id} onOpenChange={setIsDeleteDialogOpen}>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={(e) => handleDeleteClick(e, session.session_id)} title="Delete Chat">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone. This will permanently delete the chat
                                                                session &quot;{session.name || 'Untitled Chat'}&quot; and all its messages.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={() => setSessionToDeleteId(null)}>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                {isCollapsed && <TooltipContent side="right"><p>{session.name || 'Untitled Chat'}</p></TooltipContent>}
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                    {sessions.length === 0 && !isSessionLoading && !isAuthLoading && (
                        <p className="text-sm text-muted-foreground p-2 text-center">No chats yet.</p>
                    )}
                    {(isSessionLoading || isAuthLoading) && (
                        <p className="text-sm text-muted-foreground p-2 text-center">Loading...</p>
                    )}
                </div>
            </ScrollArea>
            {/* Footer with User Info & Logout */}
            <div className={cn("p-2 border-t", isCollapsed ? "px-2" : "px-4 py-3")}>
                <DropdownMenu>
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className={cn("w-full justify-start text-sm font-medium", isCollapsed ? "justify-center h-10 w-10 p-0" : "justify-start")}>
                                        {!isCollapsed && (
                                            <span className="truncate">{displayEmail}</span>
                                        )}
                                        {/* Display initials directly when collapsed */}
                                        {isCollapsed && (
                                            <span className="font-medium">{userInitials}</span>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            {isCollapsed && <TooltipContent side="right"><p>{displayEmail}</p></TooltipContent>}
                        </Tooltip>
                    </TooltipProvider>
                    <DropdownMenuContent
                        side="top"
                        align={isCollapsed ? "center" : "start"}
                        alignOffset={4}
                    >
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};

export default SessionSidebar; 