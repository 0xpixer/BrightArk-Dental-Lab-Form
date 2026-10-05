CREATE TABLE "idesign_case_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"detail" text NOT NULL,
	"actor_id" integer,
	"actor_role" text NOT NULL,
	"actor_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idesign_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"case_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idesign_treatment_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"total_steps" integer NOT NULL,
	"default_duration_days" integer DEFAULT 10 NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"original_estimated_finish" date NOT NULL,
	"current_estimated_finish" date NOT NULL,
	"next_suggested_change" date,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idesign_treatment_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"review_url" text NOT NULL,
	"summary" text,
	"status" text DEFAULT 'published' NOT NULL,
	"created_by" integer,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idesign_treatment_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"step_number" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"suggested_start_date" date NOT NULL,
	"suggested_end_date" date NOT NULL,
	"actual_start_date" date,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"confirmed_by" integer,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "idesign_cases" ALTER COLUMN "gender" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "idesign_cases" ALTER COLUMN "date_of_birth" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "idesign_cases" ADD COLUMN "imported_order_id" integer;--> statement-breakpoint
ALTER TABLE "idesign_cases" ADD COLUMN "current_editable_url" text;--> statement-breakpoint
ALTER TABLE "idesign_cases" ADD COLUMN "plan_review_status" text DEFAULT 'no_plan' NOT NULL;--> statement-breakpoint
ALTER TABLE "idesign_case_activities" ADD CONSTRAINT "idesign_case_activities_case_id_idesign_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."idesign_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_case_activities" ADD CONSTRAINT "idesign_case_activities_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_notifications" ADD CONSTRAINT "idesign_notifications_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_notifications" ADD CONSTRAINT "idesign_notifications_case_id_idesign_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."idesign_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_treatment_courses" ADD CONSTRAINT "idesign_treatment_courses_case_id_idesign_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."idesign_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_treatment_courses" ADD CONSTRAINT "idesign_treatment_courses_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_treatment_plans" ADD CONSTRAINT "idesign_treatment_plans_case_id_idesign_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."idesign_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_treatment_plans" ADD CONSTRAINT "idesign_treatment_plans_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_treatment_plans" ADD CONSTRAINT "idesign_treatment_plans_approved_by_admin_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_treatment_steps" ADD CONSTRAINT "idesign_treatment_steps_course_id_idesign_treatment_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."idesign_treatment_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_treatment_steps" ADD CONSTRAINT "idesign_treatment_steps_confirmed_by_admin_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idesign_case_activities_case_created_idx" ON "idesign_case_activities" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idesign_notifications_dedupe_idx" ON "idesign_notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "idesign_notifications_user_created_idx" ON "idesign_notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idesign_treatment_courses_case_idx" ON "idesign_treatment_courses" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idesign_treatment_courses_reminder_idx" ON "idesign_treatment_courses" USING btree ("status","next_suggested_change");--> statement-breakpoint
CREATE UNIQUE INDEX "idesign_treatment_plans_case_version_idx" ON "idesign_treatment_plans" USING btree ("case_id","version_number");--> statement-breakpoint
CREATE INDEX "idesign_treatment_plans_case_published_idx" ON "idesign_treatment_plans" USING btree ("case_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idesign_treatment_steps_course_step_idx" ON "idesign_treatment_steps" USING btree ("course_id","step_number");--> statement-breakpoint
ALTER TABLE "idesign_cases" ADD CONSTRAINT "idesign_cases_imported_order_id_idesign_orders_id_fk" FOREIGN KEY ("imported_order_id") REFERENCES "public"."idesign_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "idesign_cases" (
	"imported_order_id", "order_no", "order_type", "patient_name", "latest_progress",
	"created_by", "doctor_account_id", "sales_account_id", "created_at", "updated_at"
)
SELECT
	"id", 'IMP-' || lpad("id"::text, 8, '0'), 'clear_aligner', "patient_name", "latest_progress",
	"created_by", "doctor_account_id", "sales_account_id", "created_at", "updated_at"
FROM "idesign_orders"
WHERE "category" = 'iAlign'
ON CONFLICT ("order_no") DO NOTHING;--> statement-breakpoint
CREATE UNIQUE INDEX "idesign_cases_imported_order_idx" ON "idesign_cases" USING btree ("imported_order_id");
