-- Migration: Add account_status to profiles and update authorization helpers
-- Author: Ray & Gemini
-- Date: 2026-08-24

-- 1. Add account_status and audit columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'ACTIVE' 
    CONSTRAINT profiles_account_status_check CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'DISABLED')),
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_reason text;

-- 2. Update auth_role() helper to respect account_status
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND account_status = 'ACTIVE'
  LIMIT 1;
$$;

-- 3. Update auth_client_id() helper to respect account_status
CREATE OR REPLACE FUNCTION public.auth_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id 
  FROM public.profiles 
  WHERE id = auth.uid() 
    AND account_status = 'ACTIVE'
  LIMIT 1;
$$;

-- 4. Update trigger function to prevent self-privilege escalation & unprivileged account_status change
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role text;
BEGIN
  -- Get the role of the user performing the UPDATE
  SELECT role INTO current_user_role 
  FROM public.profiles 
  WHERE id = auth.uid();

  -- If sensitive columns are being modified and user is not admin/supervisor, block the update
  IF (
    (NEW.role IS DISTINCT FROM OLD.role) OR 
    (NEW.client_id IS DISTINCT FROM OLD.client_id) OR
    (NEW.account_status IS DISTINCT FROM OLD.account_status)
  ) THEN
    IF current_user_role NOT IN ('admin', 'supervisor') THEN
      RAISE EXCEPTION 'Access denied: Only admin and supervisor can update user role, client association, or account status.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create trigger if not exists
DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

