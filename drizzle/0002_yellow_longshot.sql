ALTER TABLE "orders" ADD COLUMN "email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "email" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "address" DROP DEFAULT;
