# SwitchApp billing (2026-09-10)

Prices include VAT: setup ILS 3,000 once; small dealer up to 10 active vehicles at ILS 100 each/month; lot ILS 50 each/month with a 40-vehicle minimum. A small plan does not silently upgrade: adding an 11th active vehicle is rejected after plan activation.

Inventory events start on the migration date. No earlier peaks are reconstructed. A vehicle is active when unsold and offered for sale or swap; seeded demo vehicles are excluded. Counters are updated atomically and historical peaks survive deletion/sale. Month boundaries use Asia/Jerusalem. Billing begins at verified setup activation; lot minimum applies to partial months. Existing users are not enrolled or charged retroactively.

The Supabase dealer-billing Edge Function authenticates customer actions through auth.getUser. Provider webhooks require server-side GetLpResult verification of amount, currency, terminal, order reference and charge operation. Recurring tokens are service-role-only. Provider credentials and the scheduler secret live in Supabase Vault under switchapp_cardcom and are not committed.

The hourly scheduler prepares one invoice per closed calendar month and enrolled account. Cardcom token requests use the order UUID as ExternalUniqTranId with replay-return enabled. Pending transport errors retain that ID; explicit declines require review rather than uncontrolled retries. Successful payments issue a Cardcom TaxInvoiceAndReceipt by email. Document failures are marked for review without issuing another charge. Cancellation stops future subscription periods; the current period is settled at its end under the accepted terms.

Campaign pricing is an estimate/offer: client-selected media budget plus 20% management on actual spend. Campaign authorization and spend reconciliation are separate from the maintenance mandate; draft campaign budgets are never used as actual spend and are not charged by this worker.

Validation: production Next build; 8 node tests; live SQL tests rolled back (counter increments/decrements, retained peak after sale, unique monthly bill, ILS 2,050 for peak 41, service-role activation and idempotency, privilege checks). Cardcom accepted a ChargeAndCreateToken payment-page initialization without payment. No real credit-card charge was performed. Live readiness returns 200 and unauthenticated operations return 401. A manual run of the charge endpoint was rejected by approval review and was not retried.

Deploy the Edge Function with verify_jwt=false because it implements customer JWT verification plus independent webhook/provider verification and scheduler-secret verification. Specify import_map_path=deno.json on updates. Do not put payment secrets in NEXT_PUBLIC variables. Deployment and migration history are in Supabase; frontend main automatically deploys to Vercel project swithapp, team switchapp.
