# Authentication Overview

NextSpark implements a comprehensive authentication system powered by Better Auth 1.7 (`better-auth` `~1.7.27` in `packages/core/package.json`), providing multiple authentication methods, session management, and secure API access for both internal and external clients.

## Technology Stack

### Core Authentication

- **Better Auth 1.7** (`~1.7.27`) - Modern authentication library with built-in security features
- **Better Auth OAuth provider plugins** (`@better-auth/oauth-provider`, `@better-auth/mcp`, `@better-auth/cimd`, `@better-auth/core`, all `~1.7.27`) - Make the app an OAuth 2.1 authorization server for its own MCP endpoint. Registered only when a project turns on MCP browser sign-in
- **PostgreSQL** - User data and session storage via Supabase
- **Resend** - Transactional email service for verification and password resets
- **Next.js Middleware** - Route protection and authentication checks

### Authentication Methods

- **Email one-time code (OTP)** - Passwordless sign-in with a 6-digit code sent by email; part of the default preset
- **Sign-in link (magic link)** - Passwordless sign-in with a single-use link sent by email (opt-in via `auth.methods`)
- **Google OAuth** - Social authentication with automatic profile mapping; part of the default preset
- **Email/Password** - Traditional authentication with email verification (opt-in via `auth.methods`)
- **API Keys** - Scope-based authentication for external API clients
- **OAuth access tokens for MCP clients** - Issued by the app itself to an MCP application the user approves; accepted at `/api/mcp` only (opt-in via `features.mcpOAuth`). See [MCP Browser Sign-in](./14-mcp-browser-sign-in.md)

The first four are ways a person signs in and gets a session. The last two are credentials a program presents.

The login methods a project offers are configured per theme with `auth.methods`
(default: the **passwordless preset** `['email-otp', 'google']` — no password
field). See [Passwordless Preset](./12-passwordless-preset.md).

## Dual Authentication Architecture

The web application and the REST API (`/api/v1`) implement two distinct authentication mechanisms working in
parallel: sessions and API keys. A third credential, the OAuth access token, exists for one endpoint only, the MCP
server, and only in a project that turns it on; it is described after the two.

### 1. Session-Based Authentication (Dashboard)

Used for the main web application and dashboard.

```text
User Login
    ↓
Better Auth validates credentials
    ↓
Session created in database
    ↓
Secure cookie issued (httpOnly, secure, sameSite: lax)
    ↓
Session validated on each request
    ↓
User flags loaded and attached to session
```

**Key Features:**
- 7-day session expiration (configurable per theme via `auth.session`)
- Automatic renewal every 24 hours (configurable; see Session Management for the PWA cookie-refresh path)
- 5-minute cookie cache for performance
- User flags integration
- Secure cookie configuration

### 2. API Key Authentication (External APIs)

Used for programmatic access to external APIs.

```text
API Request with Bearer token
    ↓
Extract and validate API key format
    ↓
Hash key and lookup in database (constant-time)
    ↓
Verify key status, expiration, and scopes
    ↓
Grant access based on scope permissions
```

**Key Features:**
- Scope-based permissions (e.g., `tasks:read`, `users:write`)
- Hashed storage for security
- Constant-time comparison to prevent timing attacks
- Per-key rate limiting (1000 charges per minute per key, one per REST request and two per generated MCP tool; shared between instances when Redis is configured)
- Optional expiration, and rotation support
- Not bound to a team: each request names its team

### 3. OAuth Access Tokens (MCP clients, opt-in)

Used by an MCP application, such as an AI assistant, that a user connects from the application's own interface.
Available only when the project sets `features: { mcpOAuth: true }`.

```text
MCP client calls /api/mcp with no credential
    ↓
401 with a challenge: where to sign in, which scopes to ask for
    ↓
User signs in, chooses a team, approves the permissions (consent)
    ↓
The app issues an access token (JWT, 10 minutes) and a rotating refresh token
    ↓
On every request: token verified, then user, team membership and consent read again
    ↓
Access granted for what the consent holds and the user's role allows
```

