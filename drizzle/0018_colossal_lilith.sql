CREATE TABLE "sales_doctor_assignments" (
	"sales_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"assigned_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_doctor_assignments_sales_id_doctor_id_pk" PRIMARY KEY("sales_id","doctor_id")
);
--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD COLUMN "assignment_updated_by" integer;--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD COLUMN "assignment_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales_doctor_assignments" ADD CONSTRAINT "sales_doctor_assignments_sales_id_admin_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_doctor_assignments" ADD CONSTRAINT "sales_doctor_assignments_doctor_id_admin_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_doctor_assignments" ADD CONSTRAINT "sales_doctor_assignments_assigned_by_admin_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_doctor_assignments_doctor_idx" ON "sales_doctor_assignments" USING btree ("doctor_id");--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD CONSTRAINT "idesign_orders_assignment_updated_by_admin_users_id_fk" FOREIGN KEY ("assignment_updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;