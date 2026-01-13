"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nextsparkjs/core/components/ui/card";
import { Button } from "@nextsparkjs/core/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@nextsparkjs/core/components/ui/tabs";
import { Badge } from "@nextsparkjs/core/components/ui/badge";
import {
  ArrowLeft,
  Users,
  Users2,
  Shield,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { UsersTable } from "@nextsparkjs/core/components/users/tables/UsersTable";
import { SuperAdminsTable } from "@nextsparkjs/core/components/users/tables/SuperAdminsTable";
import { useSession } from "@nextsparkjs/core/lib/auth-client";
import type { User } from "@nextsparkjs/core/types/user.types";
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-registry.client";
import {
  SearchInput,
  PaginationControls,
  FilterDropdown,
} from "@nextsparkjs/core/components/superadmin/filters";
import { sel } from "@nextsparkjs/core/selectors";

interface UsersData {
  regularUsers: User[];
  superadmins: User[];
  counts: {
    total: number;
    regularUsers: number;
    superadmins: number;
    workTeams: number;
    byRole: Record<string, number>;
    statusDistribution: Record<string, number>;
    teamRoleDistribution: Record<string, number>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  filters: {
    search: string;
    role: string;
    status: string;
    tab: string;
  };
  metadata: {
    requestedBy: string;
    requestedAt: string;
    source: string;
  };
}

const roleOptions = [
  { value: "member", label: "Member" },
  { value: "colaborator", label: "Colaborator" },
  { value: "admin", label: "Admin" },
];

const statusOptions = [
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Unverified" },
];

/**
 * Users Management Page
 *
 * Comprehensive user management interface for superadmins.
 * Displays regular users and superadmins with search, filters, and pagination.
 */
function UsersPage() {
  const [activeTab, setActiveTab] = useState<"users" | "superadmins">("users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { data: session } = useSession();

  // Build query params
  const getQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter && roleFilter !== "__all__") params.set("role", roleFilter);
    if (statusFilter && statusFilter !== "__all__") params.set("status", statusFilter);
    params.set("tab", activeTab);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [search, roleFilter, statusFilter, activeTab, page, limit]);

  // Fetch users data from API
  const {
    data: rawUsersData,
    isLoading,
    error,
    refetch,
  } = useQuery<UsersData>({
    queryKey: ["superadmin-users", search, roleFilter, statusFilter, activeTab, page, limit],
    queryFn: async () => {
      const queryString = getQueryParams();
      const response = await fetch(`/api/superadmin/users?${queryString}`);
      if (!response.ok) {
        throw new Error("Failed to fetch users data");
      }
      return response.json();
    },
    retry: 2,
    staleTime: 30000,
  });

  // Transform users data to add fullName property
  const usersData = rawUsersData
    ? {
        ...rawUsersData,
        regularUsers: rawUsersData.regularUsers.map((user) => ({
          ...user,
          fullName:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            "No name",
        })),
        superadmins: rawUsersData.superadmins.map((user) => ({
          ...user,
          fullName:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            "No name",
        })),
      }
    : undefined;

  // Handle tab change - reset page
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as "users" | "superadmins");
    setPage(1);
  };

  // Handle search change - reset page
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // Handle filter change - reset page
  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value === "__all__" ? "" : value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value === "__all__" ? "" : value);
    setPage(1);
  };

  // Handle limit change - reset page
  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const hasActiveFilters = search || roleFilter || statusFilter;

  // Loading state
  if (isLoading && !usersData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Super Admin
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              User Management
            </h1>
            <p className="text-muted-foreground">Loading user data...</p>
          </div>
        </div>

        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/superadmin" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Super Admin
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              User Management
            </h1>
            <p className="text-muted-foreground">Error loading data</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error Loading Users
            </CardTitle>
            <CardDescription>
              {error instanceof Error
                ? error.message
                : "Failed to load user data"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-cy={sel('superadmin.users.container')}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/superadmin" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Super Admin
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage all users and superadministrators
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usersData?.counts.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">All registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Work Teams</CardTitle>
            <Users2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {usersData?.counts.workTeams || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Collaborative work teams
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Superadmins</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {usersData?.counts.superadmins || 0}
            </div>
            <p className="text-xs text-muted-foreground">System administrators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distribution</CardTitle>
            <Badge variant="outline">
              {Object.keys(usersData?.counts.byRole || {}).length} roles
            </Badge>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="status" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-7">
                <TabsTrigger value="status" className="text-xs">
                  Status
                </TabsTrigger>
                <TabsTrigger value="role" className="text-xs">
                  Role
                </TabsTrigger>
              </TabsList>
              <TabsContent value="status" className="mt-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Verified:</span>
                    <span className="font-medium text-green-600">
                      {usersData?.counts.statusDistribution?.verified || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Unverified:</span>
                    <span className="font-medium text-yellow-600">
                      {usersData?.counts.statusDistribution?.unverified || 0}
                    </span>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="role" className="mt-2">
                <div className="space-y-1">
                  {Object.entries(usersData?.counts.teamRoleDistribution || {}).map(
                    ([role, count]) => (
                      <div key={role} className="flex justify-between text-xs">
                        <span className="capitalize">{role}:</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    )
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name or email..."
          className="w-full max-w-sm"
          data-cy={sel('superadmin.users.filters.search')}
        />

        {activeTab === "users" && (
          <FilterDropdown
            value={roleFilter || "__all__"}
            onChange={handleRoleFilterChange}
            options={roleOptions}
            label="Role"
            allLabel="All Roles"
            showIcon={false}
            data-cy="users-role-filter"
          />
        )}

        <FilterDropdown
          value={statusFilter || "__all__"}
          onChange={handleStatusFilterChange}
          options={statusOptions}
          label="Status"
          allLabel="All Status"
          showIcon={false}
          data-cy="users-status-filter"
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            data-cy="clear-filters-btn"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Tabs Section */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Regular Users ({usersData?.counts.regularUsers || 0})
          </TabsTrigger>
          <TabsTrigger value="superadmins" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Superadmins ({usersData?.counts.superadmins || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Regular Users</CardTitle>
              <CardDescription>
                All users excluding superadministrators. Includes members,
                colaborators, and admins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsersTable
                users={usersData?.regularUsers || []}
                isLoading={isLoading}
                onRefresh={() => refetch()}
              />
              {usersData?.pagination && (
                <PaginationControls
                  page={usersData.pagination.page}
                  totalPages={usersData.pagination.totalPages}
                  total={usersData.pagination.total}
                  limit={usersData.pagination.limit}
                  onPageChange={setPage}
                  onLimitChange={handleLimitChange}
                  context="users"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="superadmins" className="space-y-4">
          <Card className="border-red-200">
            <CardHeader className="bg-red-50">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <Shield className="h-5 w-5" />
                Superadministrators
              </CardTitle>
              <CardDescription>
                Users with full system access and administrative privileges.
                Handle with extreme caution.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <SuperAdminsTable
                superadmins={usersData?.superadmins || []}
                isLoading={isLoading}
                currentUserId={session?.user?.id}
              />
              {usersData?.pagination && (
                <div className="p-4 border-t">
                  <PaginationControls
                    page={usersData.pagination.page}
                    totalPages={usersData.pagination.totalPages}
                    total={usersData.pagination.total}
                    limit={usersData.pagination.limit}
                    onPageChange={setPage}
                    onLimitChange={handleLimitChange}
                    context="users"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Metadata Footer */}
      {usersData?.metadata && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Last updated:{" "}
                {new Date(usersData.metadata.requestedAt).toLocaleString()}
              </p>
              <p>Requested by: {usersData.metadata.requestedBy}</p>
              <p>Source: {usersData.metadata.source}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default getTemplateOrDefaultClient("app/superadmin/users/page.tsx", UsersPage);
