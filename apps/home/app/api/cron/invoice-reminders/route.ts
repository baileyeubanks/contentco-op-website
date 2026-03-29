import { NextResponse } from "next/server";
import { evaluateAndSendReminders } from "@/lib/reminder-engine";

/**
 * GET /api/cron/invoice-reminders
 *
 * Cron-callable endpoint that evaluates all outstanding invoices
 * and sends payment reminders based on the configured cadence.
 *
 * Call this daily via:
 *   - Supabase pg_cron
 *   - Coolify scheduled task
 *   - External cron service (e.g. cron-job.org)
 *
 * Optional: Add CRON_SECRET to .env.local for authentication.
 */
export async function GET(req: Request) {
  /* Optional auth check */
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const token = authHeader?.replace("Bearer ", "") || searchParams.get("secret");
    if (token !== cronSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await evaluateAndSendReminders();

  console.log(`[cron/invoice-reminders] Evaluated: ${result.evaluated}, Sent: ${result.sent}, Skipped: ${result.skipped}, Errors: ${result.errors}`);

  return NextResponse.json({
    ok: true,
    ...result,
    timestamp: new Date().toISOString(),
  });
}
