# Faded6 Ticket Platform

Vite + React + TypeScript frontend, Supabase (Postgres, Auth, Edge Functions) backend, Paystack payments (NGN).

Frontend deploys to **Vercel**. The database and payment logic live in **Supabase**, so both need setting up.

```
Buyer -> Vercel (React) -> Supabase Edge Functions -> Paystack
                                  ^                       |
                                  +---- paystack-webhook -+
```

## 1. Supabase (backend)

1. Create a project at supabase.com. Note the **Project ref**, **Project URL**, and the **anon / publishable key** (Settings -> API).
2. In PowerShell, from the project folder:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push                      # creates all tables, policies, finalize_order, storage bucket
   ```
3. Secrets - copy `supabase/functions/.env.example` to `supabase/functions/.env`, fill in your Paystack keys (and Resend if you want emails), then:

   ```powershell
   npx supabase secrets set --env-file supabase/functions/.env
   ```
4. Deploy the functions (the `verify_jwt = false` settings in `supabase/config.toml` are applied automatically):

   ```powershell
   npx supabase functions deploy
   ```
   If the CLI asks for Docker, add `--use-api`.
5. Dashboard -> Authentication:
   - **Providers -> Email**: turn **off** "Confirm email" (hosts sign up and go straight to the dashboard).
   - **URL Configuration**: set **Site URL** to your Vercel URL once you have it (step 3).

## 2. Paystack

1. Dashboard -> Settings -> API Keys & Webhooks. Copy the **test** public + secret keys first (go live later by swapping to `pk_live_` / `sk_live_` and re-running `secrets set`).
2. Set the **Webhook URL** (test and live each have their own field) to:

   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook
   ```
   The webhook is what issues tickets when a buyer pays but closes the tab before the page can confirm.

## 3. GitHub -> Vercel

```powershell
git init
git add .
git commit -m "Faded6 ticket platform"
git branch -M main
git remote add origin https://github.com/YOUR_USER/faded6.git
git push -u origin main
```

Then at vercel.com: **Add New -> Project -> import the repo**. Framework (Vite), build command and output directory are already set by `vercel.json`. Add these **Environment Variables** (Production + Preview):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon / publishable key |

Deploy. Every push to `main` redeploys. Do **not** put `sk_...` keys in Vercel.

## 4. Test before real money

1. Sign up as a host, create an event with a paid tier, open the public `/e/<slug>` link.
2. Pay with Paystack's test card (see Paystack's docs under "Test payments").
3. You should land on `/ticket/F6-....` with a QR code. Check Supabase -> Edge Functions -> Logs if not.
4. Pay again and close the popup right after paying: the ticket should still appear within a minute (webhook), and the order page auto-refreshes.

## Host payouts

Ticket money lands in **your** Paystack account. Hosts withdraw it like this:

1. Host opens **Payouts** in the dashboard, picks their bank and enters their account number (Paystack verifies the account name where it can).
2. Host requests an amount. Only earnings from events that have **started** are withdrawable, and the service fee is never part of the host's share.
3. You open **Payout requests** (admin only), send the money from your Paystack dashboard or bank app, then click **Mark as paid** (or **Reject** with a reason).

Make yourself the admin once, in Supabase -> SQL Editor (use the email you sign in with):

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'you@example.com';
```
Sign out and back in; "Payout requests" then appears in the sidebar.

Rules live in `supabase/migrations/00008_host_payouts.sql`: minimum payout is 1000 NGN (`min_payout_ngn`), one open request per host, and earnings are held until the event starts (remove the `e.event_date <= now()` condition in `host_payout_balance()` to release them immediately).

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| "Payments are not set up yet" at checkout | `PAYSTACK_SECRET_KEY` not set in Supabase secrets (checkout deliberately refuses to take money) |
| Popup opens, payment succeeds, no ticket | Wrong/mismatched keys (e.g. `pk_live` with `sk_test`), or webhook URL missing |
| Function calls fail with "Invalid JWT" | Functions deployed without `config.toml` (redeploy from the project folder) |
| Refreshing `/e/slug` gives 404 on Vercel | `vercel.json` missing from the repo |
| Bank list will not load on the Payouts page | `payout-account` function not deployed (`npx supabase functions deploy`) |
| No emails | `RESEND_API_KEY` unset, or `TICKET_EMAIL_FROM` domain not verified in Resend |

If a log line says `REFUND_NEEDED`, a buyer paid for tickets that sold out in the meantime - refund them from the Paystack dashboard.

## Local development

```powershell
pnpm install
copy .env.example .env.local     # fill in the VITE_ values
pnpm dev
```
