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

`APP_URL`, `LARK_WEBHOOK_URL`, and `CRON_SECRET` must be set manually in Vercel. The matching `CRON_SECRET` must also be set as a GitHub Actions repository secret for automatic order completion.

Lark notifications start immediately after a successful order submission, using Vercel's `waitUntil` to keep the background send running without delaying the response. Each send has a ten-second timeout; successful sends are recorded in `lark_notifications`. Notification failures are logged in Vercel and do not fail the saved order. There is no scheduled notification scan, retry, or backfill for older orders.

The separate **Complete Delivered Orders** GitHub Actions workflow runs every three hours to change orders that have been Delivered for 14 days to Completed. It does not send any Lark messages. The former `/api/cron/lark-orders` route has been removed.

## Signup protection setup

Public signup now requires Turnstile and email verification. **Configure the following in Vercel and redeploy to enable new signups.** Missing configuration fails closed; existing accounts can still sign in. No existing accounts are deleted or retroactively verified. Admin-created accounts remain a trusted, separate path.

1. In [Cloudflare Turnstile](https://dash.cloudflare.com/), add a Managed widget and allow the site's production hostnames (including `idesign.thebrightark.com` and its `vercel.app` hostname if used).
2. Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to Vercel from that widget. Only the site key is public.
3. Set `TURNSTILE_ALLOWED_HOSTNAMES` to the same comma-separated hostnames, without `https://` or paths. If omitted, the server allows only the hostname of `APP_URL`.
4. In [Resend](https://resend.com/domains), verify a sender domain using its DNS records and create a sending API key. Set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel. Example sender: `BrightArk <verify@your-verified-domain.com>`.
5. Redeploy. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is embedded at build time. The normal deployment build applies migration `0020_signup_protection` before building the app.

Doctors receive a six-digit code and enter it in the same registration window. The code expires after 15 minutes and allows five attempts. Accounts and clinics are created together only after verification. The form's signup window signs the doctor in after verification without navigating away from the order. File upload token requests now require sign-in; the form opens its sign-in window before anonymous uploads.

Postgres-backed atomic limits apply across all Vercel instances: 10 signup attempts per IP/hour, one email per mailbox/minute, three per mailbox/hour, and 30 verification attempts per IP/hour. Gmail dot and plus aliases share a mailbox quota. The server trusts IP forwarding headers only on Vercel; other hosting needs an explicitly trusted ingress adaptation and otherwise shares the `unknown` quota. Rate-limit identities and verification codes are HMAC-hashed; passwords use bcrypt. Expired temporary records are cleaned in small indexed batches on subsequent successful signup requests, with no scheduled job. Codes, passwords, and raw signup database errors must not be logged.

Verification emails use Resend, with a timeout and an idempotency key. Delivery errors leave no usable account. A user can request another code after completing a fresh security check and waiting for the mailbox limit. Earlier unexpired codes remain tied to their original registration details; they cannot overwrite an existing account.

The login page offers an email-code password reset after a failed sign-in. Reset requests use the same Turnstile and Resend configuration, return a generic response that does not disclose whether an account exists, and apply per-IP and per-mailbox limits. Codes expire after 15 minutes, allow five attempts, and are replaced when a new code is requested. A successful reset invalidates older sessions and clears the failed-login limit for that account.

Local checks: `npx tsx --test src/lib/signup/*.test.ts` uses mocked providers and an isolated in-memory Postgres engine, never the production database or real email. `npx next build` checks the app without running migrations. For a live smoke test after configuration, register one approved test mailbox, verify receipt, confirm wrong-code rejection, then verify successfully and check the new Doctor account. Review existing suspicious accounts separately; these protections are not a cleanup operation.

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
