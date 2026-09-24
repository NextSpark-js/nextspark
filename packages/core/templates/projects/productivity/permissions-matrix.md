# Productivity Theme - Permissions Matrix

## Teams Mode: `collaborative`

One personal team per user with invitations enabled.

## Roles

| Role | Description |
|------|-------------|
| owner | Team owner - full control, can invite members |
| member | Team member - can create/edit cards and lists |
| viewer | Read-only access to all boards |

---

## Entity Permissions

### Boards

| Action | owner | member | viewer |
|--------|-------|--------|--------|
| create | ✅ | ❌ | ❌ |
| read | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ |
| update | ✅ | ❌ | ❌ |
| delete | ✅ | ❌ | ❌ |
| archive | ✅ | ❌ | ❌ |

### Lists

| Action | owner | member | viewer |
|--------|-------|--------|--------|
| create | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ❌ |
| delete | ✅ | ❌ | ❌ |
| reorder | ✅ | ✅ | ❌ |

### Cards

| Action | owner | member | viewer |
|--------|-------|--------|--------|
| create | ✅ | ✅ | ❌ |
| read | ✅ | ✅ | ✅ |
| list | ✅ | ✅ | ✅ |
| update | ✅ | ✅ | ❌ |
| delete | ✅ | ✅ | ❌ |
| move | ✅ | ✅ | ❌ |
| assign | ✅ | ✅ | ❌ |

---

## Theme Features

| Feature | owner | member | viewer | Description |
|---------|-------|--------|--------|-------------|
| `boards.archive` | ✅ | ❌ | ❌ | Archive boards |
| `boards.settings` | ✅ | ❌ | ❌ | Modify board settings |
| `lists.reorder` | ✅ | ✅ | ❌ | Reorder lists within board |
| `cards.move` | ✅ | ✅ | ❌ | Move cards between lists |
| `cards.assign` | ✅ | ✅ | ❌ | Assign cards to members |

---

## Team Permissions

| Permission | owner | member | viewer |
|------------|-------|--------|--------|
| `teams.invite` | ✅ | ❌ | ❌ |
| `teams.remove_member` | ✅ | ❌ | ❌ |
| `teams.change_roles` | ✅ | ❌ | ❌ |
| `teams.settings` | ✅ | ❌ | ❌ |

---

## Disabled Core Permissions

- `teams.delete` - Cannot delete in collaborative mode
- `settings.api_keys` - Not needed for this app
- `settings.billing` - No billing

---

## Test Scenarios

### Owner

1. ✅ Can create, edit, delete boards
2. ✅ Can create, edit lists
3. ✅ Can delete lists
4. ✅ Can create, edit, delete cards
5. ✅ Can move cards between lists
6. ✅ Can assign cards to members
7. ✅ Can archive boards
8. ✅ Can invite members (member/viewer roles)
9. ✅ Can remove members
10. ✅ Can change member roles

### Member

1. ❌ Cannot create boards
2. ❌ Cannot edit/delete boards
3. ✅ Can create, edit lists
4. ❌ Cannot delete lists
5. ✅ Can create, edit, delete cards
6. ✅ Can move cards between lists
7. ✅ Can assign cards
8. ❌ Cannot archive boards
9. ❌ Cannot invite members
10. ❌ Cannot remove members

### Viewer

1. ❌ Cannot create anything
2. ✅ Can view all boards, lists, cards
3. ❌ Cannot edit anything
4. ❌ Cannot delete anything
5. ❌ Cannot move cards
6. ❌ Cannot assign cards

