# SwitchApp

A swipe-based marketplace for buying, selling, and swapping cars in Israel. Built with
Next.js (App Router, TypeScript, Tailwind) + Supabase.

## Status (as of 2026-08-14)

This repo was empty until this commit. The **backend already existed** in a Supabase
project (created 2026-08-08) before any frontend code was written anywhere - this commit
is the first application code for the product. It sets up:

- The Next.js/Tailwind/Supabase scaffold, matching the sibling starters in this workspace.
- `supabase/schema.sql`: a reconstructed snapshot of the live schema (tables, RLS,
  functions, triggers), for version control and as a rebuild reference.
- `lib/types.ts`: TypeScript types matching the schema.
- A minimal landing page that confirms the Supabase connection.

**Nothing else is built yet** - no auth flow, no swipe deck, no matches/chat UI. See
"Next steps" below.

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

## Next steps

Roughly in build order:

1. Auth (signup/login) + `users` profile row creation, matching the `hotel-trust`
   sibling's pattern (DB trigger on `auth.users` insert, not client-side insert).
2. Car listing CRUD for the logged-in user (create/edit/delete own cars, set
   `for_sale`/`for_swap`/`want_*`).
3. Swipe deck: two modes (sale browse via `cars_for_sale()`, swap browse via
   `nearby_swap_cars()`), calling `swipes` insert on each swipe.
4. Matches list + chat (`messages`), with the mutual phone-reveal flow
   (`user_contacts` + `user_a_agreed_to_call`/`user_b_agreed_to_call`).
5. Premium: "who liked you" screen (`get_incoming_likes()`), swipe cap UI, upgrade flow.
6. Dealer/importer billing (`billing_plan`, `subscription_valid_until`,
   `listing_fee_paid`, `boosted_until` for paid listing boosts).
