ALTER TABLE "admin_users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "clinic_name" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "linked_doctor_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "submitted_by" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_submitted_by_admin_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_email_unique" UNIQUE("email");