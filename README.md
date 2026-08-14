# SwitchApp

A swipe-based marketplace for buying, selling, and swapping cars in Israel. Built with
Next.js (App Router, TypeScript, Tailwind) + Supabase.

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

**Not built yet:** the actual marketplace UI - car listing CRUD for regular users, the
swipe deck, matches/chat, premium, dealer billing. See "Next steps".

## Product concept (reverse-engineered from the schema)

- Users have a role: `private` owner, `dealer`, or `importer`. Dealers/importers have a
  `billing_plan` (subscription or per-listing) - this is a two-sided marketplace where
  private owners browse for free and businesses pay to list/reach them.
- Each car can be listed `for_sale`, `for_swap`, or both.
- Swiping right on a **for-sale** car creates an instant match (like contacting a
  seller). Swiping right on a **for-swap** car only creates a match once *both* sides
  have swiped right on each other (mutual interest, like Tinder) - see
  `handle_new_swipe()`.
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
3. Car listing CRUD for the logged-in user (create/edit/delete own cars, set
   `for_sale`/`for_swap`/`want_*`).
4. Swipe deck: two modes (sale browse via `cars_for_sale()`, swap browse via
   `nearby_swap_cars()`), calling `swipes` insert on each swipe.
5. Matches list + chat (`messages`), with the mutual phone-reveal flow
   (`user_contacts` + `user_a_agreed_to_call`/`user_b_agreed_to_call`).
6. Premium: "who liked you" screen (`get_incoming_likes()`), swipe cap UI, upgrade flow.
7. Dealer/importer billing (`billing_plan`, `subscription_valid_until`,
   `listing_fee_paid`, `boosted_until` for paid listing boosts).
8. Design pass (requested last, on purpose) - brand palette, real visual design across
   every screen above, replacing the plain Tailwind defaults.
