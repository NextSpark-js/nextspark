"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Users2,
  BarChart3,
  Settings,
  Shield,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from "lucide-react";
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { sel } from '../../../lib/test';
import { useState } from "react";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  disabled?: boolean;
  selectorKey?: 'dashboard' | 'users' | 'teams' | 'teamRoles' | 'subscriptions' | 'analytics' | 'config';
}

/**
 * Superadmin Sidebar Component
 *
 * Specialized sidebar for super admin navigation within Superadmin Panel.
 * Includes collapsible functionality and clear visual hierarchy.
 */
export function SuperadminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sidebarItems: SidebarItem[] = [
    {
      title: "Dashboard",
      href: "/superadmin",
      icon: LayoutDashboard,
      description: "Main control panel overview",
      selectorKey: "dashboard"
    },
    {
      title: "Users",
      href: "/superadmin/users",
      icon: Users,
      description: "Manage all users and superadmins",
      selectorKey: "users"
    },
    {
      title: "Teams",
      href: "/superadmin/teams",
      icon: Users2,
      description: "View all teams and members",
      selectorKey: "teams"
    },
    {
      title: "Team Roles",
      href: "/superadmin/team-roles",
      icon: Shield,
      description: "View roles & permissions matrix",
      selectorKey: "teamRoles"
    },
    {
      title: "Subscriptions",
      href: "/superadmin/subscriptions",
      icon: CreditCard,
      description: "Billing and subscription management",
      selectorKey: "subscriptions"
    },
    {
      title: "Analytics",
      href: "/superadmin/analytics",
      icon: BarChart3,
      description: "Platform statistics",
      disabled: true,
      selectorKey: "analytics"
    },
    {
      title: "System Config",
      href: "/superadmin/config",
      icon: Settings,
      description: "Application settings",
      disabled: true,
      selectorKey: "config"
    },
  ];

  return (
    <div className={cn(
      "flex flex-col h-screen bg-card border-r border-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-600">Super Admin</h2>
              <p className="text-xs text-muted-foreground">System Panel</p>
            </div>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="ml-auto"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 p-3 space-y-2">
        {sidebarItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = pathname === item.href;
          
          if (item.disabled) {
            return (
              <div
                key={item.title}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground cursor-not-allowed opacity-60",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? `${item.title} (Coming Soon)` : item.description}
              >
                <IconComponent className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        Soon
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.title}
              href={item.href}
              data-cy={item.selectorKey ? sel(`superadmin.navigation.${item.selectorKey}`) : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? item.title : item.description}
            >
              <IconComponent className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && (
                <div className="flex-1">
                  <div className="text-sm font-medium">{item.title}</div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Exit Section */}
      <div className="p-3 border-t border-border">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
            "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? "Exit Super Admin" : "Return to main dashboard"}
          aria-label="Exit Super Admin and return to main dashboard"
          data-cy={sel('superadmin.navigation.exitToDashboard')}
        >
          <ArrowLeft className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && (
            <div className="flex-1">
              <div className="text-sm font-medium">Exit Super Admin</div>
              <p className="text-xs text-muted-foreground">Return to dashboard</p>
            </div>
          )}
        </Link>

        {/* Security Notice */}
        {!isCollapsed && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <Shield className="h-3 w-3" />
              <span className="text-xs font-medium">Restricted Area</span>
            </div>
            <p className="text-xs text-red-600 mt-1">
              Superadmin access only
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
