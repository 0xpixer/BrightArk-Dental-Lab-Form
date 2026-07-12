# BrightArk Dental Lab Order Form

Production-grade dental lab order form with Neon Postgres backend and Vercel Blob file storage.

## Stack

- **Next.js 14** App Router
- **React 18** + TypeScript
- **Tailwind CSS** (BrightArk brand tokens)
- **React Hook Form** + Zod
- **Drizzle ORM** + Neon Postgres
- **Vercel Blob** for file uploads

## Environment variables

Copy `.env.example` to `.env.local` and fill in values from your Vercel project:

```bash
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
APP_URL=https://your-production-domain.com
LARK_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/...
CRON_SECRET=use-a-long-random-secret
```

On Vercel, these are auto-injected when you connect Neon Postgres and Blob storage.

`APP_URL`, `LARK_WEBHOOK_URL`, and `CRON_SECRET` must be set manually. A Vercel Cron job runs every three hours and sends one Lark notification for each newly submitted order.

## Development

```bash
npm install
npm run db:generate   # generate migrations from schema
npm run db:migrate    # apply migrations to Neon
npm run dev
```

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/orders` | POST | Create a new order |
| `/api/orders` | GET | List orders (`?status=pending`) |
| `/api/upload` | POST | Vercel Blob client upload handler |

## Database scripts

```bash
npm run db:generate   # drizzle-kit generate
npm run db:migrate    # drizzle-kit migrate
npm run db:studio     # drizzle-kit studio
```

## Deploy

Deploy to Vercel — the project is configured for Next.js with serverless API routes. The build script runs Drizzle migrations before `next build`, so `DATABASE_URL` must be available in the deployment environment.
