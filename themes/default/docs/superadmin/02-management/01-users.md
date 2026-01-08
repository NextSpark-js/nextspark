---
title: User Management
description: Managing users, teams, and roles in your NextSpark application.
---

# User Management

This guide covers managing users and teams in your NextSpark application.

## User Roles

### System Roles

| Role | Description |
|------|-------------|
| `superadmin` | Full system access, can manage all users and teams |
| `developer` | Access to developer tools and debugging features |
| `member` | Standard user role |

### Team Roles

| Role | Description |
|------|-------------|
| `owner` | Team creator, full team management |
| `admin` | Can manage team settings and members |
| `member` | Standard team member |
| `viewer` | Read-only access |

## Managing Users

### View All Users

Access the user management panel at `/superadmin/users`:

1. Navigate to Superadmin Dashboard
2. Click on "Users" in the sidebar
3. Use filters to search by name, email, or role

### Update User Role

1. Find the user in the list
2. Click on the user row to open details
3. Select new role from dropdown
4. Click "Save Changes"

### Deactivate User

1. Open user details
2. Click "Deactivate Account"
3. Confirm the action

## Managing Teams

### View All Teams

Access team management at `/superadmin/teams`:

- See all teams across the platform
- View team member counts
- Monitor team activity

### Team Impersonation

Superadmins can view the application as any team member:

1. Navigate to team details
2. Click "Impersonate" on a team member
3. You'll see the app from their perspective
4. Click "Exit Impersonation" when done

## Audit Logs

All administrative actions are logged. View logs at `/superadmin/logs`:

- User creation/deletion
- Role changes
- Team modifications
- Login attempts

## Next Steps

- [Configuration Guide](../01-setup/01-configuration.md)
- [Deployment Guide](../01-setup/02-deployment.md)
