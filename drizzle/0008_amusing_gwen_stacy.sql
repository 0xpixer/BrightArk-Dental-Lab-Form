CREATE TABLE "doctor_clinics" (
	"id" serial PRIMARY KEY NOT NULL,
	"doctor_id" integer NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_address" text;--> statement-breakpoint
ALTER TABLE "doctor_clinics" ADD CONSTRAINT "doctor_clinics_doctor_id_admin_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "doctor_clinics" ("doctor_id", "name", "address")
SELECT
  "id",
  COALESCE(NULLIF(TRIM("clinic_name"), ''), 'Primary Clinic'),
  COALESCE("address", '')
FROM "admin_users"
WHERE "role" = 'doctor';
