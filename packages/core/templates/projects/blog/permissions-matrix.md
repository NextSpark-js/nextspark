# Blog Theme - Permissions Matrix

## Teams Mode: `single-user`

No teams functionality. Single user owns all content.

## Roles

| Role | Description |
|------|-------------|
| owner | Blog owner - full control |

> Note: In `single-user` mode, only owner role exists. No team invitations.

---

## Entity Permissions

### Posts

| Action | owner |
|--------|-------|
| create | ✅ |
| read | ✅ |
| list | ✅ |
| update | ✅ |
| delete | ✅ |
| publish | ✅ |
| archive | ✅ |

---

## Theme Features

| Feature | owner | Description |
|---------|-------|-------------|
| `posts.export_json` | ✅ | Export posts to JSON format |
| `posts.import_json` | ✅ | Import posts from JSON format |

---

## Disabled Core Permissions

- `teams.invite` - No invitations in single-user mode
- `teams.remove_member` - N/A
- `teams.change_roles` - N/A
- `teams.delete` - N/A
- `settings.billing` - No billing
- `settings.api_keys` - No API keys

---

## Test Scenarios

### Owner (only user)

1. ✅ Can create, edit, delete posts
2. ✅ Can publish/unpublish posts
3. ✅ Can export posts to JSON
4. ✅ Can import posts from JSON
5. ✅ Cannot invite other users
6. ✅ No team switcher visible

