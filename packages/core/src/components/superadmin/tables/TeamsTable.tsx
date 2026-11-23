"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatLocaleDate } from '../../../lib/i18n/format';
import { sel } from '../../../lib/test';
import { useCommonText } from '../../../lib/i18n/common-text';
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
import { Badge } from '../../ui/badge';
import { SortableHead, type SortState } from '../../users/tables/SortableHead';
import { CopyIdButton } from '../../users/tables/CopyIdButton';
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
  /** The team's newest subscription; null when it has none */
  plan?: { name: string | null; slug: string | null; status: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

/** The columns the teams list sorts by (the server sorts) */
export type TeamSortKey = 'name' | 'members' | 'createdAt';

interface TeamsTableProps {
  teams: Team[];
  isLoading?: boolean;
  /** With both, the team, members and created headers sort the list */
  sort?: SortState<TeamSortKey>;
  onSortChange?: (sort: SortState<TeamSortKey>) => void;
}

/**
 * Teams Table Component
 *
 * Displays all teams in a comprehensive table format for superadmins.
 * Includes team type badges, owner info, member counts, and actions.
 */
export function TeamsTable({ teams, isLoading, sort, onSortChange }: TeamsTableProps) {
  const openMenuText = useCommonText('a11y', 'openMenu', 'Open menu');
  const t = useTranslations('superadmin.teamsTable');
  // the plan's status, in the words of the Subscriptions page
  const tStatus = useTranslations('superadmin.subscriptions');
  const locale = useLocale();
  const router = useRouter();

  // Navigate to team detail
  const handleRowClick = (teamId: string) => {
    router.push(`/superadmin/teams/${teamId}`);
  };

  // A header that sorts when the page passes the sort state, a plain one otherwise
  const sortHead = (key: TeamSortKey, label: string, firstOrder: 'asc' | 'desc' = 'asc') =>
    sort && onSortChange
      ? <SortableHead label={label} sortKey={key} sort={sort} onSort={onSortChange} firstOrder={firstOrder} />
      : <TableHead>{label}</TableHead>;

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
        <h3 className="mt-4 text-lg font-medium">{t('empty.title')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('empty.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border" data-cy={sel('superadmin.teams.table.element')}>
      <Table>
        <TableHeader>
          <TableRow>
            {sortHead('name', t('columns.team'))}
            <TableHead>{t('columns.owner')}</TableHead>
            {sortHead('members', t('columns.members'), 'desc')}
            <TableHead>{t('columns.plan')}</TableHead>
            {sortHead('createdAt', t('columns.created'), 'desc')}
            <TableHead className="text-right">{t('columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team) => (
              <TableRow
                key={team.id}
                data-cy={sel('superadmin.teams.table.row', { id: team.id })}
                className="group cursor-pointer hover:bg-muted/50"
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
                      <div className="font-medium">
                        <Link href={`/superadmin/teams/${team.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                          {team.name}
                        </Link>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        {t('id', { id: `${team.id.slice(0, 12)}...` })}
                        <CopyIdButton id={team.id} />
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
                      <div className="text-sm font-medium">
                        <Link href={`/superadmin/users/${team.owner.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                          {team.owner.name}
                        </Link>
                      </div>
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
                      {t('memberWord', { count: team.memberCount })}
                    </span>
                  </div>
                </TableCell>

                {/* Plan: the newest subscription's, with its status when it is not active */}
                <TableCell>
                  {team.plan ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{team.plan.name || team.plan.slug}</Badge>
                      {team.plan.status && team.plan.status !== 'active' && (
                        <span className="text-xs text-muted-foreground">{tStatus.has(`statuses.${team.plan.status}`) ? tStatus(`statuses.${team.plan.status}`) : team.plan.status}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t('noPlan')}</span>
                  )}
                </TableCell>

                {/* Created Date */}
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {team.createdAt
                      ? formatLocaleDate(team.createdAt, locale)
                      : t('unknown')}
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
                        data-cy={sel('superadmin.teams.table.menuButton', { id: team.id })}
                      >
                        <span className="sr-only">{openMenuText}</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{t('columns.actions')}</DropdownMenuLabel>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link href={`/superadmin/teams/${team.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          {t('viewDetails')}
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
