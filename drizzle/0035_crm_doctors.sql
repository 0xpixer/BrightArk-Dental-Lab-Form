CREATE TABLE "crm_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"crm_doctor_id" integer NOT NULL,
	"author_id" integer,
	"kind" text DEFAULT 'note' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_doctors" (
	"id" serial PRIMARY KEY NOT NULL,
	"sales_id" integer NOT NULL,
	"doctor_account_id" integer,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"clinic_name" text,
	"country" text,
	"city" text,
	"address" text,
	"specialty" text,
	"status" text DEFAULT 'lead' NOT NULL,
	"source" text DEFAULT 'sales' NOT NULL,
	"next_follow_up" date,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_crm_doctor_id_crm_doctors_id_fk" FOREIGN KEY ("crm_doctor_id") REFERENCES "public"."crm_doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_author_id_admin_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_doctors" ADD CONSTRAINT "crm_doctors_sales_id_admin_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_doctors" ADD CONSTRAINT "crm_doctors_doctor_account_id_admin_users_id_fk" FOREIGN KEY ("doctor_account_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_doctors" ADD CONSTRAINT "crm_doctors_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_activities_doctor_idx" ON "crm_activities" USING btree ("crm_doctor_id","created_at");--> statement-breakpoint
CREATE INDEX "crm_doctors_sales_idx" ON "crm_doctors" USING btree ("sales_id");--> statement-breakpoint
CREATE INDEX "crm_doctors_account_idx" ON "crm_doctors" USING btree ("doctor_account_id");--> statement-breakpoint
CREATE INDEX "crm_doctors_follow_up_idx" ON "crm_doctors" USING btree ("next_follow_up");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_doctors_sales_account_unique" ON "crm_doctors" USING btree ("sales_id","doctor_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_doctors_sales_email_unique" ON "crm_doctors" USING btree ("sales_id",lower("email"));