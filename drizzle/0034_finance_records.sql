CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD COLUMN "order_no" text;--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD COLUMN "invoice_file_url" text;--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD COLUMN "invoice_file_name" text;--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD COLUMN "payment_link" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "app_settings" ("key", "value") VALUES ('finance_overdue_days', '30') ON CONFLICT ("key") DO NOTHING;
