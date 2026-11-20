CREATE TABLE "aligner_production" (
	"case_id" integer PRIMARY KEY NOT NULL,
	"total_stages" integer,
	"delivered_batch" integer,
	"batch_delivered_on" date,
	"notified_batch" integer,
	"notified_at" timestamp with time zone,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aligner_production" ADD CONSTRAINT "aligner_production_case_id_idesign_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."idesign_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aligner_production" ADD CONSTRAINT "aligner_production_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;