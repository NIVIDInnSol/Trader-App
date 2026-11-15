# Fixfare (working name)

A UK marketplace for handyman and trades jobs where **trust works both ways**:

1. Customers and tradespeople register.
2. A customer posts a job.
3. Tradespeople see the job, together with the customer's **Customer Trust** (rating from other trades + payment record), and send quotes.
4. The customer compares quotes side by side (cheapest first or best rated), sees each trader's rating and reviews, and accepts one. The other quotes are declined automatically.
5. When the work is done, the trader raises an invoice (optional 20% VAT, due date).
6. The customer pays by **card, bank transfer or cash**. Cash payments are confirmed by the trader. Card and bank transfer are **simulated** in this prototype.
7. **Reminders**: automatic in-app reminders 2 days before the due date, on the day, and every 3 days after; traders can also send a reminder (max one per 24 h). Late payment counts against the customer's trust rating.
8. Once paid, the customer rates the trader and the trader rates the customer.

The app name is set in one place, `src/lib/config.ts`, so it can be renamed later.

## Demo mode (this branch)

This version is a **sales demo with no database**. Everything is stored in the visitor's browser (`localStorage`), pre-filled with sample customers, tradespeople, jobs and reviews (`src/lib/demo/seed.ts`). Sample accounts reply automatically, so one person can walk through the whole flow:

- as a customer: post a job → quotes arrive within seconds → accept one → the trader "finishes" and invoices → pay → leave a review (and receive one back);
- as a tradesperson: quote on a sample customer's job → it's accepted → raise the invoice → it's paid → rate the customer.

The dark **Demo** bar at the top switches between accounts and resets the sample data.

The full database version (Supabase, with the same flow enforced by Postgres functions and row-level security) is on the **`supabase-version`** branch, and its schema is in `supabase/migrations/`.

## Tech

- Next.js 16 (App Router), Tailwind CSS 4
- Supabase: Postgres, Auth, Row Level Security, `pg_cron` for reminders
- Deploys to Vercel

All writes go through Postgres functions (`supabase/migrations/…_init.sql`) that check who is calling, so users can't, for example, accept a quote on someone else's job or mark their own invoice as paid by editing the table directly.

## Run the demo

`npm install && npm run dev`, then open http://localhost:3000. No environment variables are needed.

## Set up the database version (`supabase-version` branch)

1. Create a Supabase project (region: London, `eu-west-2`).
2. Run `supabase/migrations/20261115000000_init.sql` in the SQL editor (or `supabase db push`).
3. For quick demos, turn off **Authentication → Sign In / Providers → Email → Confirm email**, so new accounts can log in straight away. If you leave it on, set **Authentication → URL Configuration → Site URL** to your deployed URL.
4. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
5. `npm install && npm run dev`, then open http://localhost:3000.

On Vercel, add the same two environment variables to the project.

## Not built yet

- Real card payments (e.g. Stripe Connect) and holding funds until sign-off
- Email/SMS/push notifications (alerts are in-app only)
- Photos on jobs and invoices
- Identity, insurance and accreditation checks (TrustMark, Gas Safe, NICEIC)
- Messaging between customer and trader, disputes
