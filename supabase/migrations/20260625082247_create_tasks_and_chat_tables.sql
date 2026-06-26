/*
# Initial Schema for Smart AI Schedule Builder

1. New Tables
- `tasks` — stores all user tasks with scheduling metadata.
  - `id` (uuid, primary key)
  - `title` (text, not null)
  - `duration` (int, minutes)
  - `priority` (text: High/Medium/Low)
  - `energy_level` (text: High Energy/Focus/Casual)
  - `start_time` (int, minutes from midnight, nullable)
  - `completed` (boolean, default false)
  - `date` (text, ISO date YYYY-MM-DD)
  - `project_id` (text, nullable)
  - `created_at` (timestamptz, default now)

- `chat_messages` — stores Jerald chat history.
  - `id` (uuid, primary key)
  - `role` (text: user/assistant)
  - `content` (text, not null)
  - `timestamp` (timestamptz, default now)
  - `tasks` (jsonb, nullable — stores injected task objects)

- `user_settings` — stores app-wide user preferences.
  - `id` (uuid, primary key)
  - `theme` (text: light/dark, default dark)
  - `energy_level` (text: High/Medium/Low, default Medium)
  - `active_date` (text, ISO date, default today)
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Security
- Enable RLS on all three tables.
- Single-tenant app (no auth required), so policies allow anon + authenticated CRUD.
*/

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  duration int NOT NULL DEFAULT 30,
  priority text NOT NULL DEFAULT 'Medium',
  energy_level text NOT NULL DEFAULT 'Focus',
  start_time int,
  completed boolean NOT NULL DEFAULT false,
  date text NOT NULL,
  project_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  content text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  tasks jsonb
);

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme text NOT NULL DEFAULT 'dark',
  energy_level text NOT NULL DEFAULT 'Medium',
  active_date text NOT NULL DEFAULT (to_char(now(), 'YYYY-MM-DD')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Tasks policies (single-tenant, public)
DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE TO anon, authenticated USING (true);

-- Chat messages policies
DROP POLICY IF EXISTS "anon_select_chat" ON chat_messages;
CREATE POLICY "anon_select_chat" ON chat_messages FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_chat" ON chat_messages;
CREATE POLICY "anon_insert_chat" ON chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_chat" ON chat_messages;
CREATE POLICY "anon_update_chat" ON chat_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_chat" ON chat_messages;
CREATE POLICY "anon_delete_chat" ON chat_messages FOR DELETE TO anon, authenticated USING (true);

-- User settings policies
DROP POLICY IF EXISTS "anon_select_settings" ON user_settings;
CREATE POLICY "anon_select_settings" ON user_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON user_settings;
CREATE POLICY "anon_insert_settings" ON user_settings FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON user_settings;
CREATE POLICY "anon_update_settings" ON user_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_settings" ON user_settings;
CREATE POLICY "anon_delete_settings" ON user_settings FOR DELETE TO anon, authenticated USING (true);
