-- Better Auth standard tables (snake_case convention)

CREATE TABLE IF NOT EXISTS "user" (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  image         TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  id            TEXT PRIMARY KEY,
  token         TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "account" (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL,
  provider_id   TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  password      TEXT,
  access_token  TEXT,
  refresh_token TEXT,
  id_token      TEXT,
  expires_at    TIMESTAMPTZ,
  scope         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
  id            TEXT PRIMARY KEY,
  identifier    TEXT NOT NULL,
  value         TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session"(user_id);
CREATE INDEX IF NOT EXISTS idx_session_token ON "session"(token);
CREATE INDEX IF NOT EXISTS idx_account_user_id ON "account"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
