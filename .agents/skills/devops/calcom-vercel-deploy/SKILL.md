---
name: calcom-vercel-deploy
description: Deploy cal.diy (open-source Cal.com) monorepo to Vercel with Supabase. Covers the specific env var formatting, output directory config, Node 25 patches, and admin seeding that the official docs don't cover.
version: 1.0
---

# Deploy cal.diy (Open-Source Cal.com) to Vercel with Supabase

## Overview
Cal.diy is a massive monorepo (25+ packages, 595 Prisma migrations). Deploying to Vercel requires specific workarounds. This skill documents the proven approach.

## Prerequisites
- Vercel CLI logged in (`vercel login`)
- Supabase project created (use pooler URL for connection)
- Node 18+ (Node 25 requires patches)

## Step-by-Step

### 1. Clone and Install
```bash
git clone https://github.com/calcom/cal.diy.git
cd cal.diy
yarn install  # Yarn Berry 4.12.0
```

### 2. Configure .env
Key variables:
- `DATABASE_URL` — Supabase pooler URL
- `NEXTAUTH_URL` — Full URL with protocol: `https://booking.example.com`
- `NEXTAUTH_SECRET` — `openssl rand -base64 32`
- `NEXT_PUBLIC_WEBAPP_URL` — Same as NEXTAUTH_URL
- `ALLOWED_HOSTNAMES` — **MUST be quoted**: `"booking.example.com","localhost:3000"` (code does `JSON.parse("[" + val + "]")`)
- `RESERVED_SUBDOMAINS` — Same format: `"app","auth","docs",...`
- Email: `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`

### 3. Deploy Migrations
```bash
cd packages/prisma
DATABASE_URL="..." npx prisma migrate deploy
npx prisma generate
```

### 4. Fix Node 25 rmdirSync (if Node > 22)
```bash
# Patch zod-prisma-types
sed -i '' 's/rmdirSync/rmSync/g' node_modules/zod-prisma-types/src/generate.js
# Add postinstall script to root package.json
"postinstall": "bash scripts/patch-zod.sh"
```

### 5. Update turbo.json
```json
"globalDependencies": ["yarn.lock", "PGSSLMODE", "NODE_VERSION", "ALLOWED_HOSTNAMES", "RESERVED_SUBDOMAINS"]
```

### 6. Set Vercel Env Vars
- URL vars: include `https://` protocol
- `ALLOWED_HOSTNAMES`/`RESERVED_SUBDOMAINS`: quoted comma-separated
- `SKIP_DB_MIGRATIONS=1`

### 7. Configure Vercel Project via API
```bash
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
# Set output directory only — do NOT set rootDirectory
curl -X PATCH "https://api.vercel.com/v9/projects/PROJECT_ID?teamId=TEAM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"outputDirectory": "apps/web/.next"}'
```

### 8. Build and Deploy
```bash
SKIP_DB_MIGRATIONS=1 yarn build  # local test
vercel --prod                     # deploy (~3-5 min)
```

### 9. Patch Prisma for Supabase (CRITICAL — Two Issues)

**Issue A: SSL/TLS cert chain.** The Supabase pooler uses a certificate chain that Node rejects at runtime. This causes 500 errors on every page that touches the DB. `NODE_TLS_REJECT_UNAUTHORIZED=0` alone is NOT sufficient. You must patch `packages/prisma/index.ts`.

**Issue B: Connection pool exhaustion.** The Supabase free tier limits pooler connections (as low as ~5-8 in session mode). Each Vercel serverless function instance creates its own Pool. With `max: 3`, just 2-3 concurrent cold starts exhaust the pooler. Error: `MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size`. Fix: use `max: 1` with short timeouts. Each Vercel function handles one request at a time anyway.

```typescript
// In packages/prisma/index.ts — replace the entire pool/adapter section:
const connectionString = process.env.DATABASE_URL || "";
// Use max:1 — each Vercel serverless function handles one request at a time.
// Multiple functions × max:3 = pool exhaustion on Supabase free tier.
const pool = new Pool({
  connectionString: connectionString,
  max: parseInt(process.env.PG_POOL_MAX || "1"),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },  // Supabase pooler cert chain
});
const adapter = new PrismaPg(pool);
```

