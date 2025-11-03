-- ============================================
-- SECURITY FIX: Corrected RLS policies (FINAL)
-- ============================================

-- 1. Assets - Drop ALL existing policies first
DROP POLICY IF EXISTS "Service can insert assets" ON assets;
DROP POLICY IF EXISTS "Users can view own brand assets" ON assets;
DROP POLICY IF EXISTS "Users can view own assets" ON assets;
DROP POLICY IF EXISTS "Admins can view all assets" ON assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON assets;
DROP POLICY IF EXISTS "Users can update own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON assets;
DROP POLICY IF EXISTS "Users can update own brand assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own brand assets" ON assets;

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_select_own_brand"
ON assets FOR SELECT
TO authenticated
USING (
  brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  )
);

CREATE POLICY "assets_select_admin"
ON assets FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "assets_insert_service"
ON assets FOR INSERT
TO service_role
WITH CHECK (true);

-- 2. Deliverable - Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own deliverables" ON deliverable;
DROP POLICY IF EXISTS "Admins can view all deliverables" ON deliverable;
DROP POLICY IF EXISTS "Service role can insert deliverables" ON deliverable;
DROP POLICY IF EXISTS "Users can update own deliverables" ON deliverable;
DROP POLICY IF EXISTS "Users can delete own deliverables" ON deliverable;
DROP POLICY IF EXISTS "Users can insert own deliverables" ON deliverable;

ALTER TABLE deliverable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliverable_select_own_brand"
ON deliverable FOR SELECT
TO authenticated
USING (
  brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  )
);

CREATE POLICY "deliverable_select_admin"
ON deliverable FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "deliverable_insert_service"
ON deliverable FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "deliverable_update_own_brand"
ON deliverable FOR UPDATE
TO authenticated
USING (
  brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  )
);

CREATE POLICY "deliverable_delete_own_brand"
ON deliverable FOR DELETE
TO authenticated
USING (
  brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  )
);

-- 3. Chat sessions - Drop ALL existing policies
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Admins can view all chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can manage own sessions" ON chat_sessions;

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_all_own"
ON chat_sessions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_sessions_select_admin"
ON chat_sessions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));