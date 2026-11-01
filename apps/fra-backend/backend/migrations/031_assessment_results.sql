-- The result of an assessment, frozen when it is submitted: overall score, risk level,
-- score per area, top risks and the register view, with the scoring method's version.
-- Results shown later (results page, reports, dashboards, evidence pack) read this, so a
-- change to the scoring method never rewrites a result already given. Assessments
-- submitted before this migration get theirs from `npm run migrate` (backfill step).
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS result JSONB;
