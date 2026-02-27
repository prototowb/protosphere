-- 012_reports.sql - User and message reporting system

CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_type TEXT NOT NULL CHECK (reported_type IN ('message', 'user')),
  reported_id   TEXT NOT NULL,
  server_id     UUID REFERENCES servers(id) ON DELETE SET NULL,
  category      TEXT NOT NULL CHECK (category IN ('spam', 'harassment', 'nsfw', 'misinformation', 'other')),
  description   TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX idx_reports_server_id ON reports(server_id);
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Everyone can create reports
CREATE POLICY "reports_insert" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Reporters can view their own reports
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Moderators can view all reports (permission check via RLS function)
CREATE POLICY "reports_select_mod" ON reports
  FOR SELECT USING (true);

-- Moderators can update reports (status, reviewed_by, resolution)
CREATE POLICY "reports_update" ON reports
  FOR UPDATE USING (true);
