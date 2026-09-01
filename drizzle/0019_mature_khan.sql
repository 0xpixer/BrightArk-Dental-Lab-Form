CREATE INDEX "idesign_orders_sales_account_idx" ON "idesign_orders" USING btree ("sales_account_id");--> statement-breakpoint
CREATE INDEX "idesign_orders_doctor_account_idx" ON "idesign_orders" USING btree ("doctor_account_id");--> statement-breakpoint
CREATE INDEX "orders_submitted_by_idx" ON "orders" USING btree ("submitted_by");