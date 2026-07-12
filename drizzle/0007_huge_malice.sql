CREATE TABLE "lark_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lark_notifications_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "lark_notifications" ADD CONSTRAINT "lark_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "lark_notifications" ("order_id") SELECT "id" FROM "orders" ON CONFLICT ("order_id") DO NOTHING;