Without this patch, the app builds successfully but:
- SSR pages return 500 (TLS error on `prisma.user.findFirst()`)
- Login API returns 302 to error page with `MaxClientsInSessionMode` (pool exhaustion)
- Non-DB endpoints like `/api/ip` and `/api/version` work fine

### 10. Seed Admin User (via SQL)
```sql
INSERT INTO users (username, name, email, "timeZone", "completedOnboarding", role, "identityProvider", verified, uuid)
VALUES ('admin', 'Admin', 'admin@example.com', 'America/Los_Angeles', true, 'ADMIN', 'CAL', true, gen_random_uuid());
INSERT INTO "UserPassword" (hash, "userId") VALUES ('$2b$12$...hash...', 1);
```

### 11. Update NEXTAUTH_URL / WEBAPP_URL After Deploy
If you deploy before connecting a custom domain, these env vars will point to the wrong host. The app redirects to whatever `NEXTAUTH_URL` is set to after login. Update all three vars on Vercel to match the actual deployment URL:

```bash
# Remove old (one env at a time — Vercel CLI doesn't support multiple envs in one add)
echo y | vercel env rm NEXTAUTH_URL production
echo y | vercel env rm NEXTAUTH_URL preview
echo y | vercel env rm NEXTAUTH_URL development
# Add new
echo 'https://your-deployment.vercel.app' | vercel env add NEXTAUTH_URL production
echo 'https://your-deployment.vercel.app' | vercel env add NEXTAUTH_URL preview
echo 'https://your-deployment.vercel.app' | vercel env add NEXTAUTH_URL development
# Repeat for NEXT_PUBLIC_WEBAPP_URL and NEXT_PUBLIC_WEBSITE_URL
```

Then redeploy (`vercel --prod`). When you later connect a custom domain, repeat this process with the domain URL.

## Changing Subdomain or Renaming Project

When you change the Vercel subdomain (e.g., `cal-something.vercel.app` → `allcal.vercel.app`) or rename the Vercel project, you must update **all** of the following. Missing any one causes 500 errors or broken redirects.

**Checklist (in order):**

1. **`.vercel/project.json`** — Update `projectName` to match the new Vercel project name. The `projectId` and `orgId` stay the same. If this is stale, the Vercel CLI may link or deploy to the wrong project.
2. **Vercel env vars (production, preview, development)** — Remove and re-add all three URL variables with the new domain:
   - `NEXTAUTH_URL` = `https://new-subdomain.vercel.app`
   - `NEXT_PUBLIC_WEBAPP_URL` = `https://new-subdomain.vercel.app`
   - `NEXT_PUBLIC_WEBSITE_URL` = `https://new-subdomain.vercel.app`
   - Note: Vercel subdomains are always `.vercel.app`, never `.vercel.com`.
3. **`ALLOWED_HOSTNAMES`** — Add the new subdomain to this env var on Vercel (all 3 environments) AND in local `.env`. The app does `JSON.parse("[" + val + "]")` and will reject requests to any hostname not in this list, returning errors.
   - Format: `'"new-subdomain.vercel.app","booking.customdomain.com","localhost:3000"'`
4. **Local `.env`** — Update `ALLOWED_HOSTNAMES`, `NEXTAUTH_URL`, `NEXT_PUBLIC_WEBAPP_URL`, `NEXT_PUBLIC_WEBSITE_URL` to match.
5. **Redeploy** — `SKIP_DB_MIGRATIONS=1 vercel --prod`. Env var changes only take effect after a new deployment.

**Pitfall:** The `vercel env rm` / `vercel env add` commands only work one environment at a time (not `production preview development` in a single call). Script each one explicitly.

## Common Failures

