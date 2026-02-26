CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  prompt      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'idle',
  project_slug TEXT,
  result      JSONB,
  messages    JSONB DEFAULT '[]'::jsonb,
  pages       JSONB DEFAULT '[]'::jsonb,
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_slug ON sessions(project_slug);