**Key Features:**
- The app is the OAuth 2.1 authorization server and the resource server
- Accepted at `/api/mcp` only, never at `/api/v1`
- One team per connection
- The user chooses the permissions; the server holds them to the user's role
- Listed, narrowed and ended in Settings > Security > Connected applications

This is different from **Google OAuth** below, where the app is the *client* of an external provider and the
result is a browser session. See [MCP Browser Sign-in](./14-mcp-browser-sign-in.md).

## Authentication Methods

### Email/Password Authentication

Traditional authentication with comprehensive security:

- **Minimum password length**: 8 characters
- **Maximum password length**: 128 characters
- **Email verification**: Required before access
- **Password reset**: Secure token-based flow (1-hour expiration)
- **Verification token**: 24-hour expiration

### Google OAuth

Social authentication with seamless profile mapping:

- **Profile mapping**: `given_name` → `firstName`, `family_name` → `lastName`
- **Email verification**: Automatically verified from Google
- **Avatar support**: Profile picture imported
- **Default role assignment**: `member` (configurable)
- **Default language**: System default locale

## Database Schema

### Core Tables

#### users Table

```sql
CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "emailVerified" BOOLEAN DEFAULT false,
  "name" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "image" TEXT,
  "language" TEXT DEFAULT 'en',
  "role" TEXT DEFAULT 'member',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Fields:**
- `firstName` / `lastName` - Separate name fields for better UX
- `language` - User's preferred language
- `role` - User role: `admin`, `colaborator`, `member`, `user`
- `emailVerified` - Verification status

#### session Table

```sql
CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMP NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Stores active user sessions with security metadata.

#### account Table

```sql
CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("providerId", "accountId")
);
```

**Purpose:** Links OAuth accounts and stores provider-specific tokens.

#### verification Table

```sql
CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Stores verification and password reset tokens.

#### api_key Table

```sql
CREATE TABLE "api_key" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "keyHash" TEXT NOT NULL UNIQUE,
  "keyPrefix" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastUsedAt" TIMESTAMP,
  "expiresAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Fields:**
- `keyHash` - Hashed API key (never store plaintext)
- `keyPrefix` - First 8 characters for identification
- `scopes` - Array of permission scopes
- `status` - `active`, `inactive`, or `expired`

## Integration with Entity System

The authentication system integrates deeply with the entity permission system:

### User Roles

Four hierarchical roles with increasing permissions:

| Role | Level | Description |
|------|-------|-------------|
| `user` | 1 | Basic access, limited permissions |
| `member` | 2 | Standard user, most features |
| `colaborator` | 3 | Extended access, content management |
| `admin` | 4 | Full system access |

### User Flags

Granular feature flags stored in `user_metas` table:

```typescript
type UserFlag = 
  | 'beta_tester'
  | 'early_adopter'
  | 'limited_access'
  | 'vip'
  | 'restricted'
  | 'experimental'
```

**Purpose:** Control access to specific entity features beyond role-based permissions.

### Permission Flow

```text
Request → Authenticate (Session or API Key; at /api/mcp, API Key or OAuth access token)
    ↓
Load user role + flags
    ↓
Check entity permissions
    ↓
Verify RLS policies
    ↓
Grant/Deny access
```

## Security Layers

### Layer 1: Application Authentication

- Better Auth validates credentials
- Session management with secure cookies
- API key validation with timing attack prevention
- OAuth access token verification at `/api/mcp` (signature, issuer, audience, expiry), when MCP browser sign-in is on

### Layer 2: Authorization

- Role-based access control (RBAC)
- Scope-based permissions for API keys and MCP connections
- User flags for granular control

### Layer 3: Database Row-Level Security (RLS)

