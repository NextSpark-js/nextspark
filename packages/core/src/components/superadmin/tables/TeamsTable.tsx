"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sel } from '../../../lib/test';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback } from '../../ui/avatar';
import {
  MoreHorizontal,
  Users,
  Calendar,
  Eye,
  Users2,
} from "lucide-react";

interface TeamOwner {
  id: string;
  name: string;
  email: string;
}

interface Team {
  id: string;
  name: string;
  owner: TeamOwner;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TeamsTableProps {
  teams: Team[];
  isLoading?: boolean;
}

/**
 * Teams Table Component
 *
 * Displays all teams in a comprehensive table format for superadmins.
 * Includes team type badges, owner info, member counts, and actions.
 */
export function TeamsTable({ teams, isLoading }: TeamsTableProps) {
  const router = useRouter();

  // Navigate to team detail
  const handleRowClick = (teamId: string) => {
    router.push(`/superadmin/teams/${teamId}`);
  };

  // Generate team initials for avatar
  const getTeamInitials = (name: string) => {
    const words = name.split(" ");
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4">
            <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
              <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
            </div>
            <div className="w-20 h-6 bg-muted rounded animate-pulse" />
            <div className="w-8 h-8 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-8">
        <Users2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">No teams found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          There are no teams matching your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border" data-cy={sel('superadmin.teams.table')}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team) => (
              <TableRow
                key={team.id}
                data-cy={sel('superadmin.teams.row', { id: team.id })}
                className="cursor-pointer hover:bg-muted/50"
                style={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(team.id)}
              >
                {/* Team Info */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getTeamInitials(team.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{team.name}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {team.id.slice(0, 12)}...
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Owner */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {team.owner.name?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{team.owner.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {team.owner.email}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Member Count */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{team.memberCount}</span>
                    <span className="text-muted-foreground text-sm">
                      {team.memberCount === 1 ? "member" : "members"}
                    </span>
                  </div>
                </TableCell>

                {/* Created Date */}
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {team.createdAt
                      ? format(new Date(team.createdAt), "MMM dd, yyyy")
                      : "Unknown"}
                  </div>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        data-cy={sel('superadmin.teams.actionsButton', { id: team.id })}
                      >
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={`/superadmin/teams/${team.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