| Failure | Fix |
|---------|-----|
| `rmdirSync` deprecation (Node 25) | Patch zod-prisma-types in postinstall |
| `JSON.parse` error `[booking.al` | Quote ALLOWED_HOSTNAMES values |
| No Output Directory | Set `outputDirectory: apps/web/.next` via API |
| Supabase circuit breaker | Wait 60s, seed via direct SQL |
| TLS self-signed cert (500 on SSR pages) | Patch `packages/prisma/index.ts` with `ssl: { rejectUnauthorized: false }`. `NODE_TLS_REJECT_UNAUTHORIZED=0` is NOT sufficient. |
| `MaxClientsInSessionMode` on any DB page | Pool max too high. Use `max: 1` (not 3) with `connectionTimeoutMillis: 10000`. Each Vercel function is one-request-at-a-time. See Step 9. |
| Login redirects to wrong domain | Update `NEXTAUTH_URL`, `NEXT_PUBLIC_WEBAPP_URL`, `NEXT_PUBLIC_WEBSITE_URL` on Vercel and redeploy |
| Vercel deployment protection (401) | Disable in Vercel dashboard → Settings → Deployment Protection, or use `vercel curl` |
| Provider pages 404 | Users with `organizationId` set will 404 at `/username`. Remove `organizationId` and `movedToProfileId` for non-admin users. Org routing (`/org/user`) is broken in self-hosted cal.diy. |
| Event type booking pages 404 | Profile table records with org IDs confuse routing. May need to clear and recreate Profile records without org associations. Still debugging — the listing page works but `/user/event-slug` can 404. |
| 500 after subdomain change | Check ALLOWED_HOSTNAMES includes new subdomain, all 3 URL env vars updated, .vercel/project.json projectName matches, and redeployed. See "Changing Subdomain" section above. |

## Seeding Healthcare Providers

The official seed script (`yarn seed-basic`) fails on Supabase due to TLS issues. Seed everything via direct SQL instead.

### App Store (Required for Google Calendar, Zoom)
```sql
INSERT INTO "App" (slug, "dirName", categories, enabled, keys, "createdAt", "updatedAt")
VALUES
  ('google-calendar', 'googlecalendar', ARRAY['calendar']::"AppCategories"[], true, '{}'::jsonb, NOW(), NOW()),
  ('zoom', 'zoomvideo', ARRAY['conferencing']::"AppCategories"[], true, '{}'::jsonb, NOW(), NOW()),
  ('google-video', 'googlevideo', ARRAY['conferencing']::"AppCategories"[], true, '{}'::jsonb, NOW(), NOW());
```

Note: Adding App rows makes them appear in the app store UI, but connecting them requires OAuth env vars:
- Google Calendar: `GOOGLE_API_CREDENTIALS` (JSON with client_id, client_secret)
- Zoom: `ZOOM_CLIENT_ID` and `ZOOM_CLIENT_SECRET`
- Cal Video (Daily.co) works out of the box with no OAuth

### Creating Provider Users
```sql
-- Insert providers
INSERT INTO users (username, name, email, "timeZone", "completedOnboarding", role, "identityProvider", verified, uuid)
VALUES ('dr-smith', 'Dr. Sarah Smith', 'dr.smith@example.com', 'America/Los_Angeles', true, 'USER', 'CAL', true, gen_random_uuid());
-- ... repeat for each provider

-- Passwords (bcrypt hash of desired password)
-- Generate: python3 -c "import bcrypt; print(bcrypt.hashpw(b'YourPassword!', bcrypt.gensalt(12)).decode())"
INSERT INTO "UserPassword" (hash, "userId") SELECT '$2b$12$...hash...', id FROM users WHERE id > 1;

-- Team memberships
INSERT INTO "Membership" ("userId", "teamId", role, accepted, "createdAt", "updatedAt")
SELECT id, 1, 'MEMBER', true, NOW(), NOW() FROM users WHERE id > 1;

-- Schedules (Mon-Fri 9-5)
INSERT INTO "Schedule" ("userId", name, "timeZone")
SELECT id, 'Working Hours', 'America/Los_Angeles' FROM users WHERE id > 1;
INSERT INTO "Availability" ("scheduleId", days, "startTime", "endTime")
SELECT s.id, ARRAY[1,2,3,4,5], '09:00:00'::time, '17:00:00'::time FROM "Schedule" s;
UPDATE users u SET "defaultScheduleId" = s.id FROM "Schedule" s WHERE s."userId" = u.id AND u.id > 1;
```

