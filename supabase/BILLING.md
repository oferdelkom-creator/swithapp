# SwitchApp billing (2026-10-12)

Every service provider pays ILS 499/month including VAT, setup and inventory management. There is no separate setup fee, per-vehicle charge, minimum inventory charge or small-plan inventory limit. Legacy plan identifiers remain for compatibility.

Inventory events and counters remain for reporting; inventory count no longer sets the subscription price. Month boundaries use Asia/Jerusalem. The ILS 499 activation payment covers the first calendar month, including a partial month. That month is excluded from recurring orders. Subsequent months cost ILS 499 at month end. Existing invoices and completed payments are preserved. Existing users are not automatically enrolled or charged retroactively.

The Supabase dealer-billing Edge Function authenticates customer actions through auth.getUser. Provider webhooks require server-side GetLpResult verification of amount, currency, terminal, order reference and charge operation. Recurring tokens are service-role-only. Provider credentials and the scheduler secret live in Supabase Vault under switchapp_cardcom and are not committed.

The hourly scheduler prepares one invoice per closed calendar month and enrolled account. Cardcom token requests use the order UUID as ExternalUniqTranId with replay-return enabled. Pending transport errors retain that ID; explicit declines require review rather than uncontrolled retries. Successful payments issue a Cardcom TaxInvoiceAndReceipt by email. Document failures are marked for review without issuing another charge. Cancellation stops future subscription periods; the current period is settled at its end under the accepted terms.

Campaign pricing is an estimate/offer: client-selected media budget plus 20% management on actual spend. Campaign authorization and spend reconciliation are separate from the maintenance mandate; draft campaign budgets are never used as actual spend and are not charged by this worker.

Validation: production Next build; 8 node tests; live SQL tests rolled back (counter increments/decrements, retained peak after sale, unique monthly bill, ILS 2,050 for peak 41, service-role activation and idempotency, privilege checks). Cardcom accepted a ChargeAndCreateToken payment-page initialization without payment. No real credit-card charge was performed. Live readiness returns 200 and unauthenticated operations return 401. A manual run of the charge endpoint was rejected by approval review and was not retried.

Deploy the Edge Function with verify_jwt=false because it implements customer JWT verification plus independent webhook/provider verification and scheduler-secret verification. Specify import_map_path=deno.json on updates. Do not put payment secrets in NEXT_PUBLIC variables. Deployment and migration history are in Supabase; frontend main automatically deploys to Vercel project swithapp, team switchapp.
