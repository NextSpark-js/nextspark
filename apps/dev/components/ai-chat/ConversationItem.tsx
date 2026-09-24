'use client'

import { useState } from 'react'
import { MessageSquare, Pin, MoreVertical, Pencil, Trash2, PinOff } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@nextsparkjs/core/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@nextsparkjs/core/components/ui/dialog'
import { Input } from '@nextsparkjs/core/components/ui/input'
import type { ConversationInfo } from '../../lib/hooks/useConversations'

interface ConversationItemProps {
    conversation: ConversationInfo
    isActive: boolean
    onClick: () => void
    onRename: (name: string) => Promise<void>
    onDelete: () => Promise<void>
    onTogglePin: () => Promise<void>
}

/**
 * Format relative time (e.g., "2h ago", "3d ago")
 */
function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'Just now'
}

/**
 * Get display name for a conversation
 */
function getDisplayName(conversation: ConversationInfo): string {
    if (conversation.name) return conversation.name
    if (conversation.firstMessage) {
        return conversation.firstMessage.slice(0, 40) + (conversation.firstMessage.length > 40 ? '...' : '')
    }
    return 'New conversation'
}

export function ConversationItem({
    conversation,
    isActive,
    onClick,
    onRename,
    onDelete,
    onTogglePin,
}: ConversationItemProps) {
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [newName, setNewName] = useState(conversation.name || '')
    const [isLoading, setIsLoading] = useState(false)

    const displayName = getDisplayName(conversation)

    const handleRename = async () => {
        if (!newName.trim()) return
        setIsLoading(true)
        try {
            await onRename(newName.trim())
            setIsRenameDialogOpen(false)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        setIsLoading(true)
        try {
            await onDelete()
            setIsDeleteDialogOpen(false)
        } finally {
            setIsLoading(false)
        }
    }

    const handleTogglePin = async () => {
        setIsLoading(true)
        try {
            await onTogglePin()
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <div
                data-cy="conversation-item"
                className={cn(
                    'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
                    isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/50'
                )}
                onClick={onClick}
            >
                {/* Pin indicator */}
                {conversation.isPinned && (
                    <Pin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}

                {/* Icon */}
                <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(conversation.updatedAt)}
                        {conversation.messageCount > 0 && (
                            <span> &middot; {conversation.messageCount} msgs</span>
                        )}
                    </p>
                </div>

                {/* Actions dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                            data-cy="conversation-menu"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                setNewName(conversation.name || displayName)
                                setIsRenameDialogOpen(true)
                            }}
                            data-cy="rename-conversation"
                        >
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                handleTogglePin()
                            }}
                            data-cy="toggle-pin-conversation"
                        >
                            {conversation.isPinned ? (
                                <>
                                    <PinOff className="h-4 w-4 mr-2" />
                                    Unpin
                                </>
                            ) : (
                                <>
                                    <Pin className="h-4 w-4 mr-2" />
                                    Pin
                                </>
                            )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                setIsDeleteDialogOpen(true)
                            }}
                            className="text-destructive"
                            data-cy="delete-conversation"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Rename Dialog */}
            <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename conversation</DialogTitle>
                        <DialogDescription>
                            Enter a new name for this conversation.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Conversation name"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleRename()
                            }
                        }}
                        data-cy="rename-input"
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsRenameDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRename}
                            disabled={!newName.trim() || isLoading}
                            data-cy="confirm-rename"
                        >
                            {isLoading ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete conversation</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this conversation? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isLoading}
                            data-cy="confirm-delete"
                        >
                            {isLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
