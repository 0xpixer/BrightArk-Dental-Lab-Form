CREATE TABLE "sales_director_assignments" (
	"director_id" integer NOT NULL,
	"sales_id" integer NOT NULL,
	"assigned_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_director_assignments_director_id_sales_id_pk" PRIMARY KEY("director_id","sales_id")
);
--> statement-breakpoint
ALTER TABLE "sales_director_assignments" ADD CONSTRAINT "sales_director_assignments_director_id_admin_users_id_fk" FOREIGN KEY ("director_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_director_assignments" ADD CONSTRAINT "sales_director_assignments_sales_id_admin_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_director_assignments" ADD CONSTRAINT "sales_director_assignments_assigned_by_admin_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_director_assignments_sales_idx" ON "sales_director_assignments" USING btree ("sales_id");