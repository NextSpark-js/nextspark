/**
 * Productivity Sidebar - Board-Focused Design
 * Clean, always-visible sidebar optimized for board navigation
 */

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { useAuth } from '@nextsparkjs/core/hooks/useAuth'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { useTeamsConfig } from '@nextsparkjs/core/hooks/useTeamsConfig'
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
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@nextsparkjs/core/components/ui/dialog'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Label } from '@nextsparkjs/core/components/ui/label'
import {
    Kanban,
    Plus,
    ChevronDown,
    LogOut,
    Settings,
    Users,
    Check,
    Loader2,
    LayoutGrid,
    Star,
    MoreHorizontal,
    Pencil,
    Trash2,
    Archive
} from 'lucide-react'

interface Board {
    id: string
    name: string
    color: string
    description?: string
}

interface Team {
    id: string
    name: string
    type: string
}

// Board colors with CSS variables
const BOARD_COLORS = [
    { id: 'blue', class: 'bg-[var(--board-blue)]', label: 'Blue' },
    { id: 'green', class: 'bg-[var(--board-green)]', label: 'Green' },
    { id: 'purple', class: 'bg-[var(--board-purple)]', label: 'Purple' },
    { id: 'orange', class: 'bg-[var(--board-orange)]', label: 'Orange' },
    { id: 'red', class: 'bg-[var(--board-red)]', label: 'Red' },
    { id: 'pink', class: 'bg-[var(--board-pink)]', label: 'Pink' },
    { id: 'gray', class: 'bg-[var(--board-gray)]', label: 'Gray' },
]

const getColorClass = (color: string) => {
    return BOARD_COLORS.find(c => c.id === color)?.class || BOARD_COLORS[0].class
}

