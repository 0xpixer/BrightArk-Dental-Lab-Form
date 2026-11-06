ALTER TABLE "idesign_treatment_plans" ADD COLUMN "editable_url" text;

UPDATE "idesign_treatment_plans" AS "plan"
SET "editable_url" = "case"."current_editable_url"
FROM "idesign_cases" AS "case"
WHERE "plan"."case_id" = "case"."id"
  AND "plan"."editable_url" IS NULL
  AND "case"."current_editable_url" IS NOT NULL
  AND "plan"."version_number" = (
    SELECT MAX("latest_plan"."version_number")
    FROM "idesign_treatment_plans" AS "latest_plan"
    WHERE "latest_plan"."case_id" = "plan"."case_id"
  );
