-- 1) Create schema (if not already created)
CREATE SCHEMA IF NOT EXISTS moderation_cases_clone;

-- 2) Create sequence for id (bigint) in cloned schema
CREATE SEQUENCE IF NOT EXISTS moderation_cases_clone.moderation_cases_2_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- 3) Create table in cloned schema
CREATE TABLE IF NOT EXISTS moderation_cases_clone.moderation_cases_2 (
  id bigint NOT NULL DEFAULT nextval('moderation_cases_clone.moderation_cases_2_id_seq'::regclass),
  target_user text NOT NULL,
  action text NOT NULL,
  reason text NOT NULL DEFAULT 'No reason provided',
  actioned_by text NOT NULL,
  duration_ms bigint NULL,
  formatted_duration text NULL,
  points_delta smallint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderation_cases_2_pkey PRIMARY KEY (id)
);

-- 4) Indexes to speed lookups / aggregations
CREATE INDEX IF NOT EXISTS idx_moderation_cases_2_target_user ON moderation_cases_clone.moderation_cases_2 (target_user);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_2_actioned_by ON moderation_cases_clone.moderation_cases_2 (actioned_by);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_2_points_delta_notnull ON moderation_cases_clone.moderation_cases_2 (target_user)
  WHERE points_delta IS NOT NULL;

-- 5) Enable Row Level Security (kept consistent with earlier clone)
ALTER TABLE moderation_cases_clone.moderation_cases_2 ENABLE ROW LEVEL SECURITY;

-- 6) Helper function: sum points for a target_user (operates on cloned table)
CREATE OR REPLACE FUNCTION moderation_cases_clone.sum_points_for_user(_target_user text)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(points_delta), 0)::bigint
  FROM moderation_cases_clone.moderation_cases_2
  WHERE target_user = _target_user;
$$;

-- 7) Grants (optional; mirrors your example)
GRANT SELECT, INSERT, UPDATE, DELETE ON moderation_cases_clone.moderation_cases_2 TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE moderation_cases_clone.moderation_cases_2_id_seq TO authenticated;