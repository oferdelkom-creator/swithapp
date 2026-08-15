# SwitchApp

A swipe-based marketplace for buying, selling, and swapping cars in Israel. Built with
Next.js (App Router, TypeScript, Tailwind) + Supabase.

**Live preview:** https://swithapp.vercel.app - a Vercel project linked to this repo
(`main` branch), auto-deploys on every push. No env vars were configured on it (the
Vercel tools available couldn't set them); it runs on the fallback Supabase config in
`lib/supabase/config.ts` instead - see that file's comment.

## Internationalization

English is the default language; Hebrew is fully supported and a click away (EN/עב
toggle in the header). First visit picks a locale from the browser's `Accept-Language`
header (closest available proxy to "location of use" without a geo-IP service) and
defaults to English if nothing matches; after that, an explicit cookie (`locale`) wins.
Everything - every screen, every button, dates, `car_region`/`fuel_type` labels - runs
through `lib/i18n/translations.ts`. Adding a third language is one more entry in that
file's dictionary, nothing else needs to change. See `lib/i18n/` for the implementation.

## Auth, notifications, and a Tinder-style swipe screen (2026-08-15)

Product feedback after the above, in order:

- **"Shouldn't need to log in again after registering."** Found the actual bug: signup
  never told Supabase where the confirmation-email link should redirect
  (`emailRedirectTo`), so clicking it had nothing to exchange the confirmation code for a
  session - the user landed back on the site still logged out. Fixed by pointing it at a
  new `/auth/callback` route (`exchangeCodeForSession`). "Stay logged in" itself was
  already correct - `createBrowserClient`'s defaults (`persistSession`,
  `autoRefreshToken`) handle that; nothing needed changing there.
- **Google sign-in.** `/login` now has a "Continue with Google" button
  (`signInWithOAuth`), using the same `/auth/callback` route. **This alone doesn't work
  yet** - the Google provider has to be enabled in the Supabase dashboard
  (Authentication → Providers → Google) with real OAuth credentials from a Google Cloud
  Console project, which only the project owner can create - same category of gap as the
  payment gateway. The profile-creation trigger (`handle_new_auth_user`) was also
  updated to read Google's metadata keys (`full_name`, `avatar_url`/`picture`) so a name
  and photo auto-fill correctly once Google sign-in is actually enabled.
