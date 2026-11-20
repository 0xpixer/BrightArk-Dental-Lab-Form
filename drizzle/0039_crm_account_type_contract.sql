ALTER TABLE "crm_doctors" ADD COLUMN "account_type" text;--> statement-breakpoint
ALTER TABLE "crm_doctors" ADD COLUMN "contract_url" text;--> statement-breakpoint
ALTER TABLE "crm_doctors" ADD COLUMN "contract_file_name" text;--> statement-breakpoint
ALTER TABLE "crm_doctors" ADD COLUMN "contract_uploaded_at" timestamp with time zone;--> statement-breakpoint
-- Back-fill the new single Tag from the old free-form tags (first match wins, case-insensitive).
UPDATE "crm_doctors" SET "account_type" = CASE
  WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text("tags") t WHERE lower(t) IN ('non-ka', 'non ka', 'nonka')) THEN 'Non-KA'
  WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text("tags") t WHERE lower(t) = 'ka') THEN 'KA'
  WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text("tags") t WHERE lower(t) = 'oem') THEN 'OEM'
  WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text("tags") t WHERE lower(t) = 'distributor') THEN 'Distributor'
END
WHERE "account_type" IS NULL AND jsonb_typeof("tags") = 'array' AND jsonb_array_length("tags") > 0;
