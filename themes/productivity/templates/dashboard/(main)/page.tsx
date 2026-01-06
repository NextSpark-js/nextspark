/**
 * Productivity Dashboard Page
 * Shows board metrics and statistics
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { useUserProfile } from '@nextsparkjs/core/hooks/useUserProfile'
import { cn } from '@nextsparkjs/core/lib/utils'
import { Button } from '@nextsparkjs/core/components/ui/button'
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
    CheckCircle2,
    Clock,
    AlertCircle,
    Plus,
    Loader2,
    Kanban,
    ListTodo,
    TrendingUp,
    Users,
    ChevronRight,
    Sparkles
} from 'lucide-react'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'

interface Board {
    id: string
    name: string
    color: string
    createdAt: string
}

interface List {
    id: string
    name: string
    boardId: string
}

interface Card {
    id: string
    title: string
    listId: string
    boardId: string
    createdAt: string
}

interface DashboardStats {
    totalBoards: number
    totalCards: number
    totalLists: number
    todoCards: number
    inProgressCards: number
    doneCards: number
    recentBoards: Board[]
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

export default function ProductivityDashboard() {
    const { user, isLoading: userLoading } = useUserProfile()
    const { currentTeam } = useTeamContext()
    const router = useRouter()

    const [stats, setStats] = useState<DashboardStats>({
        totalBoards: 0,
        totalCards: 0,
        totalLists: 0,
        todoCards: 0,
        inProgressCards: 0,
        doneCards: 0,
        recentBoards: []
    })
    const [isLoading, setIsLoading] = useState(true)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [newBoardName, setNewBoardName] = useState('')
    const [newBoardColor, setNewBoardColor] = useState('blue')
    const [isCreating, setIsCreating] = useState(false)

    // Helper function to classify list by name into status categories
    const classifyListStatus = (listName: string): 'todo' | 'inProgress' | 'done' | 'other' => {
        const name = listName.toLowerCase()

        // Done/Completed indicators
        if (name.includes('done') || name.includes('complete') || name.includes('finished') ||
            name.includes('closed') || name.includes('resolved') || name.includes('shipped')) {
            return 'done'
        }

        // In Progress indicators
        if (name.includes('progress') || name.includes('doing') || name.includes('working') ||
            name.includes('active') || name.includes('in review') || name.includes('testing') ||
            name.includes('development') || name.includes('building')) {
            return 'inProgress'
        }

        // To Do indicators
        if (name.includes('todo') || name.includes('to do') || name.includes('to-do') ||
            name.includes('backlog') || name.includes('planned') || name.includes('pending') ||
            name.includes('new') || name.includes('open') || name.includes('inbox')) {
            return 'todo'
        }

        // Default to todo for unclassified
        return 'todo'
    }

    // Fetch dashboard statistics
    const fetchStats = useCallback(async () => {
        if (!currentTeam?.id) {
            setIsLoading(false)
            return
        }

        try {
            setIsLoading(true)

            // Fetch boards
            const boardsResponse = await fetch('/api/v1/boards?limit=100', {
                headers: {
                    'Content-Type': 'application/json',
                    'x-team-id': currentTeam.id
                }
            })

            let boards: Board[] = []
            if (boardsResponse.ok) {
                const boardsData = await boardsResponse.json()
                boards = boardsData.data || []
            }

            // Fetch all lists
            const listsResponse = await fetch('/api/v1/lists?limit=500', {
                headers: {
                    'Content-Type': 'application/json',
                    'x-team-id': currentTeam.id
                }
            })

            let allLists: List[] = []
            if (listsResponse.ok) {
                const listsData = await listsResponse.json()
                allLists = listsData.data || []
            }

            // Create a map of listId -> status
            const listStatusMap = new Map<string, 'todo' | 'inProgress' | 'done' | 'other'>()
            allLists.forEach(list => {
                listStatusMap.set(list.id, classifyListStatus(list.name))
            })

            // Fetch all cards
            const cardsResponse = await fetch('/api/v1/cards?limit=1000', {
                headers: {
                    'Content-Type': 'application/json',
                    'x-team-id': currentTeam.id
                }
            })

            let allCards: Card[] = []
            if (cardsResponse.ok) {
                const cardsData = await cardsResponse.json()
                allCards = cardsData.data || []
            }

            // Calculate stats based on list status
            let todoCards = 0
            let inProgressCards = 0
            let doneCards = 0

            allCards.forEach(card => {
                const status = listStatusMap.get(card.listId) || 'todo'
                if (status === 'todo' || status === 'other') {
                    todoCards++
                } else if (status === 'inProgress') {
                    inProgressCards++
                } else if (status === 'done') {
                    doneCards++
                }
            })

            setStats({
                totalBoards: boards.length,
                totalCards: allCards.length,
                totalLists: allLists.length,
                todoCards,
                inProgressCards,
                doneCards,
                recentBoards: boards.slice(0, 5)
            })
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error)
        } finally {
            setIsLoading(false)
        }
    }, [currentTeam?.id])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

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
                router.push(`/dashboard/boards/${data.data.id}`)
            }
        } catch (error) {
            console.error('Failed to create board:', error)
        } finally {
            setIsCreating(false)
        }
    }

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 18) return 'Good afternoon'
        return 'Good evening'
    }

    if (userLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const completionRate = stats.totalCards > 0
        ? Math.round((stats.doneCards / stats.totalCards) * 100)
        : 0

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
                <div className="px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">
                                {getGreeting()}, {user?.firstName || 'there'}!
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Here's what's happening with your boards
                            </p>
                        </div>
                        <PermissionGate permission="boards.create">
                            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                                <Plus className="w-4 h-4" />
                                New Board
                            </Button>
                        </PermissionGate>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Boards */}
                    <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <LayoutGrid className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-foreground">{stats.totalBoards}</p>
                                <p className="text-sm text-muted-foreground">Total Boards</p>
                            </div>
                        </div>
                    </div>

                    {/* Total Cards */}
                    <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <ListTodo className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-foreground">{stats.totalCards}</p>
                                <p className="text-sm text-muted-foreground">Total Cards</p>
                            </div>
                        </div>
                    </div>

                    {/* In Progress */}
                    <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-foreground">{stats.inProgressCards}</p>
                                <p className="text-sm text-muted-foreground">In Progress</p>
                            </div>
                        </div>
                    </div>

                    {/* Completed */}
                    <div className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-green-500" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-foreground">{stats.doneCards}</p>
                                <p className="text-sm text-muted-foreground">Completed</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress Overview */}
                <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Progress Overview</h2>
                            <p className="text-sm text-muted-foreground">Card completion across all boards</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            <span className="text-2xl font-bold text-foreground">{completionRate}%</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                        {stats.totalCards > 0 ? (
                            <>
                                <div
                                    className="h-full bg-green-500 transition-all duration-500"
                                    style={{ width: `${(stats.doneCards / stats.totalCards) * 100}%` }}
                                />
                                <div
                                    className="h-full bg-amber-500 transition-all duration-500"
                                    style={{ width: `${(stats.inProgressCards / stats.totalCards) * 100}%` }}
                                />
                                <div
                                    className="h-full bg-slate-300 transition-all duration-500"
                                    style={{ width: `${(stats.todoCards / stats.totalCards) * 100}%` }}
                                />
                            </>
                        ) : (
                            <div className="h-full bg-muted w-full" />
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-sm text-muted-foreground">Done ({stats.doneCards})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-sm text-muted-foreground">In Progress ({stats.inProgressCards})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-300" />
                            <span className="text-sm text-muted-foreground">To Do ({stats.todoCards})</span>
                        </div>
                    </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Recent Boards */}
                    <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-foreground">Recent Boards</h2>
                            <Link
                                href="/dashboard/boards"
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                                View all
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {stats.recentBoards.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                                    <Kanban className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <p className="text-muted-foreground mb-4">No boards yet</p>
                                <PermissionGate permission="boards.create">
                                    <Button
                                        variant="outline"
                                        onClick={() => setCreateDialogOpen(true)}
                                        className="gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create your first board
                                    </Button>
                                </PermissionGate>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {stats.recentBoards.map((board) => (
                                    <Link
                                        key={board.id}
                                        href={`/dashboard/boards/${board.id}`}
                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                                    >
                                        <div className={cn('w-4 h-4 rounded', getColorClass(board.color))} />
                                        <span className="flex-1 font-medium text-foreground group-hover:text-primary transition-colors">
                                            {board.name}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>

                        <div className="space-y-3">
                            <PermissionGate permission="boards.create">
                                <button
                                    onClick={() => setCreateDialogOpen(true)}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors text-left group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <Plus className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">Create New Board</p>
                                        <p className="text-sm text-muted-foreground">Start organizing your tasks</p>
                                    </div>
                                </button>
                            </PermissionGate>

                            <Link
                                href="/dashboard/boards"
                                className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-500/5 hover:bg-blue-500/10 transition-colors text-left group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                    <LayoutGrid className="w-6 h-6 text-blue-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">View All Boards</p>
                                    <p className="text-sm text-muted-foreground">Browse your {stats.totalBoards} boards</p>
                                </div>
                            </Link>

                            <Link
                                href="/dashboard/settings/teams"
                                className="w-full flex items-center gap-4 p-4 rounded-xl bg-purple-500/5 hover:bg-purple-500/10 transition-colors text-left group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                    <Users className="w-6 h-6 text-purple-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">Manage Team</p>
                                    <p className="text-sm text-muted-foreground">Invite members and set permissions</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Tips Card */}
                {stats.totalBoards === 0 && (
                    <PermissionGate permission="boards.create">
                        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary/20">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                                    <Sparkles className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground mb-1">Getting Started</h3>
                                    <p className="text-muted-foreground text-sm mb-4">
                                        Create your first board to start organizing your tasks. Boards help you
                                        visualize your workflow with columns like "To Do", "In Progress", and "Done".
                                    </p>
                                    <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                                        <Plus className="w-4 h-4" />
                                        Create Your First Board
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </PermissionGate>
                )}
            </div>

            {/* Create Board Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
        </div>
    )
}
