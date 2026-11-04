UPDATE "idesign_orders"
SET "latest_progress" = 'Awaiting Approval'
WHERE "latest_progress" = 'Awaiting Clin. Review';
--> statement-breakpoint
UPDATE "idesign_orders"
SET "latest_progress" = 'Approved'
WHERE "latest_progress" = 'Clin. Review Approved';
--> statement-breakpoint
UPDATE "idesign_cases"
SET "latest_progress" = 'Awaiting Approval'
WHERE "latest_progress" = 'Awaiting Clin. Review';
--> statement-breakpoint
UPDATE "idesign_cases"
SET "latest_progress" = 'Approved'
WHERE "latest_progress" = 'Clin. Review Approved';
