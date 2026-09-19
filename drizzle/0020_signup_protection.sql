CREATE TABLE "pending_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"clinic_name" text NOT NULL,
	"address" text NOT NULL,
	"phone" text,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signup_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "pending_registrations_expires_idx" ON "pending_registrations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "signup_rate_limits_expires_idx" ON "signup_rate_limits" USING btree ("expires_at");