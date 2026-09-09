# Staging deployment checklist

## Supabase

- [ ] Project created
- [ ] Database migration applied
- [ ] First administrator created in Auth
- [ ] Administrator profile role changed to `admin`
- [ ] Preview and production URLs added to Auth URL Configuration
- [ ] Order attachment bucket confirmed private
- [ ] RLS checked with two test users
- [ ] Overlapping asset reservation rejected in the database

## GitHub

- [ ] Repository created as private
- [ ] `main` pushed
- [ ] GitHub Actions Verify workflow passes
- [ ] Branch protection added after the initial setup
- [ ] No `.env` or credentials committed

## Vercel

- [ ] Repository imported
- [ ] Preview environment variables configured
- [ ] Production environment variables configured separately
- [ ] Preview deployment opens and requires authentication
- [ ] Mobile form and TV dashboard tested
- [ ] One-page order sheet prints on A4

## Field test

- [ ] Create request on a phone
- [ ] Confirm it appears under Acompanhar pedidos and Separação
- [ ] Assign delivery and pickup drivers
- [ ] Print the complete instruction sheet
- [ ] Test two requests with conflicting equipment dates
- [ ] Record receiving with multiple flavors and materials
- [ ] Classify and pack a partial quantity
- [ ] Transfer boxes and perform a physical inventory count
- [ ] Refresh/reopen the browser and record which data must become persistent first
