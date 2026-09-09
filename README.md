# YOLO OS

Deployment-ready shell for YOLO's operational system. It follows the approved prototype while adding a real React/Vite build, Supabase authentication, a PostgreSQL schema with row-level security, private attachment storage, GitHub verification, and Vercel configuration.

## Current boundary

The approved operational prototype is preserved at `public/prototype/` and displayed inside the authenticated application shell. This makes it possible to test hosting, access, mobile behavior, printing, and stakeholder use without losing the prototype.

Supabase authentication is connected by the new shell. The SQL schema is ready for inventory, receiving, orders, reservations, checklists, movements, attachments, drivers, delivery, pickup, and returns. The prototype's individual screens still use in-memory session data until each workflow is migrated to the typed Supabase data layer.

## Stack

- React 18 and TypeScript 5
- Vite 5
- Tailwind CSS 3
- Supabase Auth, PostgreSQL, RLS, Storage, and Realtime-ready tables
- Vercel static SPA deployment
- GitHub Actions build verification

## Local setup

Requirements: Node.js 18+ and pnpm 9.

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Without Supabase variables, the app opens in clearly labeled prototype mode. With valid variables, users must sign in through Supabase Auth before the prototype opens.

## Supabase setup

1. Create a Supabase project in the São Paulo region when available for your plan and compliance requirements.
2. Install the Supabase CLI and authenticate.
3. Link this directory to the project and apply the migrations:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

4. Copy the project URL and anon/publishable key into `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
VITE_APP_ENV=staging
```

5. Create the first user in Supabase Authentication. The database trigger creates the matching YOLO profile automatically. Change that profile's `role` to `admin` for the initial administrator.

Never place the Supabase service-role key in this frontend or in Vercel variables prefixed with `VITE_`.

## Vercel setup

1. Import the GitHub repository into Vercel.
2. Keep the detected Vite settings. `vercel.json` already declares the build and SPA rewrite.
3. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_APP_ENV=staging` to the Preview environment.
4. Add the Vercel preview and production URLs to Supabase Authentication → URL Configuration.
5. Deploy the `main` branch for production and use pull-request preview deployments while testing.

## Data safety already prepared

- Every operational table carries an organization ID.
- RLS restricts records to authenticated members of the same organization.
- Physical asset IDs and product SKUs are unique inside YOLO.
- Equipment reservations use a database exclusion constraint to block overlapping periods.
- Stock movements and order events are append-only through the exposed RLS policies.
- Attachments are private and organized by organization/order path.
- No secret keys are committed.

## Recommended migration order after field testing

1. User profiles and role-based visibility.
2. Products, locations, and uniquely identified assets.
3. Orders, items, reservations, and attachments.
4. Separação assignments and checklists with realtime updates.
5. Receiving, classification, containers, and stock movements.
6. Delivery, pickup, return inspection, cleaning, and restocking.
7. Billing status and Shopify/Bling integrations.

The full business and system references are in `docs/`.
