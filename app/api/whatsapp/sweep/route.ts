// Retired broad-access sweep. No database, provider, or background work.
// A separately reviewed scoped recovery scheduler is required before enabling.
export const runtime = 'nodejs';
export async function GET() {
  return Response.json({ error: 'scoped_recovery_not_configured' }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
export const POST = GET;
