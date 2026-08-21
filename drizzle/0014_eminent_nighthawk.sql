CREATE TABLE "order_message_reads" (
	"order_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_message_reads_order_id_user_id_pk" PRIMARY KEY("order_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status_updated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "orders" SET "status_updated_at" = "created_at";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status_updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status_updated_at" SET NOT NULL;--> statement-breakpoint
UPDATE "orders" SET "status" = 'in_production' WHERE "status" = 'in_progress';--> statement-breakpoint
UPDATE "orders" SET "status" = 'completed' WHERE "status" = 'complete';--> statement-breakpoint
ALTER TABLE "order_message_reads" ADD CONSTRAINT "order_message_reads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_message_reads" ADD CONSTRAINT "order_message_reads_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