- PostgreSQL RLS policies per table
- Automatic user data isolation
- Multi-tenant data protection

### Layer 4: Entity System Permissions

- Entity-level permission checks
- Operation-specific rules (read, create, update, delete)
- Integration with hooks for custom logic

## Authentication Flows

### Sign Up Flow

```text
1. User submits email, password, firstName, lastName
2. Better Auth creates user with additionalFields
3. Verification email sent via Resend
4. User clicks verification link
5. Email verified, access granted
```

### Sign In Flow

```text
1. User submits credentials
2. Better Auth validates against database
3. Session created and cookie issued
4. User flags loaded and attached to session
5. Redirect to dashboard
```

### Google OAuth Flow

```text
1. User clicks "Sign in with Google"
2. Redirected to Google consent screen
3. Google returns profile with given_name, family_name
4. Better Auth maps profile to user fields
5. Account created/linked
6. Session created with default role
```

### API Key Flow

```text
1. Request includes Authorization: Bearer {api_key}
2. Extract key and generate hash
3. Lookup in database (constant-time)
4. Verify status, expiration, and scopes
5. Grant access if valid
```

## Environment Variables

Required configuration:

```bash
# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=https://your-app.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (Resend)
RESEND_API_KEY=your-resend-api-key

# App Configuration
NEXT_PUBLIC_APP_NAME=Your App Name
NEXT_PUBLIC_APP_URL=https://your-app.com
```

## Performance Optimizations

### Cookie Cache

5-minute cookie cache reduces database queries:

```typescript
session: {
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5, // 5 minutes
  }
}
```

### Connection Pooling

PostgreSQL connection pool for Better Auth:

```typescript
const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
```

### Constant-Time Comparison

API key validation uses constant-time comparison to prevent timing attacks:

```typescript
async function validateApiKey(key: string) {
  const hash = await hashKey(key);
  // Constant-time lookup prevents timing attacks
  await constantTimeDelay(startTime);
  return dbLookup(hash);
}
```

## Use Cases

### Dashboard Authentication

- **Method**: Session-based with cookies
- **Duration**: 7 days with automatic renewal
- **Features**: User flags, role permissions, RLS

### Mobile App Authentication

- **Method**: Session-based with secure storage
- **Duration**: Same as dashboard
- **Features**: Full session support

### External API Access

- **Method**: API keys with scopes
- **Duration**: Configurable expiration
- **Features**: Rate limiting, scope permissions

### Third-Party Integrations

- **Method**: API keys with limited scopes
- **Duration**: Rotating keys recommended
- **Features**: Audit logging, revocation

### AI Assistants and Other MCP Clients

- **Method**: An API key, or MCP browser sign-in (OAuth 2.1) when the project turns it on
- **Duration**: A key does not expire by default; an OAuth access token lives 10 minutes and is renewed by the client
- **Features**: One team per connection, per-entity consent, connected applications, audit logging

## Next Steps

1. **[Better Auth Integration](./02-better-auth-integration.md)** - Detailed Better Auth configuration
2. **[OAuth Providers](./03-oauth-providers.md)** - Google, GitHub, Microsoft and Apple setup, and the provider map
3. **[API Key Management](./04-api-keys.md)** - API key system details
4. **[Session Management](./05-session-management.md)** - Session handling
5. **[Permissions and Roles](./06-permissions-and-roles.md)** - RBAC system
6. **[Security Best Practices](./07-security-best-practices.md)** - Security implementation
7. **[Testing Authentication](./08-testing-authentication.md)** - Testing strategies
8. **[Extensible Roles](./09-extensible-roles.md)** - Theme role extension system
9. **[MCP Browser Sign-in](./14-mcp-browser-sign-in.md)** - The app as an OAuth 2.1 authorization server for its MCP endpoint

---

> 💡 **Tip**: The authentication system is designed to work seamlessly with the entity system. User roles and flags automatically integrate with entity permissions for fine-grained access control.