- **"The system should tell the other side someone wants to swap with them."** Previously
  `get_incoming_likes()` was fully premium-gated - a free user had zero signal that
  anyone was interested. New migration `add_count_incoming_likes` adds
  `count_incoming_likes()`, an ungated teaser count (Tinder's actual model: "3 people
  like you!" for free, identities revealed on premium). Shows as a badge on "Who Liked
  You" in the header and as real copy on `/likes` instead of a flat "premium only" wall.
- **Icebreaker message.** "If the other side is also interested, open a match with an
  immediate chat - or an initial 'hello, interested' message." Implemented as: the moment
  a match is detected (sale or swap), auto-insert a `chat.icebreaker` message from
  whichever side just triggered the match, but only if the thread is still empty (a
  match is created exactly once, so an empty thread reliably means this is the first
  time either side has seen it - avoids re-sending on a later visit).
- **"Make the swipe screen look properly like Tinder, this looks unprofessional."** Full
  rewrite of `/swipe`: `DraggableCard` does real pointer-drag physics (translate + rotate
  following the finger/cursor, LIKE/NOPE stamps that fade in with drag distance, spring-
  back or fling-away past a 110px threshold), a peeking second card underneath for stack
  depth, full-bleed photo cards with a bottom gradient + white text overlay instead of a
  bordered card with text below, and a full-screen "IT'S A MATCH!" takeover (backdrop,
  name, straight to that match's chat) replacing the old thin green banner. Buttons at
  the bottom trigger the same animated exit as a real drag, via an imperative handle.

## Status (as of 2026-08-14)

This repo was empty until this commit. The **backend already existed** in a Supabase
project (created 2026-08-08) before any frontend code was written anywhere.

Built so far, by request, in this order: **admin panel first, then the backend it needs,
design last** (so the admin panel and everything before it is intentionally unstyled -
functional Tailwind defaults only):

- The Next.js/Tailwind/Supabase scaffold, matching the sibling starters in this workspace.
- `supabase/schema.sql`: a reconstructed snapshot of the original live schema (tables,
  RLS, functions, triggers), for version control and as a rebuild reference.
- Auth: `/login` (combined signup/signin - built because the admin panel needs *some*
  session to gate on; a DB trigger creates the `users` profile row on signup, not a
  client-side insert, matching the `hotel-trust` sibling's lesson learned).
- **New migration `add_admin_and_ban_flags`** on the live switchapp project (additive
  only - no existing column, policy, or trigger was altered or dropped):
  - `users.is_admin` / `users.is_banned` columns.
  - `is_admin(uid)` helper (security definer) + admin-only RLS policies: update any
    user (ban toggle), update/delete any car (remove listings), select/delete any
    message (see and dismiss reports), select all matches.
  - `on_auth_user_created` trigger on `auth.users` -> creates the matching `public.users`
    row (this is the piece the login flow above depends on).
  - There is **no self-serve way to become admin** (same convention as hotel-trust) -
    flip `is_admin = true` by hand in the SQL editor for whichever user should have it.
- `/admin` (gated by `is_admin`, redirects to `/login` or `/` otherwise):
  - Reports: `messages` where `kind = 'report'`, dismiss or ban-the-sender.
  - Users table: role, business name, premium status, ban/unban.
  - Car listings: owner, sale/swap flags, price, delete.
- `lib/types.ts`: TypeScript types matching the schema (including the new columns).
- `/cars` (own listings): add a car (make/model/year/mileage/transmission/fuel/region/
  price, `for_sale`/`for_swap`, `want_make`/`want_model` when swapping) and delete it.
  (Edit and photo upload came later - see below.)
- `/swipe`: toggles between the two RPCs - `cars_for_sale()` for the sale deck,
  `nearby_swap_cars()` for the swap deck (prompts for browser geolocation the first time,
  since that RPC needs `lat`/`lon` and saves it to the user's profile). Swiping right
  inserts into `swipes`; the existing `handle_new_swipe` trigger decides whether that
  creates a match, and the deck checks `matches` right after to show an "it's a match"
  banner.
- **Correction to `supabase/schema.sql`**: the first pass at reconstructing it had the
  wrong parameter order for `nearby_swap_cars()` and wrong return-column names for
  `cars_for_sale()`/`get_incoming_likes()` (guessed instead of read from the live
  `pg_get_functiondef`). Fixed now - if you called these RPCs from client code using the
  file as written before, the argument names wouldn't have matched.

- `/matches`: list of the caller's matches (other side's name, status). `/matches/[id]`:
  chat thread, realtime (`messages` was already in the `supabase_realtime` publication -
  confirmed, not changed), plus a mutual "agree to reveal phone" button per side and a
  "Report" action.
- **New migrations** `add_chat_message_kind` (adds `'chat'` to the `message_kind` enum)
  and `default_messages_kind_to_chat` (changes the column default from `'report'` to
  `'chat'`): the original enum only had `'report'`/`'hello'`, both leftover from the
  CARBOOK cross-contamination (see below) - using `'report'` as the default meant every
  ordinary chat message would have silently landed in the admin's reports queue. `'chat'`
  is now the real default; `'report'` is reserved for actual reports (the chat screen's
  "Report" button is the first thing that actually inserts one).

- `/likes` ("who liked you"): premium-gated read of `get_incoming_likes()`; non-premium
  users see an upsell message instead of a silently-empty list (the RPC itself just
  filters non-premium callers to zero rows, so the page checks `premium_until` itself to
  tell "no likes yet" apart from "not premium"). "Like back" inserts a right-swipe.
- Swipe cap: the deck now catches the RLS failure when a free user hits the 20/day limit
  and shows a real message instead of silently doing nothing.
- **Two more security fixes, same shape as the admin migration** - found while wiring up
  premium/billing, fixed before building anything on top of them:
  - `protect_privileged_user_columns` (trigger on `users`): the existing "update own
    profile" policy has no column restriction, so any signed-in user could have set
    `is_admin`, `is_banned`, `premium_until`, or `subscription_valid_until` on themselves
    via a plain client call. Now blocked unless the actor is already an admin.
  - `protect_privileged_car_columns` (trigger on `cars`): same gap for
    `listing_fee_paid`/`boosted_until` - an owner could have self-marked their listing
    fee paid or self-boosted. Same fix.
- Premium/subscription grants are admin-only for now (no payment gateway, same gap
  hotel-trust has): `/admin` gets "פרימיום ל-30 יום" per private user and "הפעלת מנוי
  ל-30 יום" per dealer/importer, plus per-car "listing fee paid" and "boost 7 days"
  toggles.
- `/business`: read-only billing status page for dealer/importer users (plan, active
  subscription date) pointing them at manual renewal, since there's no self-serve
  payment yet.

**Design pass** (the last requested item):
- `components/Header.tsx`: a shared, sticky nav rendered once in the root layout instead
  of each page inventing its own links (most inner pages - `/cars`, `/swipe`, `/matches`,
  `/admin`, etc - previously had *no* way back except typing a URL).
- `app/globals.css`: a real token set (`background`/`foreground`/`surface`/`border`/
  `muted` alongside the existing brand-blue/orange) and reusable component classes -
  `.card`, `.btn-primary`/`.btn-secondary`/`.btn-danger`, `.field` - applied across every
  screen built above, replacing one-off Tailwind strings repeated per file.
- Landing page rebuilt as an actual hero (headline, one CTA that goes straight to
  `/swipe` or `/login`) instead of a debug-looking connection-check line.

**Not built yet:** car-listing edit, photo upload, an actual payment gateway (everything
billing-related is admin-granted for now). See "Next steps".

**Swap price difference** (clarified by the product owner after the above was built,
already at "final stage" scope - see "Product concept" for the full picture): a swap
match is between two *specific* car listings, each with its own price, and the cheaper
car's owner pays the difference to complete the trade. The schema didn't actually record
*which two cars* matched (only which two users), so this needed a real fix, not just a
UI addition:
- **New migration `add_matched_cars_and_price_diff`**: adds `matches.user_a_car_id` /
  `user_b_car_id`, and rewrites `handle_new_swipe()` to populate them - for a sale match
  only the seller's side is set (the buyer isn't offering a car); for a swap match both
  sides are set, using the reciprocal right-swipe's `car_id` to identify the caller's own
  car (that data already existed in `swipes`, it just wasn't being carried into `matches`).
- `/matches/[id]` gets a `DealSummary` card above the chat: for a sale match, the price;
  for a swap match, both cars' prices and which side pays the difference (or "add a price
  to both listings" if either is missing one). `/matches` list now also shows which two
  cars matched, not just who.

**Remaining backlog, closed out** (asked to finish everything, using judgment on
anything unspecified):
- **Car-listing edit**: `/cars/[id]/edit`, same `CarForm` as create, now handles both.
- **Photo upload**: turns out a `car-photos` Supabase Storage bucket already existed
  (public read, per-user-folder write/delete via RLS - not something I set up, just
  hadn't checked `storage.buckets` before, only `public` schema tables) - the earlier
  "no bucket exists" note above was wrong. `CarForm` now uploads to
  `car-photos/{user_id}/{random}-{filename}` and stores the public URLs in
  `cars.photo_urls`; `/cars` and the swipe deck show the first photo.
- **Search/filter UI**: the sale deck already had a filterable RPC
  (`cars_for_sale(make, price range, year range, ..., region, ...)`) with no UI in front
  of it. Added a filter panel on `/swipe` (make, price range, year range, region) that
  calls the same RPC with real arguments instead of always fetching everything.

**Deliberately not attempted - need a decision or an account only you can provide:**
- **Real payment gateway.** Everything money-related right now is admin-granted (premium,
  subscriptions, listing fees) precisely because there's no processor wired in. Adding
  one needs an actual account with a provider (Stripe, Tranzila, etc - Tranzila or a
  local Israeli acquirer is the more common choice for an Israeli consumer app; Stripe
  doesn't support Israeli-based payouts directly) and business/compliance details that
  only you can supply. Tell me which provider and I'll wire up the integration.
- **International expansion, advanced search beyond what's above, a native app.** These
  were described as the "final stage" vision, not a concrete spec - region/currency
  handling, what "precise filtering" should cover beyond the sale-deck filters just
  added, and native vs. continuing web-only are product calls, not implementation
  details I should guess at. Say the word on any of these and I'll scope it properly
  instead of half-building something and needing to redo it.

## Product concept (reverse-engineered from the schema)

- Users have a role: `private` owner, `dealer`, or `importer`. Dealers/importers have a
  `billing_plan` (subscription or per-listing) - this is a two-sided marketplace where
  private owners browse for free and businesses pay to list/reach them.
- Each car can be listed `for_sale`, `for_swap`, or both.
- Swiping right on a **for-sale** car creates an instant match (like contacting a
  seller). Swiping right on a **for-swap** car only creates a match once *both* sides
  have swiped right on each other (mutual interest, like Tinder) - see
  `handle_new_swipe()`. A swap match records both cars involved; since each car can have
  its own price, the deal is "swap + the cheaper car's owner pays the difference," not a
  strict 1:1 trade.
- Matches gate a real-time chat (`messages`) and a mutual-consent phone reveal
  (`user_contacts` - both sides must agree via `user_a_agreed_to_call` /
  `user_b_agreed_to_call` before either can see the other's number).
- Free users are capped at 20 swipes/day; `premium_until` lifts the cap and unlocks
  "who liked you" (`get_incoming_likes`).
- `nearby_swap_cars()` ranks swap candidates by distance (haversine) from the user's
  `lat`/`lon`, boosted listings first.
- `cars_for_sale()` is a filterable sale-listing browse (make, price, year, mileage,
  transmission, category, color, fuel type, region, hand/owner-count).
- Access is somewhat gated by role: private users can swipe on anyone; dealers/importers
  can only swipe back at someone who already swiped right on them (stops businesses from
  cold-blasting private sellers).

## Supabase project

- Project: **switchapp** (`hltpqflqngtrmprayyvd`, eu-west-3).
- Env vars: copy `.env.local.example` to `.env.local` (already has the project URL and
  publishable anon key filled in - both are safe to expose client-side).
- Seed data exists: 7 users, 10 cars (Israeli makes/models, NIS prices, `car_region` enum
  uses Israeli regions) - looks like manually-entered test data, not real users.
- No Supabase CLI migrations are tracked for this project (`list_migrations` is empty) -
  the schema was applied directly. If you start using the Supabase CLI for local dev,
  treat `supabase/schema.sql` in this repo as the baseline to diff against.

### Known issue: one orphaned function

The live database has a function `resolve_message_recipient()` that references a
`public.plates` table and a `messages.recipient_id` column - **neither exists in this
project**. Its error message says `'No CARBOOK user is registered for plate %'`, which is
the tell: this is leftover from a *different* project ("carbook", a separate Supabase
project in the same org - a plate-number-based messaging app). It's not wired to any
trigger, so it's currently inert, not a live bug - but it's cross-contamination worth
dropping from the switchapp project when convenient (`drop function
public.resolve_message_recipient()`). Left out of `supabase/schema.sql` deliberately.

## Getting started

1. `cp .env.local.example .env.local` (already points at the switchapp project).
2. `npm install && npm run dev` (default port 3000).
3. Sign up via `/login` to create a user, then in the Supabase SQL editor:
   `update public.users set is_admin = true where id = '<your new user id>';` to reach
   `/admin`. The 7 seed users have `auth.users` rows already but their passwords aren't
   known - sign up fresh rather than trying to log in as one of them.

## Next steps

Roughly in build order:

1. ~~Auth (signup/login) + `users` profile row creation.~~ Done.
2. ~~Admin panel (moderation) + the backend flags/policies it needs.~~ Done.
3. ~~Car listing CRUD (create/delete) + swipe deck (sale and swap modes).~~ Done -
   edit and photo upload still missing, see above.
4. ~~Matches list + realtime chat + mutual phone-reveal + report action.~~ Done.
5. ~~Premium ("who liked you", swipe cap UI) + dealer/importer billing (admin-granted,
   no payment gateway).~~ Done.
6. ~~Design pass - shared header/nav, real color/component tokens, hero landing page.~~
   Done. Still a first pass, not a full brand identity (no logo, no illustration, no
   dark mode) - see below.
7. ~~Car-listing edit, photo upload, sale-deck search/filter UI.~~ Done.
8. Real payment gateway, international expansion, native app - blocked on decisions
   only the product owner can make (which payment provider, currency/region scope,
   web vs. native). See above.

## Note on testing in this environment

I could not run a live functional test of `/login`, `/cars`, `/swipe`, or `/admin`
against the real Supabase project from the sandbox this was built in - outbound network
calls to `supabase.co` are blocked by its network policy (confirmed both via direct curl
and via the app's own server-side calls, which silently returned empty/zero results
instead of erroring). `npm run build`, `tsc --noEmit`, and `eslint` all pass clean, and
the Supabase schema/RPC signatures were verified independently via the Supabase
management API (not blocked). Worth clicking through by hand once deployed or run
locally before trusting it fully.
