-- Issue #171 — reconcile production quotation schema with current main.
--
-- This policy was applied from obsolete PR #162 but was never merged into
-- main. Removing it closes the internal-creator update path before the
-- approved Issue #165 quotation transition architecture is applied.

begin;

drop policy if exists case_quotations_internal_creator_reject
  on public.case_quotations;

commit;
