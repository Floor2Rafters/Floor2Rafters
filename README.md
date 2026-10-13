# Floor 2 Rafters (F2R)

Fan-voted NBA rankings. Each fan fills a top 10 at every position with head-to-head picks, then ranks those 50 players into their own overall top 50. The app combines all fans' lists into the public fan rankings live, as fans pick: one board per position, plus the overall board.

## What's in here

The app uses the brand v1 look: spotlight on dark, Saira Condensed + Helvetica, team-color rows, blue rank numbers, a bottom bar (Board, My Lists, Pick, Me). `node test_launch.js` runs the full check.

| Folder / file | What it is |
|---|---|
| `public/` | The whole website. No build step: these files are what goes live. |
| `public/config.js` | The only file you edit to go live (your two Supabase keys). Also where you switch on the sponsor, F2R Pro and ads later. |
| `public/app.js` | The app itself (built from the `_*.js` files by `python3 build_app.py`). |
| `public/style.css` | The brand: colors, fonts, team glows, buttons. |
| `public/brand/` | Logo files (mark, wordmark, lockup, icon). |
| `public/players.json` | Player list used only in demo mode. The live site reads players from the database. |
| `public/privacy.html`, `public/terms.html` | Starter privacy policy and terms. Read them and adjust before launch. |
| `supabase/schema.sql` | Creates the database tables, security rules, ranking math and the nightly snapshot. |
| `supabase/functions/` | Two small server functions: `notify` (weekly recap emails and phone alerts) and `stripe-webhook` (F2R Pro payments). Each has a `test.mjs`. |
| `supabase/email/` | Branded sign-in emails to paste into Supabase. |
| `mobile/` | The iPhone and Android apps (see `mobile/README.md`). |
| `.github/workflows/android.yml`, `codemagic.yaml` | Cloud builds for the Android and iPhone apps. |
| `supabase/seed_players.sql` | Loads 392 players: 324 current players (team and last season's stats) plus the 70 All-Time greats (career stats and awards). |

**How scoring works:** a fan's #1 earns 50 points, #2 earns 49, down to 1 point for #50. The position boards add up every fan's position lists. The overall board adds up every fan's own overall top 50. Ties go to whoever has more #1 votes, then more fans listing him.

**Live boards:** every board updates as fans pick; there's no weekly release. Each night just after midnight Eastern the database saves a snapshot of every board, and the arrows (▲▼) show movement over the last 7 days.

## Try it right now (demo mode)

With `config.js` left empty, the app runs on your device only, with no sign-in. Open `public/index.html` through any local web server, or deploy it to Vercel as-is (step 4) and look at it on your phone.

## Go live: one-time setup (about 45 minutes)

### 1. Supabase (database and sign-in)
1. Go to supabase.com → **New project**. Name it `floor-2-rafters`, pick a strong database password (save it somewhere), and choose the **East US** region.
2. When it's ready, open **Database → Extensions**, search for **pg_cron**, and turn it on. This powers the nightly snapshot.
3. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**.
4. New query again: paste all of `supabase/seed_players.sql`, and click **Run**.
5. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key into `public/config.js`.

### 2. Sign-in settings
1. **Authentication → URL Configuration:** set **Site URL** to `https://floor2rafters.com`. Under **Redirect URLs** add `https://floor2rafters.com` and your Vercel address (like `https://floor-2-rafters.vercel.app`).
2. **Email sign-in links work out of the box,** but Supabase's built-in email only sends a few emails per hour. Before launch, connect a real email sender: sign up for **Resend** (free tier), verify `floor2rafters.com`, then paste its SMTP details into **Authentication → Emails → SMTP Settings** (sender: `hello@floor2rafters.com`, name: `Floor 2 Rafters`). Resend's free plan sends 100 emails a day; switch to its $20 plan for launch week if sign-ups pass that.
4. **Branded emails:** in **Authentication → Emails → Templates**, paste `supabase/email/magic-link.html` into **Magic Link** and `supabase/email/confirm-signup.html` into **Confirm signup** (subjects are in `supabase/email/README.txt`).
3. **Google sign-in (optional but recommended).** In Google Cloud Console, create an **OAuth client ID** (Web application). Add the redirect URL Supabase shows under **Authentication → Providers → Google**, then paste the client ID and secret into that Supabase page and switch Google on. Until you do this, set `google: false` in `config.js` to hide the button.

### 3. GitHub (where the code lives)
Create a new repository called `floor-2-rafters` and upload everything in this folder.

### 4. Vercel (hosting)
1. vercel.com → **Add New → Project** → import the `floor-2-rafters` repo.
2. Set **Root Directory** to `public`. Framework preset: **Other**. No build command.
3. Deploy. Every time the code changes on GitHub, Vercel redeploys automatically.

### 5. Your domain
In Vercel → your project → **Settings → Domains**, add `floor2rafters.com` and `www.floor2rafters.com` (and `floortorafters.com` + `www.floortorafters.com` if you bought it: `vercel.json` already sends those to floor2rafters.com). Vercel shows the DNS records to add at the company you bought the domain from. It usually goes live within an hour.

### 6. Make yourself an admin
Sign in to the live site once. Then, in Supabase SQL Editor, run this (with your email):

```sql
insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
```

Admins see an Admin section in Me: the numbers page and "Make board posts".

## Player stats: switching to 2026-27

The player list was checked against every 2026-27 roster on Oct 9, 2026 (trades, signings, 2026 first-round rookies). Teams cut to 15 before opening night (Tue Oct 20), so look over Table Editor → players again that week.

Stats show 2025-26 until **Monday Nov 9**, then refresh every Monday morning:
1. Open basketball-reference.com/leagues/NBA_2027_per_game.html → Share & Export → Get table as CSV, save it as per_game.csv.
2. Run `python3 tools/update_stats.py per_game.csv "2026-27 season (through Nov 8)"`.
3. Paste the printed SQL into Supabase → SQL Editor → Run.
4. Put the same label in `public/config.js` → `statsLabel`.

## Running the season

- **Save a snapshot by hand** (for example on launch day, so arrows start from a fixed point): `select snapshot_boards();` in the SQL Editor.
- **Fix a player's team** after a trade: Supabase → **Table Editor → players**, then edit the `team` cell. The site picks it up right away.
- **Add a player** (a rookie or a call-up): add a row in **players** with the next unused `id`. Never reuse or renumber an id, because fans' lists point to these ids. To retire a player, set `active` to false.
- **See how many fans have lists:** `select key, count(*) from lists group by key;`

## Board posts

Signed in as an admin, open Me and tap **Make board posts**, or use the posts button on the Fan Board. Post whenever you like; Mondays still work well as a weekly habit. You get four images for the board you're on, each with a ready caption:

- **Instagram post** (1080 × 1350), **Story / TikTok / Reels** (1080 × 1920), **Who moved** (1080 × 1350) and **X post** (1600 × 900).
- Tap **Save image** (on a phone this opens the share sheet, so you can post straight to Instagram or TikTok), then **Copy caption**.
- Switch tabs (PG, All-Time…) and tap the button again for that board's set.

## Sponsor spot

"Fan Board presented by…" is built in and switched off. When you sell it:

1. Open `public/config.js` and replace `sponsor: null` with the sponsor's details (the example is right above it). `logo` is optional; without one the name shows in F2R type.
2. Push to GitHub. Vercel updates the site in about a minute.

It shows under the scoreboard, on the #1 reveal, on the board post images and at the end of their captions. To pause it, add `on: false`. To show it on only some boards, use `boards: ["overall","goat"]`.

**Numbers for the sponsor:** the app counts views (one per visit per board) and taps. In the SQL Editor:
`select day, kind, sum(n) from sponsor_stats group by 1,2 order by 1 desc;`

## Friend groups

Fans tap **My Groups** at the top of the Board (or Me → My groups), start a group and send the link (`floor2rafters.com/join/CODE`; on phones with the app it opens the app) to their group chat. The group board uses the same points as the Fan Board, counting only the group, and updates live. Members see each other's nickname and #1 pick.

- Anyone can join up to 10 groups. Free fans can start 1 group of up to 12 people; once F2R Pro is on, Pro fans can start up to 10 groups of up to 50. (Until Pro is set up nobody is Pro, so everyone has the free limits.)
- The lead (whoever has been in the group longest) can remove people and get a new code.
- Everything goes through database functions, so nobody can read a group they're not in.

## Notifications (weekly recap + phone alerts)

Built and tested; nothing sends until you add keys. Fans choose them in Settings: "Weekly recap" and "Your player moved" are on unless turned off, the streak reminder is off unless turned on.

- **Monday, 9am Eastern:** the weekly recap email to everyone with "Weekly recap" on (the fans' #1 right now, plus a line if their #1 moved 3+ spots), and phone alerts in the app. Every email has a one-tap unsubscribe.
- **Every evening, 7pm Eastern:** a streak reminder, phone only, for fans who turned it on and haven't picked today.

Setup (after the site is live):
1. Supabase → Database → Extensions: turn on **pg_net** (pg_cron is already on). Run `schema.sql` again so the two schedules get created.
2. Supabase → Edge Functions → Deploy new function named `notify`, paste `supabase/functions/notify/index.ts`, and turn **off** "Verify JWT" (the unsubscribe link and the schedule call it without a login; it checks its own secret).
3. Edge Functions → Secrets: `NOTIFY_SECRET` (any long random text) and `RESEND_API_KEY` (same Resend account as sign-in emails). That's enough for emails.
4. SQL Editor, with your project's address and the same secret:
   `insert into app_settings values ('notify_url','https://YOURPROJECT.supabase.co/functions/v1/notify'),('notify_secret','THE SAME SECRET');`
5. Test it once by hand: `select call_notify('monday');` (only fans who haven't had this week's alert get one).
6. Phone alerts come with the phone apps: add `FCM_SERVICE_ACCOUNT` (Android) and `APNS_KEY`, `APNS_KEY_ID`, `APPLE_TEAM_ID` (iPhone). Steps in `mobile/README.md`.

## F2R Pro (payments)

Built and tested; hidden until you add Stripe links. Pro gets: up to 10 groups of 50 people (free: 1 group of 12; joining groups is always free), rank history for every week instead of the last 6, no ads, and a PRO tag. Price in the business plan: $2.99 a month (yearly optional).

1. Form the LLC and open the business bank account first (Stripe pays out to it).
2. Stripe → Product catalog → add **F2R Pro** with a monthly price (and a yearly one if you want).
3. Stripe → Payment Links → create one per price. After payment: "Don't show confirmation page", redirect to `https://floor2rafters.com/?pro=thanks`.
4. Stripe → Settings → Billing → Customer portal → turn on the login link (lets fans cancel themselves).
5. Supabase → Edge Functions → deploy `stripe-webhook` from `supabase/functions/stripe-webhook/index.ts`, "Verify JWT" **off**.
6. Stripe → Developers → Webhooks → add endpoint `https://YOURPROJECT.supabase.co/functions/v1/stripe-webhook` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy its signing secret into the function's secrets as `STRIPE_WEBHOOK_SECRET`.
7. `public/config.js` → `pro`: paste the two payment links, the portal link and the price labels (example in the file). Push.
8. Test with Stripe's test mode first (card 4242 4242 4242 4242), then switch the links to live.

The phone apps never sell Pro (Apple and Google require their own payment systems for that); fans who bought it on the website see it in the app.

## Ads

One ad slot on the Fan Board, after the top 10. Website only: never in the phone apps, never for Pro fans, never in the pick game. Off until you add AdSense ids.

1. Apply at Google AdSense with floor2rafters.com once there's steady traffic (the business plan says about 1,000 fans a week).
2. When approved: make one "Display" ad unit, then in `public/config.js` set `ads: { client: "ca-pub-…", slot: "…" }`, and replace `public/ads.txt` with the line AdSense gives you.
3. In AdSense → Privacy & messaging, turn on Google's consent message for Europe and the UK.

## Phone apps (later)

The site already works like an app: on a phone, "Add to Home Screen" gives fans an F2R icon that opens full screen. The App Store and Google Play versions are in `mobile/` and build in the cloud (no Mac needed). Steps, accounts and costs: `mobile/README.md`.

## Before you launch, double-check
- [ ] `config.js` has your keys, and sign-in works on your phone
- [ ] A real email sender (SMTP) is connected
- [ ] pg_cron is on, and `select * from cron.job;` shows `f2r-weekly-rankings`
- [ ] You've read the privacy policy and terms, and `hello@floor2rafters.com` reaches you (set up forwarding where you bought the domain)
- [ ] No NBA or team logos anywhere; player and team names only
