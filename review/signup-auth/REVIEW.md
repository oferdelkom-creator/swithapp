# SwitchApp signup authentication review only

Baseline: 794c3a99bfc73f2dcf9302dd93f50c2236d7c742
No push, deployment, hosted settings, database migration or real signup was performed.

## Diagnosis and changes
- Current PKCE email code callback needs the initiating browser's verifier and ignored exchange errors. This explains a plausible cross-device failure; no production failure logs were used to prove a specific incident.
- New /auth/confirm GET serves an isolated Hebrew HTML landing, no scripts/trackers, no-store and no-referrer. It does not consume tokens. The explicit same-origin POST verifies a token hash using Supabase verifyOtp(type=email), sets the server-client session cookies, and redirects without the token. A new device does not need the original PKCE verifier. Failed/expired/uncertain outcomes fail closed and do not resend/retry.
- Confirmation template draft: confirm-signup-he.html, subject suggestion: "אימות כתובת המייל שלכם | SwitchApp". Dealer links go to switchautoai.com; consumers to www.switchapp.co.il. Requires a separately approved hosted Supabase Confirm signup template update AFTER deployment. Existing messages already sent cannot be retroactively fixed. Keep SMTP credentials unchanged; never expose keys. No guarantee about inbox/spam placement.
- New dealer signup data is carried as user-editable user_metadata.dealer_signup draft, not authorization claims, with strict fields/role/plan validation. New redirect URLs omit business/phone PII. Supabase RLS remains authoritative. No service-role client or privilege bypass.
- Finish verifies authenticated identity, refuses admins/unknown roles, does not overwrite existing dealer/importer records, and uses a conditional private-role update with returned row check (zero rows are failure). Business login allows validated unfinished private accounts to reach completion, not an authorized dealer dashboard.
- Strict Mode effect duplicate execution guarded. Existing best-effort phone contact update remains non-atomic with profile update, a known limitation; no migration in this package. A failure after confirmation may leave email verified but profile incomplete; authenticate by password and review before retrying. Existing users created without draft metadata require support/legacy link details, not guessed profile reconstruction.
- Callback next path restricted to local navigation; PKCE/OAuth errors no longer look successful. OAuth still uses its original same-browser PKCE flow.
- Free/499 plans and disabled sale commission remain intact. Ad management 20% unchanged. No payment activation added.

## Verification
- node --test tests/*.test.cjs: 43/43 passed (mocked provider/database).
- TypeScript --noEmit: passed.
- Next16.3.0 production build: passed, including /auth/confirm.
- Targeted ESLint: zero errors/warnings.
- Build used NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 and dummy anonymous key, telemetry disabled.
- Live read-only signup audit confirms commission removal at baseline; no signup submitted.
- No actual two-device email delivery/confirmation test or live RLS test. Hosted auth cookie behavior and the Go template must be validated after separate approval in staging/test first; do not claim full end-to-end production verification.

## Review and release sequence (NOT executed)
1. Review code and security boundaries, especially existing RLS/role-change policies and the non-atomic contact update.
2. After owner approval, deploy code to both connected projects; back up current auth template/settings; apply the Hebrew Confirm signup template with exact trusted domain links. Disable click tracking for auth email only if separately authorized. No DNS/key change required by this code.
3. Separately authorized single external signup: choose free plan, open email on second device, click confirmation once, verify session and dealer profile/plan; repeat-link should not reset the profile. Check consumer confirmation/OAuth and expired link without blind retries. User may do the real signup.
4. Rollback: restore prior template before reverting code so newly issued links remain compatible. Keep confirmation route available for already-issued token-hash links through their expiration, or coordinate maintenance. Do not restore old code first and strand links. No automatic rollback or DB deletion.

## Sources checked
https://supabase.com/changelog.md
https://supabase.com/docs/guides/auth/auth-email-templates
https://supabase.com/docs/guides/auth/server-side/nextjs

Package contains source files plus tracked changes.patch. New files are in source/ and manifest. Do not commit .review-tools, node_modules or build outputs.
