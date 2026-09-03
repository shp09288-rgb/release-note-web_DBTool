# Release Note Web Tool — Setup

## Supabase environment variables

This app stores Release Note data in Supabase. API routes on the server need valid credentials before the dashboard can load equipment cards.

### 1. Get URL and keys from Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **Project Settings** → **API**.
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Service role key (server only)

1. On the same **API** page, copy the **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`.
2. Use it **only on the server** (Next.js API routes). It bypasses Row Level Security.
3. **Never commit** the service role key to Git, share it in chat, or expose it in client-side code.

### 3. Create `.env.local`

1. Copy the example file:

   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in your values in `.env.local` (do not commit this file).

3. `.env.local` is ignored by Git via `.gitignore` (pattern `.env*`, with `.env.local.example` committed as a template).

### 4. Restart the dev server

Environment variables are read when Next.js starts. After changing `.env.local`:

```bash
npm run dev
```

Then open [http://localhost:3000/](http://localhost:3000/) and confirm the five equipment cards load with their current versions — that proves the Supabase connection works. Optionally open `/search` or a `/site/[site]/[equipment]` timeline to confirm further.

## Refreshing the PMS issue cache

`pms_issues` is a cache of Redmine issue metadata (title, status) keyed by PMS
number. It is optional — lookups still work without it — but it goes stale as
new deployments introduce PMS numbers that were never fetched. There is no UI
button for this yet; trigger it with the upload password:

```bash
curl -X POST http://localhost:3000/api/pms/sync \
  -H "Content-Type: application/json" \
  -d '{"password": "<upload password>"}'
```

This calls `syncIssues()` (`lib/queries/pms.ts`), which re-fetches every PMS
number referenced in `deployment_pms_refs` from `pms.parksystems.com` and
upserts it into `pms_issues`. Run it after uploading a batch of deployments
with new PMS numbers, or periodically via cron/scheduled task if you want it
kept current automatically.

## Quick start

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```
