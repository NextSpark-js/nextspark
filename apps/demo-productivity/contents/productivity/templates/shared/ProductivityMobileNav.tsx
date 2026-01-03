/**
 * Productivity Mobile Navigation
 * Bottom navigation bar for mobile with boards sheet
 */

'use client'

import Link from 'next/link'
import { usePathname, useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@nextsparkjs/core/lib/utils'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { useTeamsConfig } from '@nextsparkjs/core/hooks/useTeamsConfig'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@nextsparkjs/core/components/ui/sheet'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@nextsparkjs/core/components/ui/dialog'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Label } from '@nextsparkjs/core/components/ui/label'
import {
    LayoutGrid,
    Plus,
    Settings,
    Users,
    Loader2,
    Kanban,
    Check,
    ChevronRight
} from 'lucide-react'

interface Board {
    id: string
    name: string
    color: string
}

// Board colors
const BOARD_COLORS = [
    { id: 'blue', class: 'bg-[var(--board-blue)]' },
    { id: 'green', class: 'bg-[var(--board-green)]' },
    { id: 'purple', class: 'bg-[var(--board-purple)]' },
    { id: 'orange', class: 'bg-[var(--board-orange)]' },
    { id: 'red', class: 'bg-[var(--board-red)]' },
    { id: 'pink', class: 'bg-[var(--board-pink)]' },
    { id: 'gray', class: 'bg-[var(--board-gray)]' },
]

const getColorClass = (color: string) => {
    return BOARD_COLORS.find(c => c.id === color)?.class || BOARD_COLORS[0].class
}

export function ProductivityMobileNav() {
    const pathname = usePathname()
    const params = useParams()
    const router = useRouter()
    const { currentTeam, userTeams, switchTeam } = useTeamContext()
    const { canSwitch } = useTeamsConfig()

    const [boards, setBoards] = useState<Board[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [boardsSheetOpen, setBoardsSheetOpen] = useState(false)
    const [teamsSheetOpen, setTeamsSheetOpen] = useState(false)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [newBoardName, setNewBoardName] = useState('')
    const [newBoardColor, setNewBoardColor] = useState('blue')
    const [isCreating, setIsCreating] = useState(false)

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

    const handleCreateBoard = async () => {
        if (!newBoardName.trim() || !currentTeam?.id) return

        setIsCreating(true)
        try {
            const response = await fetch('/api/v1/boards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-team-id': currentTeam.id,
                },
                body: JSON.stringify({ name: newBoardName.trim(), color: newBoardColor }),
            })

            if (response.ok) {
                const data = await response.json()
                setNewBoardName('')
                setNewBoardColor('blue')
                setCreateDialogOpen(false)
                setBoardsSheetOpen(false)
                fetchBoards()
                router.push(`/dashboard/boards/${data.data.id}`)
            }
        } catch (error) {
            console.error('Failed to create board:', error)
        } finally {
            setIsCreating(false)
        }
    }

    const handleTeamSwitch = async (teamId: string) => {
        try {
            await switchTeam(teamId)
            setTeamsSheetOpen(false)
            router.push('/dashboard/boards')
        } catch (error) {
            console.error('Failed to switch team:', error)
        }
    }

    const getTeamInitials = (name: string) => {
        return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    }

    const isActive = (path: string) => {
        if (path === '/dashboard/boards') {
            return pathname.startsWith('/dashboard/boards')
        }
        return pathname === path || pathname.startsWith(path + '/')
    }

    return (
        <>
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom">
                <div className="flex items-center justify-around h-16 px-2">
                    {/* Boards Sheet */}
                    <Sheet open={boardsSheetOpen} onOpenChange={setBoardsSheetOpen}>
                        <SheetTrigger asChild>
                            <button
                                className={cn(
                                    'flex flex-col items-center gap-0.5 py-1 px-4 rounded-lg transition-colors',
                                    isActive('/dashboard/boards')
                                        ? 'text-primary'
                                        : 'text-muted-foreground'
                                )}
                            >
                                <LayoutGrid className="w-5 h-5" />
                                <span className="text-[10px] font-medium">Boards</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
                            <SheetHeader className="pb-4">
                                <SheetTitle className="flex items-center justify-between">
                                    <span>Your Boards</span>
                                    {canCreateBoard && (
                                        <Button
                                            size="sm"
                                            onClick={() => setCreateDialogOpen(true)}
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            New
                                        </Button>
                                    )}
                                </SheetTitle>
                            </SheetHeader>

                            <div className="overflow-y-auto flex-1 -mx-6 px-6">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : boards.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                                            <Kanban className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                        <p className="text-muted-foreground mb-4">
                                            {canCreateBoard ? 'No boards yet' : 'No boards available'}
                                        </p>
                                        {canCreateBoard && (
                                            <Button onClick={() => setCreateDialogOpen(true)}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Create Board
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {boards.map((board) => {
                                            const colorClass = getColorClass(board.color)
                                            const isCurrent = currentBoardId === board.id

                                            return (
                                                <Link
                                                    key={board.id}
                                                    href={`/dashboard/boards/${board.id}`}
                                                    onClick={() => setBoardsSheetOpen(false)}
                                                    className={cn(
                                                        'flex items-center gap-3 p-3 rounded-xl transition-all',
                                                        isCurrent
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'hover:bg-muted'
                                                    )}
                                                >
                                                    <div className={cn('w-4 h-4 rounded', colorClass)} />
                                                    <span className="flex-1 font-medium">{board.name}</span>
                                                    {isCurrent && <Check className="w-4 h-4" />}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* View All Link */}
                                {boards.length > 0 && (
                                    <div className="mt-4 pt-4 border-t">
                                        <Link
                                            href="/dashboard/boards"
                                            onClick={() => setBoardsSheetOpen(false)}
                                            className="flex items-center justify-between p-3 rounded-xl hover:bg-muted text-muted-foreground"
                                        >
                                            <span>View All Boards</span>
                                            <ChevronRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>

                    {/* Create Button - Only shown for users with create permission */}
                    {canCreateBoard ? (
                        <button
                            onClick={() => setCreateDialogOpen(true)}
                            className="flex items-center justify-center w-14 h-14 -mt-6 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
                        >
                            <Plus className="w-7 h-7" />
                        </button>
                    ) : (
                        <div className="w-14" /> // Spacer to maintain layout
                    )}

                    {/* Teams Sheet - Only visible when canSwitch is true (multi-tenant/hybrid modes) */}
                    {canSwitch ? (
                        <Sheet open={teamsSheetOpen} onOpenChange={setTeamsSheetOpen}>
                            <SheetTrigger asChild>
                                <button
                                    className="flex flex-col items-center gap-0.5 py-1 px-4 rounded-lg transition-colors text-muted-foreground"
                                >
                                    <Users className="w-5 h-5" />
                                    <span className="text-[10px] font-medium">Teams</span>
                                </button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="rounded-t-2xl">
                                <SheetHeader className="pb-4">
                                    <SheetTitle>Switch Team</SheetTitle>
                                </SheetHeader>

                                <div className="space-y-1">
                                    {userTeams.map((membership) => (
                                        <button
                                            key={membership.team.id}
                                            onClick={() => handleTeamSwitch(membership.team.id)}
                                            className={cn(
                                                'w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left',
                                                currentTeam?.id === membership.team.id
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'hover:bg-muted'
                                            )}
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">
                                                {getTeamInitials(membership.team.name)}
                                            </div>
                                            <span className="flex-1 font-medium">{membership.team.name}</span>
                                            {currentTeam?.id === membership.team.id && (
                                                <Check className="w-5 h-5" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t">
                                    <Link
                                        href="/dashboard/settings/teams"
                                        onClick={() => setTeamsSheetOpen(false)}
                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-muted text-muted-foreground"
                                    >
                                        <span>Manage Teams</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </SheetContent>
                        </Sheet>
                    ) : (
                        // Settings link when team switching is disabled (single-user/collaborative/single-tenant)
                        <Link
                            href="/dashboard/settings"
                            className={cn(
                                'flex flex-col items-center gap-0.5 py-1 px-4 rounded-lg transition-colors',
                                pathname.startsWith('/dashboard/settings')
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            )}
                        >
                            <Settings className="w-5 h-5" />
                            <span className="text-[10px] font-medium">Settings</span>
                        </Link>
                    )}
                </div>
            </nav>

            {/* Create Board Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create new board</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="mobile-board-name">Board name</Label>
                            <Input
                                id="mobile-board-name"
                                placeholder="My awesome board"
                                value={newBoardName}
                                onChange={(e) => setNewBoardName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                                {BOARD_COLORS.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setNewBoardColor(c.id)}
                                        className={cn(
                                            'w-9 h-9 rounded-lg transition-all',
                                            c.class,
                                            newBoardColor === c.id
                                                ? 'ring-2 ring-offset-2 ring-primary scale-110'
                                                : 'hover:scale-105'
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setCreateDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleCreateBoard}
                                disabled={!newBoardName.trim() || isCreating}
                            >
                                {isCreating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    'Create'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default ProductivityMobileNav
