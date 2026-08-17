ALTER TABLE "order_messages" ALTER COLUMN "message" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_messages" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "order_messages" ADD COLUMN "image_name" text;