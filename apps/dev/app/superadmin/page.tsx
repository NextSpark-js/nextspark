import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@nextsparkjs/core/components/ui/card";
import { Button } from "@nextsparkjs/core/components/ui/button";
import { Users, BarChart3, Settings, Shield } from "lucide-react";
import Link from "next/link";
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import { sel } from "@nextsparkjs/core/lib/test"

/**
 * Superadmin Dashboard
 *
 * Main dashboard for superadmin area with quick access to all sections.
 */
function SuperadminDashboard() {
  const quickActions = [
    {
      title: "User Management",
      description: "View and manage all users and superadministrators",
      icon: Users,
      href: "/superadmin/users",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Analytics",
      description: "Platform statistics and usage metrics",
      icon: BarChart3,
      href: "/superadmin/analytics",
      color: "text-green-600",
      bgColor: "bg-green-100",
      disabled: true, // Future feature
    },
    {
      title: "System Config",
      description: "Application settings and configurations",
      icon: Settings,
      href: "/superadmin/config",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      disabled: true, // Future feature
    },
  ];

  return (
    <div className="space-y-6" data-cy={sel('superadmin.dashboard.container')}>
      {/* Header */}
      <div className="border-b pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-lg">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Super Admin Panel</h1>
            <p className="text-muted-foreground">
              Super Administrator Control Panel
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
          <Shield className="h-4 w-4 text-destructive" />
          <span className="text-destructive font-medium">
            Restricted Access Area - Superadmin Only
          </span>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quickActions.map((action) => {
          const IconComponent = action.icon;
          
          const CardWrapper = action.disabled ? 
            ({ children }: { children: React.ReactNode }) => (
              <Card className="opacity-60 cursor-not-allowed">
                {children}
              </Card>
            ) :
            ({ children }: { children: React.ReactNode }) => (
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <Link href={action.href} className="block">
                  {children}
                </Link>
              </Card>
            );

          return (
            <CardWrapper key={action.title}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${action.bgColor}`}>
                    <IconComponent className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {action.title}
                      {action.disabled && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                          Soon
                        </span>
                      )}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {action.description}
                </CardDescription>
                {!action.disabled && (
                  <Button variant="ghost" size="sm" className="mt-3 p-0 h-auto">
                    Access Section →
                  </Button>
                )}
              </CardContent>
            </CardWrapper>
          );
        })}
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Current platform overview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">Online</div>
              <div className="text-sm text-muted-foreground">System Status</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">v1.0.0</div>
              <div className="text-sm text-muted-foreground">Platform Version</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">Active</div>
              <div className="text-sm text-muted-foreground">Security Level</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default getTemplateOrDefault('app/superadmin/page.tsx', SuperadminDashboard)