CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  current_deploy_id TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sites_user ON sites(user_id);
CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  file_count INTEGER NOT NULL,
  total_bytes INTEGER NOT NULL,
  source TEXT
);
CREATE INDEX idx_dep_site ON deployments(site_id, created_at DESC);
CREATE TABLE reports (id TEXT PRIMARY KEY, slug TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL);
