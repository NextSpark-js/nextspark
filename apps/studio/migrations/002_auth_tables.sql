-- Better Auth standard tables (camelCase columns, matching core convention)

CREATE TABLE IF NOT EXISTS "user" (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  "emailVerified"   BOOLEAN DEFAULT FALSE,
  image             TEXT,
  role              TEXT NOT NULL DEFAULT 'user',
  "createdAt"       TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  id              TEXT PRIMARY KEY,
  token           TEXT NOT NULL UNIQUE,
  "expiresAt"     TIMESTAMPTZ NOT NULL,
  "ipAddress"     TEXT,
  "userAgent"     TEXT,
  "userId"        TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "account" (
  id              TEXT PRIMARY KEY,
  "accountId"     TEXT NOT NULL,
  "providerId"    TEXT NOT NULL,
  "userId"        TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  password        TEXT,
  "accessToken"   TEXT,
  "refreshToken"  TEXT,
  "idToken"       TEXT,
  "accessTokenExpiresAt"  TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  scope           TEXT,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
  id              TEXT PRIMARY KEY,
  identifier      TEXT NOT NULL,
  value           TEXT NOT NULL,
  "expiresAt"     TIMESTAMPTZ NOT NULL,
  "createdAt"     TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session"("userId");
CREATE INDEX IF NOT EXISTS idx_session_token ON "session"(token);
CREATE INDEX IF NOT EXISTS idx_account_user_id ON "account"("userId");
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
