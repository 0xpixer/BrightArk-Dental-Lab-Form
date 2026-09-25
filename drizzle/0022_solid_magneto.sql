CREATE TABLE "pending_password_resets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "password_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pending_password_resets" ADD CONSTRAINT "pending_password_resets_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_password_resets_user_idx" ON "pending_password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pending_password_resets_expires_idx" ON "pending_password_resets" USING btree ("expires_at");