-- Migration: Add UPDATE RLS policy for login_history
-- Purpose: Allow authenticated users to update location/enrichment data on their own login_history records

CREATE POLICY "login_history_own_update" ON public.login_history
    FOR UPDATE
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());