// Quick Create Board Dialog
function CreateBoardDialog({
    open,
    onOpenChange,
    onCreated
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated: () => void
}) {
    const { currentTeam } = useTeamContext()
    const router = useRouter()
    const [name, setName] = useState('')
    const [color, setColor] = useState('blue')
    const [isCreating, setIsCreating] = useState(false)

    const handleCreate = async () => {
        if (!name.trim() || !currentTeam?.id) return

        setIsCreating(true)
        try {
            const response = await fetch('/api/v1/boards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-team-id': currentTeam.id,
                },
                body: JSON.stringify({ name: name.trim(), color }),
            })

            if (response.ok) {
                const data = await response.json()
                setName('')
                setColor('blue')
                onOpenChange(false)
                onCreated()
                router.push(`/dashboard/boards/${data.data.id}`)
            }
        } catch (error) {
            console.error('Failed to create board:', error)
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create new board</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="board-name">Board name</Label>
                        <Input
                            id="board-name"
                            placeholder="My awesome board"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Color</Label>
                        <div className="flex gap-2">
                            {BOARD_COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => setColor(c.id)}
                                    className={cn(
                                        'w-8 h-8 rounded-lg transition-all',
                                        c.class,
                                        color === c.id
                                            ? 'ring-2 ring-offset-2 ring-primary scale-110'
                                            : 'hover:scale-105'
                                    )}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!name.trim() || isCreating}
                        >
                            {isCreating ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Create
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// Board Item with context menu
function BoardItem({
    board,
    isActive,
    onRefresh
}: {
    board: Board
    isActive: boolean
    onRefresh: () => void
}) {
    const { currentTeam } = useTeamContext()
    const colorClass = getColorClass(board.color)

    const handleDelete = async () => {
        if (!confirm('Delete this board? This cannot be undone.')) return

        try {
            await fetch(`/api/v1/boards/${board.id}`, {
                method: 'DELETE',
                headers: { 'x-team-id': currentTeam?.id || '' },
            })
            onRefresh()
        } catch (error) {
            console.error('Failed to delete board:', error)
        }
    }

    return (
        <div className="group relative">
            <Link
                href={`/dashboard/boards/${board.id}`}
                className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm',
                    isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
            >
                <div className={cn('w-3 h-3 rounded-sm shrink-0', colorClass)} />
                <span className="truncate flex-1">{board.name}</span>
            </Link>

            {/* Context menu on hover */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className={cn(
                            'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                            'hover:bg-muted text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem asChild>
                        <Link href={`/dashboard/boards/${board.id}/edit`}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={handleDelete}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

export function ProductivitySidebar() {
    const pathname = usePathname()
    const params = useParams()
    const router = useRouter()
    const { user, signOut } = useAuth()
    const { currentTeam, userTeams, switchTeam } = useTeamContext()
    const { canSwitch } = useTeamsConfig()

    const [boards, setBoards] = useState<Board[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)

    const currentBoardId = params?.id as string

    // Get current user's role in the active team
    const currentMembership = userTeams.find(m => m.team.id === currentTeam?.id)
    const userRole = currentMembership?.role || 'member'

    // Only owners and admins can create boards
    const canCreateBoard = userRole === 'owner' || userRole === 'admin'

    // Fetch boards
    const fetchBoards = useCallback(async () => {
        if (!currentTeam?.id) {
            setIsLoading(false)
            return
        }
        try {
            setIsLoading(true)
            const response = await fetch('/api/v1/boards?limit=100', {
                headers: {
                    'Content-Type': 'application/json',
                    'x-team-id': currentTeam.id
                }
            })
            if (response.ok) {
                const data = await response.json()
                setBoards(data.data || [])
            }
        } catch (error) {
            console.error('Failed to fetch boards:', error)
        } finally {
            setIsLoading(false)
        }
    }, [currentTeam?.id])

    useEffect(() => {
        fetchBoards()
    }, [fetchBoards])

    const getUserInitials = useCallback(() => {
        if (!user) return 'U'
        if (user.firstName && user.lastName) {
            return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
        }
        return user.email?.slice(0, 2).toUpperCase() || 'U'
    }, [user])

    const getTeamInitials = (name: string) => {
        return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    }

    const handleTeamSwitch = async (teamId: string) => {
        try {
            await switchTeam(teamId)
            router.push('/dashboard/boards')
        } catch (error) {
            console.error('Failed to switch team:', error)
        }
    }

    return (
        <>
            <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border z-50">
                {/* Team Header - Switcher only visible when canSwitch is true */}
                <div className="p-3 border-b border-sidebar-border">
                    {canSwitch ? (
                        // Full team switcher dropdown (multi-tenant/hybrid modes)
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left">
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                                        {currentTeam ? getTeamInitials(currentTeam.name) : 'T'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-sidebar-foreground truncate">
                                            {currentTeam?.name || 'Select Team'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {boards.length} board{boards.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    Switch Team
                                </div>
                                {userTeams.map((membership) => (
                                    <DropdownMenuItem
                                        key={membership.team.id}
                                        onClick={() => handleTeamSwitch(membership.team.id)}
                                        className="flex items-center gap-2"
                                    >
                                        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold">
                                            {getTeamInitials(membership.team.name)}
                                        </div>
                                        <span className="flex-1 truncate">{membership.team.name}</span>
                                        {currentTeam?.id === membership.team.id && (
                                            <Check className="w-4 h-4 text-primary" />
                                        )}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/settings/teams" className="flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Manage Teams
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        // Static team display (single-user/collaborative/single-tenant modes)
                        <div className="flex items-center gap-3 p-2">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                                {currentTeam ? getTeamInitials(currentTeam.name) : 'T'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-sidebar-foreground truncate">
                                    {currentTeam?.name || 'Workspace'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {boards.length} board{boards.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Boards Section */}
                <div className="flex-1 overflow-y-auto">
                    {/* Section Header */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Boards
                        </span>
                        {canCreateBoard && (
                            <button
                                onClick={() => setCreateDialogOpen(true)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Create board"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Boards List */}
                    <nav className="px-2 pb-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : boards.length === 0 ? (
                            <div className="text-center py-8 px-4">
                                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                                    <Kanban className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">
                                    {canCreateBoard ? 'No boards yet' : 'No boards available'}
                                </p>
                                {canCreateBoard && (
                                    <Button
                                        size="sm"
                                        onClick={() => setCreateDialogOpen(true)}
                                        className="gap-1"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create Board
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {boards.map((board) => (
                                    <BoardItem
                                        key={board.id}
                                        board={board}
                                        isActive={currentBoardId === board.id}
                                        onRefresh={fetchBoards}
                                    />
                                ))}
                            </div>
                        )}
                    </nav>
                </div>

                {/* Bottom Section */}
                <div className="border-t border-sidebar-border p-3 space-y-1">
                    {/* All Boards Link */}
                    <Link
                        href="/dashboard/boards"
                        className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm',
                            pathname === '/dashboard/boards'
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                        )}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        All Boards
                    </Link>

                    {/* Settings Link */}
                    <Link
                        href="/dashboard/settings"
                        className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm',
                            pathname.startsWith('/dashboard/settings')
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                        )}
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </Link>

                    {/* User */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors text-left">
                                {user?.image ? (
                                    <Image
                                        src={user.image}
                                        alt=""
                                        width={28}
                                        height={28}
                                        className="w-7 h-7 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                        {getUserInitials()}
                                    </div>
                                )}
                                <span className="flex-1 text-sm text-sidebar-foreground truncate">
                                    {user?.firstName || user?.email?.split('@')[0] || 'User'}
                                </span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/settings/profile">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Profile Settings
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => signOut()}
                                className="text-destructive focus:text-destructive"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Sign Out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </aside>

            {/* Create Board Dialog */}
            <CreateBoardDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onCreated={fetchBoards}
            />
        </>
    )
}

export default ProductivitySidebar