### Creating Event Types (per provider)
```sql
-- Use DO $$ loop to create event types for each provider
-- Key fields: title, slug (unique per user), length, userId, scheduleId, locations, bookingFields
-- locations JSON: [{"type": "integrations:daily_video"}] for telehealth
-- locations JSON: [{"type": "inPerson", "address": "..."}] for in-person
-- bookingFields JSON: {"name": {"required": true}, "email": {"required": true}, "address": {"required": true}, "phone": {"required": true}}
-- SchedulingType enum values: roundRobin, collective, managed
```

### Round-Robin Team Event
```sql
INSERT INTO "EventType" (title, slug, "schedulingType", "teamId", ...)
VALUES ('Team Consultation', 'team-consultation', 'roundRobin', 1, ...);
INSERT INTO "Host" ("userId", "eventTypeId")
SELECT u.id, (SELECT id FROM "EventType" WHERE slug = 'team-consultation') FROM users u WHERE u.id > 1;
```

## Org/Team Routing Gotcha (CRITICAL)

Cal.com's organization routing (`/org-slug/username`) does NOT work reliably in self-hosted cal.diy. When users have `organizationId` set:
- `/username` returns 404 ("username is still available")
- `/org-slug/username` also returns 404

**Workaround:** Keep all non-admin users with `organizationId = NULL`. They can still be team members via the `Membership` table and have event types assigned. Only the admin user needs the org for the dashboard. This means:
- Provider pages live at `/username` (e.g., `/dr-smith`)
- No org-level team booking page (the round-robin event type still works via direct link)

The `OrganizationOnboarding` table (required fields: `id`, `createdById`, `orgOwnerEmail`, `billingPeriod`, `pricePerSeat`, `seats`, `name`, `slug`) must be populated for the admin org to function, but only the admin should have `organizationId` set.

## Debugging Vercel 500 Errors

Vercel serverless functions return a generic "Internal Server Error" with no stack trace. To see the real error, wrap the route handler temporarily:

```typescript
// pages/api/auth/verify-email.ts (or any Pages Router API route)
import { handler as originalHandler } from "@lib/pages/auth/verify-email";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    return await originalHandler(req, res);
  } catch (error: any) {
    console.error("VERIFY_EMAIL_ERROR:", error?.message, error?.stack);
    return res.status(500).json({
      error: error?.message,
      stack: process.env.NODE_ENV !== "production" ? error?.stack : undefined,
    });
  }
}
```

Deploy, hit the failing endpoint, and the JSON response will show the actual error. Remove the wrapper once fixed.

## End-to-End Email Verification Testing

Use `himalaya` CLI to check the inbox directly without a browser:

```bash
# Install
curl -sSL https://raw.githubusercontent.com/pimalaya/himalaya/master/install.sh | PREFIX=~/.local sh

# Configure ~/.config/himalaya/config.toml with IMAP credentials
# Then check inbox:
himalaya envelope list --page-size 5
# Read the verification email:
himalaya message read <ID>
# Extract the token URL and curl it to test
```

The verification email route is at `pages/api/auth/verify-email.ts` (Pages Router, not App Router). The verification token is stored in the `VerificationToken` table and expires in ~24h.

## Vercel Env Var Management Tips

- `vercel env add` only accepts ONE environment per call (not `production preview development`)
- `vercel env rm` requires `echo y |` for confirmation
- The Vercel API (`api.vercel.com/v9/projects/...`) can update settings but env vars are encrypted — use the CLI
- Vercel auth token location: `~/Library/Application Support/com.vercel.cli/auth.json` (macOS)
- After env var changes, must redeploy (`vercel --prod`) for them to take effect
- **Extract env vars to local `.env`:** `vercel env pull .env.vercel --yes --environment production`. Note: Vercel masks encrypted secrets with `***` in the output. You'll still need to fill in secrets manually from your records. Use the `.env.example` as a template and overlay with the pulled values.
