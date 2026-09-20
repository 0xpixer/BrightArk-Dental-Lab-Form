CREATE TABLE "idesign_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" text NOT NULL,
	"order_type" text DEFAULT 'clear_aligner' NOT NULL,
	"patient_name" text NOT NULL,
	"gender" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"file_urls" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dentition_stage" text,
	"extraction_teeth" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"locked_teeth" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachment_restricted_teeth" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ipr_restricted_teeth" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reserve_space_teeth" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"maxillary_midline" text,
	"mandibular_midline" text,
	"left_relationship" text,
	"right_relationship" text,
	"posterior_expansion_not_allowed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ipr_not_allowed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"molar_distalization_not_allowed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"remarks" text,
	"latest_progress" text DEFAULT 'Entering Info' NOT NULL,
	"created_by" integer,
	"doctor_account_id" integer,
	"sales_account_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idesign_cases_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
ALTER TABLE "idesign_cases" ADD CONSTRAINT "idesign_cases_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_cases" ADD CONSTRAINT "idesign_cases_doctor_account_id_admin_users_id_fk" FOREIGN KEY ("doctor_account_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_cases" ADD CONSTRAINT "idesign_cases_sales_account_id_admin_users_id_fk" FOREIGN KEY ("sales_account_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idesign_cases_doctor_account_idx" ON "idesign_cases" USING btree ("doctor_account_id");--> statement-breakpoint
CREATE INDEX "idesign_cases_sales_account_idx" ON "idesign_cases" USING btree ("sales_account_id");--> statement-breakpoint
CREATE INDEX "idesign_cases_created_at_idx" ON "idesign_cases" USING btree ("created_at");