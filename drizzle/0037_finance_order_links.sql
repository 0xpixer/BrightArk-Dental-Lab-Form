ALTER TABLE "idesign_orders" ADD COLUMN "case_id" integer;--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD COLUMN "dental_order_id" integer;--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD CONSTRAINT "idesign_orders_case_id_idesign_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."idesign_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idesign_orders" ADD CONSTRAINT "idesign_orders_dental_order_id_orders_id_fk" FOREIGN KEY ("dental_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idesign_orders_case_idx" ON "idesign_orders" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idesign_orders_dental_order_idx" ON "idesign_orders" USING btree ("dental_order_id");