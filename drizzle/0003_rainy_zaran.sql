ALTER TABLE "orders" ALTER COLUMN "patient_dob" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "alt_email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "patient_age" text;