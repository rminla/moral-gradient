# Moral Gradient: public site

Private repo: [`rminla/moral-gradient`](https://github.com/rminla/moral-gradient). This folder is the repo root.

A free, open record of what AI models **do** when a choice has moral weight, next to what they **say** is right. Written for everyone, so anyone can follow it, try it and talk about it.

**Mission.** Raise public awareness of, and conversation about, AI alignment and safety among regular people, not only researchers. Academics get open data and methods; everyone else gets plain-language results, dilemmas to try (`/try`), an explainer (`/learn`) and an email when there are new findings.

It is an open tracker of whether AI models **act** on the values they **state**. It covers three pillars (Say vs Do, Values under pressure, Self-interest) plus a baseline layer (MFQ-2, MFQ-30, OUS, Awad 2020 trolley dilemmas) with human data where it exists. The site is descriptive only: it never publishes a "right answer".

The name is one config value: `NEXT_PUBLIC_SITE_NAME` (default "Moral Gradient").

## What's here

| Area | Where |
|---|---|
| Try it: answer a dilemma (Switch, Footbridge), then see people (Awad 2020) and each model; the answer stays in the browser, never sent | `app/try`, `components/TryClient.tsx` |
| Learn: plain-language explainer, discussion questions, glossary, curated outside reading | `app/learn` |
| New findings by email: double opt-in signup (Learn, Try, Results, donate thanks, opt-in box on donate), confirm and one-click unsubscribe | `components/Subscribe.tsx`, `lib/subscribers.ts`, `app/api/subscribe/*`, `app/subscribe/*` |
| Privacy | `app/privacy` |
| Home: purpose, live budget, next-milestone progress bar ("$X left before running the full suite on …"), pillars, shareable findings, leaderboard | `app/page.tsx` |
| Results: Say/Judge/Do table, self-interest charts, pressure flip rates, baseline vs human data, findings, run log (superseded and excluded runs listed, never charted) | `app/results` |
| Per model / per scenario pages (donor-gated prompts and reasoning traces on scenario pages) | `app/models/[slug]`, `app/scenarios/[id]` |
| Share page and auto-generated 1200×630 OG image per finding; X and LinkedIn buttons | `app/f/[id]`, `app/f/[id]/opengraph-image.tsx`, `components/Share.tsx` |
| Costs and funding: live ledger spend, donations, fees, pool, milestone queue, launched runs, leaderboard | `app/costs` |
| Donate (anonymous or named; a name can link to your account), Stripe Checkout or mock checkout, thank-you page | `app/donate`, `app/api/donate`, `app/api/stripe/webhook` |
| Magic-link sign-in and account (display name, profile link) | `app/signin`, `app/account`, `app/api/auth/*` |
| Methodology | `app/about` |

Stack: Next.js 15 (App Router) + Tailwind v4, libSQL (local SQLite file; Turso in production), Stripe Checkout, Resend for email. Runs on Vercel's free tier.

## Run locally

```bash
git clone git@github.com:rminla/moral-gradient.git site   # or work in moral-compass/site on the box
cd site
npm install
cp .env.example .env.local      # then set SESSION_SECRET and INGEST_TOKEN to long random strings
# for a local preview without Stripe/Resend, also set ALLOW_MOCK_PAYMENTS=1 and ALLOW_DEV_LOGIN=1
npm run bundle                  # adapt ../results into data/site-bundle.json (+ donor-only data/site-traces.json)
npm run db:init                 # schema + milestone queue (add --reset-local to clear local test donations)
npm run build && npm start      # http://localhost:3000
npm run screenshots             # optional: PNGs of the key pages into screenshots/
```

On the box the site re-runs the adapter automatically whenever `../results/public/index.json` changes, and it reads spend live from `../pilot/data/ledger.sqlite`.

## Where the data comes from

Priority for results:
1. A bundle pushed to `/api/ingest` (production).
2. The adapter output of `RESULTS_DIR` (`scripts/build_site_bundle.py`, reading the results bundle schema v1.0.0).
3. `data/sample-bundle.json` (EXAMPLE DATA, labelled as such on every page).

Adapter rules:
- `validity: exploratory` runs are charted.
- `superseded` runs are listed in the run log. Their traces carry a "Superseded run" tag, and they are never charted.
- `excluded` runs (probes, aborted runs) are listed only.
- Hold-out items are dropped by the exporter, again by the adapter, and again on every page read.
- Hold-out text is never shown to anyone, donors included.

Rates are expressed relative to the option the model's own stated view implies. If the model disagreed with the SAY statement on a binary dilemma, the shares are mirrored.

Spend priority:
1. The live ledger at `LEDGER_PATH`, when readable.
2. Spend pushed via `/api/ingest`.
3. Bundle totals.

### Pushing results to production

Vercel can't read the box, so push from the box after each export:

```bash
npm run bundle
SITE=https://your-domain INGEST_TOKEN=... npm run push:results
```

This sends the bundle, the donor-only traces and the ledger spend summary.

## Money flow and auto-launch

- Net donations (amount minus the Stripe fee; the real fee when Stripe reports it, otherwise an estimate of 2.9% + 30¢) fill the milestone queue in order (`data/milestones.json`), inside one DB transaction.
- When a bar reaches 100%, the milestone becomes `funded`. If `AUTO_LAUNCH=1`, `lib/jobs.ts` launches the suite with a **hard cap equal to the funded amount**, and the next bar starts filling.
- When the queue is empty, money waits in the general pool. New milestones can be appended with `npm run db:init -- --reseed-milestones`.
- `JOB_RUNNER_MODE` sets what a launch does:
  - `dryrun` (default): records the job; nothing is sent to any provider.
  - `command`: spawns `JOB_RUNNER_CMD` without a shell. Placeholders are `{model} {suite} {budget} {milestone} {job}`. The child gets `MC_JOB_ID`, `MC_BUDGET_USD` and `MC_CALLBACK_URL`; site secrets are stripped from its environment. Logs go to `data/jobs/<id>.log`.
  - `webhook`: POSTs `{job_id, milestone, model_id, provider, suite, budget_usd}` to `JOB_WEBHOOK_URL` with `Bearer JOB_WEBHOOK_TOKEN`. Use this on Vercel and run the runner on the box.
- The runner reports back with `POST /api/jobs/<id>`, `Bearer INGEST_TOKEN`, and a body of `{"status":"running"|"published"|"failed","detail":"…"}`.
- Refunds (`charge.refunded`) mark the donation refunded. Already-funded milestones are not un-funded.

## Environment variables

| Var | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_NAME` | branding | default "Moral Gradient" |
| `NEXT_PUBLIC_SITE_URL` | links, OG, Stripe redirects | e.g. `https://moralgradient.org` |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | DB | local `file:./data/site.db`; Turso `libsql://…` + token |
| `RESULTS_DIR` | box only | `../results` |
| `LEDGER_PATH` | box only | `../pilot/data/ledger.sqlite` (opened read-only) |
| `INGEST_TOKEN` | `/api/ingest`, runner callbacks | long random string |
| `SESSION_SECRET` | sign-in tokens | long random string |
| `STRIPE_SECRET_KEY` | payments | `sk_test_…` first; empty means mock mode |
| `STRIPE_WEBHOOK_SECRET` | payments | `whsec_…` from the webhook endpoint |
| `RESEND_API_KEY`, `EMAIL_FROM` | magic-link and list-confirmation email | sender on a verified domain; without them, sign-ups are stored as pending and nothing is sent |
| `ADMIN_EMAILS` | admin link on the account page | comma-separated |
| `AUTO_LAUNCH` | auto-launch | on unless set to `0`; with `0`, funded milestones wait for a manual launch |
| `JOB_RUNNER_MODE`, `JOB_RUNNER_CMD`, `JOB_WEBHOOK_URL`, `JOB_WEBHOOK_TOKEN` | runs | see above |
| `ALLOW_MOCK_PAYMENTS`, `ALLOW_DEV_LOGIN` | local previews only | **keep 0 in production**; dev login shows sign-in links on screen |

## Deploy (Vercel + Turso + Stripe + Resend)

1. **GitHub**: the folder is already a git repo with an initial commit. Create the private repo `rminla/moral-gradient` (empty, no README), then `git remote add origin git@github.com:rminla/moral-gradient.git && git push -u origin main`. `.gitignore` already excludes `.env*`, local DBs, donor-only traces, job logs and the donor-trace screenshot.
2. **Turso**: `turso db create moral-gradient`. Copy the URL into `DATABASE_URL` and create a token for `DATABASE_AUTH_TOKEN`. The schema is created on first request. Then run `DATABASE_URL=… DATABASE_AUTH_TOKEN=… npm run db:init` once to seed the milestones.
3. **Vercel**: import `rminla/moral-gradient` (repo root, framework Next.js) and add the env vars above (`JOB_RUNNER_MODE=webhook` or `dryrun`). Then deploy.
4. **Domain**: `moralgradient.org` is added in Vercel → Domains. Set `NEXT_PUBLIC_SITE_URL=https://moralgradient.org` in Vercel and redeploy (links, share images and Stripe redirects use it).
5. **Stripe** (test mode first):
   - Set `STRIPE_SECRET_KEY`.
   - Add a webhook endpoint at `https://moralgradient.org/api/stripe/webhook` for the events `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`, and set `STRIPE_WEBHOOK_SECRET`.
   - Test with card 4242 4242 4242 4242, then switch to live keys.
6. **Resend**: verify the domain (DNS records), then set `RESEND_API_KEY` and `EMAIL_FROM`.
7. **Results**: on the box, `npm run bundle && SITE=https://moralgradient.org INGEST_TOKEN=… npm run push:results`. Run it after every export, or call it at the end of the runner.

## New findings list

- Table `subscribers` (created automatically by the schema in `lib/db.ts`; `npm run db:init` also creates it). Additive only, safe on an existing database.
- Double opt-in: sign-up stores a **pending** row and emails a confirmation link (POST button page, so mail scanners can't confirm). Only `status='confirmed'` rows may ever be mailed. The consent text and version are stored with each row.
- Unsubscribe: signed link (`/subscribe/unsubscribe?id=…&sig=…`) plus RFC 8058 one-click headers on every email.
- Abuse: hidden honeypot field and DB-backed rate limits (table `rate_hits`, salted hashes, pruned after 24h) on `/api/subscribe` and `/api/auth/request`.
- If Resend isn't configured, sign-ups stay pending and the form says "we'll confirm soon". Once it is: `curl -X POST -H "authorization: Bearer $INGEST_TOKEN" https://moralgradient.org/api/subscribe/pending` sends the missing confirmations (GET shows counts). There is no findings-mail sender yet.
- `/api/status` reports `email.provider` (`resend` or `none`) and the sender domain, never the key.

## Security notes

- Secrets live only in env vars. The site never logs them, and `push:results` never prints the token.
- Magic-link tokens and session ids are stored only as SHA-256 hashes. Cookies are httpOnly, SameSite=Lax and Secure in production.
- The Stripe webhook is signature-verified and idempotent (an `events` table).
- `/api/ingest` and `/api/jobs/*` compare bearer tokens with `timingSafeEqual`.
- Profile links must be https; leaderboard links are `rel="nofollow ugc noopener"`.
- Donor-only traces are only read server-side after a donor check. They are never in `public/` or in the client bundle.
