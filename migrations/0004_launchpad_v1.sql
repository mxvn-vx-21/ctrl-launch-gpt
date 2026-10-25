-- Launchpad V1: slugs, categories, tags, votes, comments. Safe to run once on top of 0001-0003.
ALTER TABLE users ADD COLUMN website TEXT;
ALTER TABLE projects ADD COLUMN slug TEXT;
ALTER TABLE projects ADD COLUMN category TEXT NOT NULL DEFAULT 'other';
ALTER TABLE projects ADD COLUMN repo_url TEXT;
ALTER TABLE projects ADD COLUMN logo_url TEXT;
ALTER TABLE projects ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN vote_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN last_activity_at INTEGER;
UPDATE projects SET slug = 'p-' || substr(id, 1, 8), last_activity_at = created_at WHERE slug IS NULL;
CREATE UNIQUE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_activity ON projects(last_activity_at DESC);
CREATE INDEX idx_projects_votes ON projects(vote_count DESC);
CREATE INDEX idx_projects_category ON projects(category);
CREATE TABLE project_tags (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (project_id, tag)
);
CREATE INDEX idx_tags_tag ON project_tags(tag);
CREATE TABLE votes (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_recent ON votes(project_id, created_at);
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  edited_at INTEGER
);
CREATE INDEX idx_comments_project ON comments(project_id, created_at);
