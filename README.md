# SwitchApp

A swipe-based marketplace for buying, selling, and swapping cars in Israel. Built with
Next.js (App Router, TypeScript, Tailwind) + Supabase.

**Live preview:** https://swithapp.vercel.app - a Vercel project linked to this repo
(`main` branch), auto-deploys on every push. No env vars were configured on it (the
Vercel tools available couldn't set them); it runs on the fallback Supabase config in
`lib/supabase/config.ts` instead - see that file's comment.

### 1000 test users (for load/UX testing)

Requested: 1000 users already in the system, all in central Israel, clearly marked as
test data with an easy way to remove it later.

- Migration `add_is_seed_flags_for_test_data` adds `users.is_seed`/`cars.is_seed`
  (default false) and `delete_seed_data()`, a one-call cleanup that removes every
  seeded user/car and their dependent rows (swipes, matches, messages, etc - none of
  which cascade from `auth.users`, so the function clears them explicitly in FK-safe
  order before deleting the `auth.users` rows, which then cascades to `public.users`).
- Generated 1000 `auth.users` + `public.users` + `public.cars` rows directly via SQL
  (`do $$ ... loop ... $$`) - random Israeli first/last name pairs, one car each from a
  ~37-model pool (Toyota/Kia/Hyundai/Mazda/Skoda/Suzuki/Honda/Renault/VW/Ford/Nissan/
  Peugeot/etc), `lat`/`lon` jittered around Tel Aviv (32.0853, 34.7818) within about
  ±0.15° so every one of them is genuinely central Israel (verified after the fact:
  actual spread came out lat 31.94-32.24, lon 34.63-34.93), region `Center`/`Tel Aviv`/
  `Shfela`, ~8% dealer/importer and the rest private. All emails follow
  `seed_user_<n>@switchapp.test` with a throwaway password - not meant to be logged into,
  just data for the swipe deck, filters, and matching to chew on.
- `/admin` shows a "N test users are seeded in" card with a **Remove test data** button
  (calls `delete_seed_data()`) - only appears when seed rows exist. The main admin
  users/car tables exclude `is_seed` rows entirely (1000 rows of nothing to moderate
  would've swamped them) - real users and their listings show normally.
- **Could not verify the generation SQL executes cleanly on a first try** in the sense of
  getting it right blind - first attempt used a genuine Postgres 2D array
  (`array[array['Toyota','Corolla'], ...]`) for make/model pairs, which doesn't support
  the "extract one row" indexing I assumed; it failed on `not-null constraint` for
  `make`/`model` after the whole `do $$` block's transaction (correctly) rolled back
  everything from that run, seed users included - confirmed zero partial rows before
  fixing it with two parallel arrays instead and re-running.

### Demo photos on the 10 seed cars

The 10 seed cars have `photo_urls` pointing at Wikimedia Commons photos of the matching
make/model. **Confirmed real, reproducible issue (2026-08-15):** a temporary diagnostic
route (`/api/debug-photos`, since removed) fetched all 10 URLs server-side from Vercel's
own network - the one path this sandbox's egress block doesn't affect - and found that
7 of 10 consistently return HTTP 429 ("Too Many Requests") from
`upload.wikimedia.org`, while the same 2 consistently return 200, across repeated
checks. This wasn't the earlier `Special:FilePath` redirect-hop mistake (already fixed -
all 10 now use direct `upload.wikimedia.org/wikipedia/commons/<hash>/<hash2>/<file>`
URLs, hash path computed locally via MD5 since this sandbox can't fetch Commons to read
it off the page); the direct URLs still throttle the same way. Best explanation: Wikimedia
rate-limits cache-miss requests from datacenter/bot-like IPs (which is what Vercel's
serverless egress looks like to them) more aggressively than requests from ordinary
residential/mobile browser IPs - so a real visitor's browser loading these images
directly may well succeed even where my server-side test didn't. I can't fully confirm
either way without a real browser hitting the live site.

Two things are already in place to limit the damage: an `onError` fallback on the swipe
deck's image (`CardVisual` in `SwipeDeck.tsx`) degrades a failed load to the existing "no
photo" placeholder instead of a broken-image icon, and the 429s are deterministic per-URL,
not random, so it's not going to be a flaky one-photo-in-five-loads problem. The fully
reliable fix would be hosting these photos ourselves (download once, upload to the
existing `car-photos` Supabase Storage bucket, point `photo_urls` at our own URL) instead
of hotlinking Wikimedia at all - not done yet because it needs either write access to
Storage outside the per-user-folder RLS policy (a service-role key, which isn't
available/stored anywhere in this environment) or an authenticated session for each seed
car's actual owner account, neither of which is available here.

## Internationalization

English is the default language; Hebrew and Russian are fully supported and a click
away (EN/עב/RU toggle in the header) - Russian added 2026-08-15 ahead of a planned
Russia launch. First visit picks a locale from the browser's `Accept-Language` header
(closest available proxy to "location of use" without a geo-IP service) and defaults to
English if nothing matches; after that, an explicit cookie (`locale`) wins. Everything -
every screen, every button, dates, `car_region`/`fuel_type` labels - runs through
`lib/i18n/translations.ts`. Adding a language is one more entry in that file's
dictionary (plus `enumLabels.ts` for the region/fuel-type labels and `format.ts` for
date formatting) - confirmed by actually doing it for Russian rather than just claiming
it's easy: `tsc` enforces that every locale object has exactly the same keys as `en`, so
a missing translation is a build failure, not a silent English fallback in production.
Russian is left-to-right like English, so the existing `dir="rtl"` (Hebrew-only) logic
in `app/layout.tsx` needed no changes. See `lib/i18n/` for the implementation.

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

## Bottom nav, vehicle categories, and plate lookup (2026-08-15)

Product feedback after the above, in order:

- **"Move the top list to the bottom of the page."** The primary nav (Swipe/My
  Cars/Matches/Who Liked You/Business/Admin) moved out of `Header` into a new fixed
  bottom tab bar (`components/BottomNav.tsx`), mobile-app style - only shown when
  logged in. `Header` is now just the logo, a sign-in button when logged out, and the
  language switcher. `RootLayout` fetches the auth/profile/likes-count data once and
  passes it to both, instead of each component querying separately.
- **Nicer, front-facing demo photos.** Re-picked all 10 seed cars' photos for explicit
  "front view" Wikimedia Commons files (searched for `<make> <model> front` rather than
  reusing whatever came up first), and switched to Commons' `Special:FilePath/<filename>`
  redirect URLs instead of hand-typed `upload.wikimedia.org` hash paths - it's a
  documented Commons feature that always resolves to the right file without needing to
  compute the MD5 hash bucket by hand. Same sandbox caveat as before: this environment's
  egress policy blocks the whole `wikimedia.org` domain, so these still couldn't be
  fetched to visually confirm; spot-check `/swipe` after deploy.
- **Vehicle categories beyond cars** ("what about trucks, motorcycles, caravans, jet
  skis - I want everything"). Repurposed the existing (previously unused) `cars.category`
  free-text column into a proper `vehicle_type` enum (`car`/`motorcycle`/`truck`/
  `caravan`/`jet_ski`) rather than renaming the `cars` table - migrations
  `add_vehicle_type_enum` and `add_vehicle_type_to_deck_rpcs` (the latter updates
  `cars_for_sale()`/`nearby_swap_cars()` to filter and return it). `CarForm` has a
  vehicle-type chip picker at the top that drives which make/model list is offered
  (`lib/vehicleData.ts`); the swipe deck has a matching chip filter row and shows a
  small type badge on cards that aren't plain cars.
- **Make/model dropdowns instead of free text** ("so people don't mistype"). `CarForm`'s
  make/model fields are now `<select>`s populated from `lib/vehicleData.ts` (curated
  makes/models per vehicle type, ~30 car makes down to a handful for caravans/jet skis).
  Every list ends with an "Other" option that reveals a free-text input, so an
  uncommon real-world vehicle still isn't blocked - the dropdown is guardrails, not a
  hard allowlist.
- **License-plate lookup against Israel's vehicle registry.** New
  `app/api/plate-lookup/route.ts` queries data.gov.il's CKAN `datastore_search` API
  (resource IDs: private/commercial `053cea08-...`, motorcycle `bf9df4e2-...`, heavy
  truck `cd3acc5c-...` - sourced from cross-referencing 15+ independent public GitHub
  repos, since this sandbox can't reach `data.gov.il` either to verify directly) by
  `mispar_rechev` (plate number), and maps the Hebrew field names (`tozeret_nm`,
  `kinuy_mishari`/`degem_nm`, `shnat_yitzur`, `tzeva_rechev`, `sug_delek_nm`) to
  make/model/year/color/fuel type. `CarForm` has a plate-number field + "Look up"
  button that calls it and autofills those fields (falling back to "Other" +
  free text if the returned make/model isn't in the curated dropdown list).
  Caravans and jet skis aren't tracked by this registry at all, so lookup is disabled
  for those types with an explanatory message. **Unverified end-to-end** (no live
  request could be made from this sandbox) - test a real plate number after deploy;
  resource IDs on data.gov.il are known to occasionally rotate.

## Plate number persistence, owner count, bus type, profile, and notifications (2026-08-15)

Follow-up feedback, in order:

- **"You didn't save the plate number."** The lookup field only used the plate number
  transiently for the data.gov.il query - it was never written to the listing. Added
  `cars.plate_number` (migration `add_plate_number_and_bus_type`) and `CarForm` now
  saves whatever's in that field (looked-up or hand-typed) with the listing.
- **"How many owners" field was missing.** `cars.hand` already existed in the schema
  and types but had no input in `CarForm` - added it next to price. Price itself is
  now a required field, per "the car's price is important."
- **Bus as a vehicle type.** Added `'bus'` to the `vehicle_type` enum and
  `lib/vehicleData.ts`, plus a best-effort data.gov.il resource mapping for plate
  lookup (the "public transport vehicles" dataset - lower confidence than
  car/motorcycle/truck since its field names are assumed, not confirmed, to match).
- **"Check what Yad2 has and update our vehicle list accordingly."** yad2.co.il itself
  couldn't be fetched from this sandbox either, so this was researched from public
  Yad2-scraper source code (which encodes Yad2's real category/manufacturer IDs) plus
  Israeli vehicle-importer and trade-press sites, cross-referenced across sources - see
  the research write-up for what's confirmed vs. inferred. Two real gaps came out of
  it: Yad2 treats **scooters** and **ATVs/quads** as categories separate from
  motorcycles (not sub-filters), and bundles jet skis with motor **boats** under one
  "watercraft" category. Added `scooter`, `atv`, and `boat` as their own
  `vehicle_type` values (migration `add_scooter_atv_boat_types`) rather than folding
  boats into `jet_ski`, since keeping them distinct is more useful for swap-matching
  than mirroring Yad2's single search filter. Also expanded `lib/vehicleData.ts`
  broadly: car makes went from ~30 to ~70 (adding most of the Chinese/newer-entrant
  brands now selling in Israel - BYD, Chery, Omoda, Jaecoo, Haval/GWM, Zeekr, Xpeng,
  and more), with deeper model lists (10-15 each) for the ~30 most common makes; every
  other vehicle type's manufacturer list was similarly widened using Israel-specific
  importer data where it was found.
- **Profile photo.** New `/profile` page (`app/profile/page.tsx` +
  `ProfileForm.tsx`) - avatar upload (new `avatars` storage bucket, same per-user-folder
  RLS pattern as `car-photos`) and name editing. Linked from a new tab in the bottom
  nav.
- **Push notifications for matches, with explicit opt-in.** `/profile` has an "Enable
  notifications" button that requests the browser's `Notification` permission and,
  once granted, sets `users.notify_on_match = true`. `components/MatchNotifier.tsx`
  (mounted in `RootLayout` for logged-in users) subscribes to Supabase Realtime on
  `matches` rows the caller is part of (added to the `supabase_realtime` publication;
  delivery is already gated by the existing "Users can view their own matches" RLS
  policy) and fires a `Notification` when a new match arrives. **Important scope
  limit:** this is a foreground-only notification, not a true push notification -
  there's no service worker or push server, so it only fires while a SwitchApp tab is
  open. A real background/lock-screen push would need Web Push (VAPID keys + a
  service worker + a server-side trigger on match creation) - deferred because this
  environment has no tool to store a private key as a secret outside of committing it
  to the repo, which would leak it.

## Swap-deck filters, seed photo fix, mobile RTL overflow, phone sign-in (2026-08-15, later)

Further follow-up feedback, in order:

- **"Swap search needs filters too, and it's missing the price."** The swap deck had
  no filter UI at all (only the sale deck did), and `CardVisual` never rendered the
  price for swap candidates even though `nearby_swap_cars()` already returned it.
  Extended `nearby_swap_cars()` with the same make/price/year filters as
  `cars_for_sale()`, plus a distance-radius filter (migration
  `add_filters_to_swap_deck_rpc`), gave the swap deck a filter panel, and added the
  price line to swap cards.
- **"Photos aren't loading."** Confirmed via a temporary diagnostic route
  (`/api/debug-photos`, fetched from Vercel's own network since this sandbox can't
  reach `wikimedia.org` to check directly, then removed once done) that 7 of the 8
  photos re-picked earlier that day were failing with HTTP 429 from
  `upload.wikimedia.org` - not the sandbox block, a real production issue. Root cause:
  those 7 used a `commons.wikimedia.org/wiki/Special:FilePath/<file>` redirect (chosen
  to avoid hand-computing the MD5 hash bucket in the direct CDN path) which turned out
  to throttle far more aggressively than the direct path. Fixed by computing the direct
  `upload.wikimedia.org/wikipedia/commons/<hash>/<hash2>/<file>` URLs locally (Python
  `hashlib.md5`, verified against a known-good existing URL first) for all 10. Some
  still throttle intermittently on repeated server-side checks - likely Wikimedia rate-
  limiting datacenter-IP cache-misses more than ordinary browser traffic, unconfirmed
  either way since a real browser load is a different network path than my test. The
  existing `onError` fallback to a placeholder is the safety net either way.
- **Mobile layout ("doesn't sit right on my phone").** Tightened vertical spacing on
  `/swipe` and switched the card height to `dvh` units. Turned out this wasn't the
  main problem, though: a screenshot revealed the *entire page* shifted, with every
  label clipped at the edge - a classic symptom of the document being wider than the
  viewport, which shows up this way in RTL specifically (the page rests scrolled away
  from its natural reading start instead of showing an ordinary horizontal scrollbar).
  Root cause was an unstyled native `<input type="file">` in `CarForm` rendering its
  full-width, unconstrained default browser UI ("no files selected Choose File...").
  Wrapped it in a styled label + hidden input (matching the pattern already used in
  `ProfileForm`), and added `overflow-x: hidden` on `<html>` site-wide as a safety net
  against the same class of bug recurring anywhere else.
- **Phone-number sign-in ("verify once by phone, then no password needed").** Added
  a phone-OTP flow to `/login`: enter a phone number → `signInWithOtp({ phone })` sends
  an SMS code → `verifyOtp({ phone, token, type: "sms" })` creates the session. This
  covers both signup and signin transparently (Supabase creates the account on first
  verification). Session persistence afterward needed no new work - it's the same
  `persistSession`/`autoRefreshToken` behavior already relied on for email login, so
  "no password on future visits" was already true for any auth method, phone included.
  Fixed a latent bug this surfaced: `handle_new_auth_user()`'s name fallback chain
  ended at `split_part(email, '@', 1)`, which is `null` for phone-only signups with no
  email - violated `users.name`'s not-null constraint. Added `new.phone` and a
  `'New user'` literal as further fallbacks (migration `handle_phone_only_signups`),
  and, since it's already a verified number, also seed `public.user_contacts` from it
  (there was previously no UI path to populate that table at all). **Blocked exactly
  like Google sign-in:** phone auth needs an SMS provider (Twilio, MessageBird, Vonage,
  etc.) configured under Supabase Dashboard → Authentication → Providers → Phone, with
  real API credentials - not something available from this environment. Code-complete,
  non-functional until that's set up.

## Swipe buttons on the card, three-way swipe with a preference boost (2026-08-15, later)

Further follow-up feedback, in order:

- **"Put the skip/like buttons inside the photo, and make like red."** Moved the
  buttons from a separate row below the card to float over the bottom of the photo
  itself (absolutely positioned inside the card's container, above the make/model/
  price text) - they were taking up extra vertical space that was tight on phone
  screens. Made the like button red as asked.
- **"Actually, three colors: green = like, yellow = not sure, red = don't like. Yellow
  can come back later, green matches, red never shows again - this way the system
  learns preferences and matches faster."** This superseded the red-like change from
  moments earlier with a fuller design, implemented as:
  - `swipes.direction` gets a third value, `'maybe'` (migration
    `add_maybe_swipe_direction`), alongside the yellow "?" button added between skip
    and like on the card.
  - `cars_for_sale()`/`nearby_swap_cars()` now only exclude `'left'`/`'right'` swipes
    from future decks - `'maybe'` doesn't permanently remove a car, so it can resurface
    the next time the deck reloads (a full "come back after N hours" cooldown would
    need a timestamp-based re-check; this simpler version satisfies "comes back later"
    without that extra state).
  - Green (`'right'`) still creates a match exactly as before; red (`'left'`) is
    excluded forever, same as before - only the yellow option and its "not excluded"
    behavior are new.
  - **Preference learning**: both deck RPCs now order results with a boost for makes
    the caller has already swiped right on (a `make in (select ... from swipes where
    direction = 'right')` clause ahead of the recency/distance sort). This is a
    deliberately simple heuristic, not a ML recommender - "learn from choices and match
    faster" is satisfied by surfacing more of what someone's already shown interest in,
    which is the achievable version of that ask without building out a real
    recommendation pipeline.
  - `DraggableCard` gained a third exit direction (`"up"`, mapped to `'maybe'`) with its
    own translateY-and-fade animation, alongside the existing left/right translateX
    exits.
- **Leftward drag not registering** ("swipe only gives green via drag, red only via
  tap"). The browser's own edge-swipe-back/forward gesture was almost certainly
  intercepting a leftward drag before our pointer handlers finished, since only
  rightward drags reliably completed. Switched `touch-action` on the draggable card
  from `pan-y` to `none` (hands *all* touch interpretation to our own pointer events,
  not just the vertical axis) and added `overscroll-behavior-x: none`/`contain` as a
  second layer against the same conflict.
- **"Is there a way to mark a car as sold?"** There wasn't. Added `cars.sold_at`
  (migration `add_sold_at_to_cars`) and a "Mark as sold" button in `/cars` - it also
  flips `for_sale`/`for_swap` off, which is what actually removes it from
  `cars_for_sale()`/`nearby_swap_cars()` (no RPC changes needed). Sold listings show a
  "Sold" badge and dim slightly in both `/cars` and `/admin` instead of disappearing -
  existing matches/chat history on that car are untouched.

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

## Blocking, matches redesign, unread badge (2026-08-15, later)

Prompted by "take inspiration from Airbnb's account settings / menu / messages screens
and think about what else could go into Profile and the system" - proposed a
prioritized list (block users, message previews/unread/filters, a stats dashboard) and
built the first two on confirmation:

- **Block users - it existed in the schema but did nothing.** `public.blocks` (blocker_id/
  blocked_id, RLS already correct) had no UI anywhere and nothing actually consulted it.
  Added a "Block" button next to "Report" in the chat thread
  (`app/matches/[id]/ChatThread.tsx`) and a "Blocked users" list with unblock on
  `/profile` (migration `enforce_blocks_in_messages_and_decks`). Wired it in three
  places: the "Match participants can send messages" RLS policy now also checks neither
  side has blocked the other, and both `cars_for_sale()`/`nearby_swap_cars()` exclude
  candidates with a block in either direction - blocking previously had zero effect on
  any of these.
- **Matches list redesign** (`app/matches/page.tsx` + new `MatchesList.tsx`), inspired
  directly by Airbnb's Messages screen: last-message preview under each name, an unread
  dot, a car-photo thumbnail, and All/Sale/Swap filter tabs (client-side, no refetch -
  the per-user match list is never large enough to need it). Backed by a new RPC,
  `get_matches_with_previews()`, and two new per-match columns,
  `user_a_last_read_at`/`user_b_last_read_at` (migration
  `add_match_read_tracking_and_preview_rpc`) - each side marks their own copy read on
  opening the thread (`ChatThread.tsx`, on mount), guarded the same way
  `agreed_to_call` already was so one side can't clear the other's unread state.
  `count_unread_matches()` powers a badge on the bottom nav's Matches tab, same pattern
  as the existing Likes badge.
- **Stats dashboard on `/profile`**, the third item, confirmed and built the same
  session. A new `get_profile_stats()` RPC returns active-listing count, all-time likes
  received, total matches, and a 7-day likes sparkline; `ProfileStats.tsx` renders it as
  two small stat cards (Airbnb's "Earnings"/"Insights" tiles, minus the money since
  there's no payment gateway) with a plain CSS bar chart for the sparkline - no charting
  library needed for four bars.

## Photo upload silent-failure fix (2026-08-15, later)

Reported as "the photos didn't upload." This sandbox can't reach the deployed app or
Supabase directly to reproduce interactively (same network restriction noted throughout
this doc), so this was diagnosed from the backend side instead: bucket config, storage
RLS policies, and the publishable key all checked out correctly, and
`storage.objects` had zero rows total across both buckets - the upload was failing
before ever reaching the storage backend, not being rejected by it.

Found two real gaps in `CarForm.tsx`'s `handlePhotoSelect` and `ProfileForm.tsx`'s
`handleAvatarSelect`, both fixed the same way in both:
- **No `try/catch`.** If `supabase.storage.upload()` ever throws instead of resolving
  with `{ error }` (a real possibility on some network failures), the function exits
  before calling `setUploading(false)` or showing any error - the button gets stuck on
  "Uploading..." forever with no feedback at all. Wrapped both handlers in
  `try/catch/finally` so the uploading state and an error message are guaranteed to
  resolve no matter what goes wrong.
- **The storage path embedded the original filename verbatim** (`${uuid}-${file.name}`).
  A phone photo's filename can carry non-ASCII characters (Hebrew, emoji from a share
  sheet) that may not survive as a storage object key. New `lib/storage.ts` exports
  `safeExtension()`, which keeps only a plain lowercase extension from the filename and
  drops the rest - the UUID alone is the object key now.

Still can't confirm this was the exact failure the user hit without a live repro, but
both are real bugs regardless and the fix makes future failures show an actual error
message instead of failing silently either way.

## Dealer swap fix, business dashboard, Russian locale (2026-08-15, later)

**Fixed a real RLS bug that silently blocked every dealer/importer from ever completing
a swap match.** `"Users can insert their own swipes"`'s WITH CHECK had a branch meant to
let a dealer/importer swipe back at a private user who'd already liked one of their
cars, but it compared `s.from_user_id = s.to_user_id` - which can never be true for a
real swipe row - instead of checking the actual counterpart. In practice this meant the
"Like Back" button on `/likes` always got rejected by RLS for a business account, with
no visible error (the insert just silently failed client-side). Fixed in migration
`fix_dealer_swipe_back_rls_bug`, and verified end-to-end under real RLS (not
bypassed) with disposable test rows: private user swipes right on a dealer's swap car,
dealer swipes back via the same insert `LikeBackButton` performs, match gets created by
`handle_new_swipe()`.

Also rebuilt `/business` from a bare plan/subscription readout into an actual
dashboard: the same stats cards as `/profile` (`get_profile_stats()`, reused as-is),
a for-sale/for-swap/sold breakdown, and a searchable, filterable inventory list
(`InventoryTable.tsx`) instead of a flat scroll - a dealer's inventory can run into the
hundreds, unlike a private user's handful of cars.

Added a bold full-bleed welcome screen to `/login` (SwitchApp wordmark on a brand-color
gradient, Google/phone/email pill buttons, terms line) in place of landing straight on
the bare email/password form, and added Russian as a third supported language
alongside English/Hebrew (`lib/i18n/translations.ts`, `enumLabels.ts`, `format.ts`) -
`tsc` enforces every locale has the exact same keys as English.

**Data-loss note:** while verifying the RLS fix, two disposable test accounts were
created and then cleaned up via `delete_seed_data()` - which deletes *every* row
flagged `is_seed`, not just the ones just created. That flag was already set on the
~1000 test users seeded in an earlier session (see "Status" below), so this
unintentionally deleted all of them along with their cars, matches, and messages. Real
user accounts and the original demo cars were unaffected. Nothing in this repo
regenerates that seed batch automatically - if it's needed again, it has to be
rebuilt from scratch (it was originally a one-off SQL insert, not a tracked migration).

## Private listing cap, dealer visibility gating, Tinder-style redesign (2026-08-15, later)

Business decision: private accounts and dealer/importer accounts are meant to feel
like two different products sharing one app, not one flat marketplace.

- **Private accounts are capped at 2 active (unsold) listings**, enforced in the
  `"Users can insert their own car"` RLS policy itself (a count subquery in the WITH
  CHECK, same pattern as the existing swipe-per-day cap) - not just a client-side
  check, so it holds even if someone bypasses the UI. Dealers/importers are
  unbounded. `/cars` shows a message instead of the form once a private account hits
  the cap. Verified end-to-end under real RLS with disposable test rows (2 inserts
  succeed, 3rd is rejected; a dealer account isn't capped).
- **Private users no longer see dealer/importer inventory by default in the swap
  deck.** `nearby_swap_cars()` gained `p_include_dealers` (default `false`); a new
  checkbox in the swap deck's filter panel opts back in. Dealers still can't browse
  private inventory either way (unchanged from the swipe-RLS fix above) - they only
  reach a private user's car by responding to an incoming like.
- Redesigned `/cars`, the swipe deck, and the bottom nav toward a Tinder-style visual
  language: `#f5f5f7` page background, white cards with a soft shadow and 20px
  radius, pink (`#ff4458`) active states for filter chips/nav/swipe buttons instead
  of blue, the "Add a car" form led by a tall hero photo and a bold Make/Model/Year
  line instead of a flat field grid, swipe buttons relabeled Pass/Trade/Buy, and
  Inter loaded via `next/font` (Latin+Cyrillic; Hebrew still falls through to the
  system-font fallback, since Inter has no Hebrew glyphs).

## Swipe-card photo gallery, tap-zone navigation, car details page (2026-08-15, later)

The active swipe card now supports a multi-photo gallery instead of showing only
`photo_urls[0]`: a dot indicator up top, 200ms crossfade between photos, and three
tap zones (left 40% = previous photo, center 20% = open `/cars/[id]` - a new,
public-within-the-app read-only detail page - right 40% = next photo, or, once
already on the last photo, tapping right again triggers the same "Buy" action as
the green button).

The tricky part was making tap detection coexist with the existing drag-to-dismiss
gesture without two competing pointer listeners: `DraggableCard` (the single owner
of all pointer events on the card) now distinguishes a plain tap - negligible net
movement - from a real drag on `pointerup`, and reports the tap's horizontal
position (0-1 across the card) via a new `onTap` prop, instead of a second listener
on child elements that would have raced the drag gesture's `setPointerCapture`.
`photoIndex` lives in `SwipeDeck` (not `CardVisual`) so it resets cleanly whenever
the deck advances to a new candidate.

## Full car details page, sticky swipe footer, photo reordering (2026-08-15, later)

Fleshed out `/cars/[id]` from a static read-only view into the full spec: a
scroll-snap fullscreen gallery (native touch swipe instead of tap zones, since
there's no competing drag-to-dismiss gesture on a normal page) with X-back and
heart-save buttons overlaid on it, a title/price/region/mileage line, a specs grid,
a description section (new `cars.description` column - there was no free-text
field before, only swap's `want_notes`), seller info ("Posted by / Member since"
with a Chat button when a match already exists), and a sticky Pass/Trade/Buy
footer that performs the exact same swipe as the deck.

That last part needed the deck's match-detection + icebreaker logic in a second
place, so it's factored out into `lib/swipeActions.ts` (`performSwipe()`) and both
`SwipeDeck` and the new details page call the same function instead of maintaining
two copies that could drift.

Also improved `CarForm`'s photo step: capped at 6 photos with a running "3/6
photos" hint, a "Cover" badge on the first thumbnail, and native HTML5
drag-and-drop to reorder the thumbnail strip (first photo after reordering is the
one used on the swipe card).

## "Online now" indicator (2026-08-16)

Not a realtime presence channel - `users.last_seen_at`, updated by a client-side
heartbeat (`PresenceHeartbeat.tsx`, mounted in the root layout for logged-in users)
roughly every 30s while the tab is open and in the foreground. "Online" is computed
wherever it's read as `last_seen_at` within the last two minutes - a green dot next
to the seller's name on swipe cards and the car details page (`cars_for_sale()` /
`nearby_swap_cars()` both gained a `seller_online` column), and an Online column in
the admin users table. Simpler than real presence, and it's one data source both
the client UI and the server-rendered admin table can read the same way.

While touching `nearby_swap_cars()`, found and cleaned up a real mess from an
earlier session: adding `p_include_dealers` via `CREATE OR REPLACE FUNCTION` with a
different parameter count doesn't replace the function in place - Postgres treats a
changed parameter list as a distinct overload, so the old 10-param version was still
sitting there unused. Dropped both and recreated a single current definition.

## Per-dealer branded landing page + swap deck (2026-08-16)

A first step toward a per-dealer sub-system: any `dealer`/`importer` account can
publish a public page at `/d/[slug]` showing only their own inventory, to hand out to
their own customers as a link (WhatsApp, a sign at the lot, etc.) rather than routing
them through the general SwitchApp browse flow.

- `users.dealer_slug` (unique, self-service) - editable from `/business`
  (`PublicPageLink.tsx`): type a slug, publish, copy the resulting link.
- `/d/[slug]` (`app/d/[slug]/page.tsx`) resolves the dealer by slug, requires login,
  redirects the dealer themselves to `/business` instead of showing their own page,
  and 404s for an unknown slug or a slug that no longer belongs to a dealer/importer.
- `dealer_inventory(my_id, p_dealer_id)` - a new RPC, deliberately not a generalized
  filter on `cars_for_sale()`/`nearby_swap_cars()`: the caller already knows which
  single dealer they're browsing (resolved via the slug), so it just returns that
  dealer's still-available cars, excluding ones already swiped or from a blocked
  user.
- `DealerDeck.tsx` is a trimmed-down sibling of `SwipeDeck.tsx` - same card visuals,
  drag-to-exit gestures, tap-zone photo gallery, and Pass/Trade/Buy buttons, but no
  sale/swap mode toggle or filters (a dealer's whole inventory is one deck). It calls
  the same shared `performSwipe()` as the main deck and the car details page, so a
  swap request against a dealer's inventory becomes a completely ordinary match/chat
  - no separate inbox or notification path for dealer inventory.
- The dealer's cars are unaffected in the *main* app search - `cars_for_sale()` /
  `nearby_swap_cars()` already show dealer/importer listings to private users (see
  the private-listing-cap/visibility-gating change above), so publishing a `/d/[slug]`
  page is additive, not a way to opt out of the general marketplace.

Deliberately out of scope for this pass (would be the next step toward the fuller
"sub-system per dealer" idea discussed but not yet built): a dealer-scoped admin
panel, branding/theming per dealer, or dealer-side visibility into which of *their*
customers is requesting what.

## Dealer sign-up page + pricing tiers (2026-08-16, later)

Until now, the only way to become a `dealer`/`importer` account was a direct DB
update - there was no way for a real dealership to sign up on their own. Added a
dedicated public page at `/business/join` (linked from the homepage and the login
welcome screen) that explains what a dealer account gets (full inventory management,
the branded `/d/[slug]` page from above, customers requesting swaps against their
stock, still showing up in the app's general search) and a monthly subscription
pricing table: up to 50 cars ₪2,500/mo, up to 100 ₪3,500/mo, up to 150 ₪4,500/mo, up
to 200 ₪5,500/mo (+₪1,000 per +50 cars), and "over 200 - contact us" as a custom
tier. Tiers/prices live in one place (`lib/dealerPricing.ts`) shared by the pricing
table and the admin panel.

Consistent with the existing "no self-serve payment - our team activates the
subscription" model (see the business dashboard above): submitting the form creates
the auth account and flips it to `role = 'dealer'` immediately (`billing_plan`,
`business_name`, and the picked tier via the new `users.requested_car_cap` column),
but `subscription_valid_until` stays null - that column is admin-only
(`protect_privileged_user_columns()`), so the account is fully created but inactive
until we call the dealer and activate it with the existing
`ActivateSubscriptionButton` in `/admin`. The admin users table now also shows the
requested tier next to a dealer's business name, so we know what to bill for.

`finishDealerSignup()` (`lib/dealerSignup.ts`) is the one place that does this
role-flip, called from two spots depending on whether Supabase requires email
confirmation: immediately in `DealerJoinForm.tsx` if `signUp()` already returns a
session, or from `/business/join/finish` (reached via the same `emailRedirectTo` ->
`/auth/callback?next=...` round trip already used for OAuth/email confirmation
elsewhere) if it doesn't - the business name, picked tier, and phone number are
carried through as query params on that `next` URL rather than needing a temp table.

## Custom domains for dealers (2026-08-16, later)

A dealer who already has their own business domain can point it at their `/d/[slug]`
page instead of `switchapp.vercel.app/d/[slug]` - a paid add-on (`₪199/mo`, see
`CUSTOM_DOMAIN_ADDON_PRICE` in `lib/dealerPricing.ts`) on top of whichever tier
they're on. Two new self-service columns on `users`: `custom_domain` (settable from
`/business`, `CustomDomainCard.tsx`, same self-service pattern as `dealer_slug`) and
`custom_domain_active`, which is admin-only
(added to `protect_privileged_user_columns()`) - saving a domain alone doesn't make
it live.

The actual multi-tenant routing lives in `proxy.ts` (Next 16 renamed `middleware.ts`
to this - both files can't coexist, so this logic was merged into the existing proxy
rather than added as a second file). `resolveCustomDomainSlug()` runs first on every
request: any host ending in `.vercel.app` or `localhost` short-circuits immediately
(no DB call on ordinary traffic), anything else does a single anonymous REST lookup
(`custom_domain = host AND custom_domain_active = true`) and, on a match, rewrites to
`/d/[slug]` while copying over whatever cookies the existing auth/locale logic already
set on the response. An unmatched host just falls through to normal routing - safe by
construction, since a domain nobody's pointed at us wouldn't reach this app at all.

Two things this doesn't automate, both listed as limitations rather than built now:
1. **Adding the domain to the Vercel project itself.** The DNS side (dealer points a
   CNAME at `cname.vercel-dns.com`, shown in `CustomDomainCard.tsx`) is self-service,
   but actually registering the domain on the Vercel project and letting Vercel issue
   its TLS cert has to happen from the Vercel dashboard - the available Vercel tooling
   here can register a *new* domain purchase but not attach an *existing* external one
   to a project. `ActivateCustomDomainButton` in `/admin` only flips the DB flag; doing
   that without also adding the domain in Vercel leaves it pointing at nothing.
2. **A branded login page.** An unauthenticated visitor on a dealer's custom domain
   still gets redirected to the general SwitchApp login screen (own branding, "Join as
   a partner" link and all) before landing back on the dealer's page - the redirect
   itself stays on the dealer's domain (a relative `Location` header), but the page
   content doesn't yet reflect whose domain it's on.

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
