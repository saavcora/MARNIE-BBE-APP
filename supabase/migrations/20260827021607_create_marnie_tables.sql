/*
# Create Marnie settings and activity log tables

## Purpose
Marnie is a voice-powered dog assistant that helps kids with homework.
Parents configure settings (daily time limit, allowed topics, content filter,
blocked words) and the app logs each child-AI interaction for parental review.

This is a single-tenant app with no sign-in, so data is intentionally shared
and policies allow anon + authenticated CRUD.

## New Tables

### marnie_settings
- `id` (int, primary key, always 1 — singleton row)
- `daily_limit` (int, minutes per day, default 45)
- `allowed_topics` (jsonb, map of topic-id → boolean, default all true)
- `strict_filter` (boolean, strict content filter for young kids, default true)
- `blocked_words` (text[], list of blocked words/topics, default empty)
- `updated_at` (timestamptz, last modification time)

### marnie_activity
- `id` (uuid, primary key)
- `question` (text, the child's question)
- `answer` (text, Marnie's response)
- `topic` (text, categorized topic id, nullable)
- `created_at` (timestamptz, when the interaction happened)

## Security
- RLS enabled on both tables.
- Both tables allow full CRUD for anon + authenticated (single-tenant, no auth).
*/

CREATE TABLE IF NOT EXISTS marnie_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_limit integer NOT NULL DEFAULT 45,
  allowed_topics jsonb NOT NULL DEFAULT '{"espacio":true,"animales":true,"arte":true,"musica":true,"deportes":true}'::jsonb,
  strict_filter boolean NOT NULL DEFAULT true,
  blocked_words text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row if it doesn't exist
INSERT INTO marnie_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE marnie_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON marnie_settings;
CREATE POLICY "anon_select_settings" ON marnie_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON marnie_settings;
CREATE POLICY "anon_insert_settings" ON marnie_settings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON marnie_settings;
CREATE POLICY "anon_update_settings" ON marnie_settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_settings" ON marnie_settings;
CREATE POLICY "anon_delete_settings" ON marnie_settings
  FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS marnie_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  topic text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marnie_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_activity" ON marnie_activity;
CREATE POLICY "anon_select_activity" ON marnie_activity
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_activity" ON marnie_activity;
CREATE POLICY "anon_insert_activity" ON marnie_activity
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_activity" ON marnie_activity;
CREATE POLICY "anon_update_activity" ON marnie_activity
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_activity" ON marnie_activity;
CREATE POLICY "anon_delete_activity" ON marnie_activity
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_marnie_activity_created_at
  ON marnie_activity (created_at DESC);