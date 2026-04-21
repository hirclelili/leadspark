CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title         TEXT NOT NULL,
  due_date      DATE NOT NULL,
  note          TEXT,
  completed_at  TIMESTAMPTZ,
  quotation_id  UUID REFERENCES quotations(id) ON DELETE SET NULL,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own tasks" ON follow_up_tasks;
CREATE POLICY "Users can manage own tasks" ON follow_up_tasks FOR ALL USING (auth.uid() = user_id);
