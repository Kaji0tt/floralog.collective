-- Create project issue management table for in-app bug/task intake via Home bug button

CREATE TABLE IF NOT EXISTS public."ProjectIssue" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_display_name text,
  reporter_email text,
  source text NOT NULL DEFAULT 'home-header-bug-report',
  source_path text,
  category text NOT NULL CHECK (category IN (
    'leaderboards',
    'quests',
    'achievements',
    'collections',
    'map',
    'friends',
    'infrastructure',
    'customization',
    'display',
    'login',
    'story',
    'presentation'
  )),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started',
    'acknowledged',
    'planned',
    'in_progress',
    'completed'
  )),
  priority smallint NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  iteration_code text,
  target_date date,
  admin_note text,
  is_archived boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  last_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projectissue_reporter_auth_id
  ON public."ProjectIssue" (reporter_auth_id);

CREATE INDEX IF NOT EXISTS idx_projectissue_status
  ON public."ProjectIssue" (status);

CREATE INDEX IF NOT EXISTS idx_projectissue_category
  ON public."ProjectIssue" (category);

CREATE INDEX IF NOT EXISTS idx_projectissue_created_at
  ON public."ProjectIssue" (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at_project_issue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_project_issue ON public."ProjectIssue";
CREATE TRIGGER trg_set_updated_at_project_issue
BEFORE UPDATE ON public."ProjectIssue"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_project_issue();

ALTER TABLE public."ProjectIssue" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projectissue_select_own_or_admin" ON public."ProjectIssue";
CREATE POLICY "projectissue_select_own_or_admin"
  ON public."ProjectIssue"
  FOR SELECT
  TO authenticated
  USING (
    reporter_auth_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public."PublicProfile" pp
      WHERE pp.auth_id = auth.uid() AND pp.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "projectissue_insert_own" ON public."ProjectIssue";
CREATE POLICY "projectissue_insert_own"
  ON public."ProjectIssue"
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_auth_id = auth.uid());

DROP POLICY IF EXISTS "projectissue_admin_update" ON public."ProjectIssue";
CREATE POLICY "projectissue_admin_update"
  ON public."ProjectIssue"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."PublicProfile" pp
      WHERE pp.auth_id = auth.uid() AND pp.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."PublicProfile" pp
      WHERE pp.auth_id = auth.uid() AND pp.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "projectissue_admin_delete" ON public."ProjectIssue";
CREATE POLICY "projectissue_admin_delete"
  ON public."ProjectIssue"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."PublicProfile" pp
      WHERE pp.auth_id = auth.uid() AND pp.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
