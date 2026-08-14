// ─── Bid X · housekeeping Edge Function (cron worker) ────────────────────
// 1. Settles expired Bid & Win rounds (authoritative settlement also runs
//    inline in get_round/place_bid — this is the safety net).
// 2. Sends queued Telegram notifications through the Bot API.
// 3. Settles expired user campaigns and refunds leftover budget.
//
// Deploy:  supabase functions deploy housekeeping --no-verify-jwt
// Secrets: supabase secrets set TELEGRAM_BOT_TOKEN=...
//          supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
// Schedule (pick one):
//   • GitHub Action cron:  */1 * * * *  curl -X POST https://<ref>.supabase.co/functions/v1/housekeeping
//   • pg_cron + pg_net:    select cron.schedule('bidx', '* * * * *',
//       $$ select net.http_post(url := 'https://<ref>.supabase.co/functions/v1/housekeeping',
//          headers := '{"apikey":"<anon>"}'::jsonb) $$);

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE")!,
    { auth: { persistSession: false } },
  );
  const out: Record<string, unknown> = {};

  // 1 · settle expired rounds (idempotent + race-safe: SKIP LOCKED in SQL)
  const { data: fin } = await admin.rpc("try_finalize_round");
  out.rounds = fin;

  // 2 · notification queue → Telegram Bot API
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  let sent = 0;
  if (botToken) {
    const { data: queue } = await admin
      .from("notifications")
      .select("id, user_id, title, body, users!inner(telegram_id)")
      .eq("sent", false)
      .order("created_at")
      .limit(25);
    for (const n of queue ?? []) {
      const chatId = (n.users as unknown as { telegram_id: string })?.telegram_id;
      if (!chatId) { await admin.from("notifications").update({ sent: true }).eq("id", n.id); continue; }
      try {
        const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: `*${n.title}*\n${n.body}`, parse_mode: "Markdown" }),
        });
        if (r.ok) sent++;
      } catch { /* retry next tick */ }
      await admin.from("notifications").update({ sent: true }).eq("id", n.id);
    }
  }
  out.notifications_sent = sent;

  // 3 · expire ended campaigns, refund unspent budget
  const { data: expired } = await admin
    .from("campaigns")
    .select("id, user_id, title, budget, spent")
    .eq("status", "active")
    .lt("ends_at", new Date().toISOString());
  for (const c of expired ?? []) {
    const remaining = Number(c.budget) - Number(c.spent);
    const { error } = await admin.rpc("settle_expired_campaign", { p_id: c.id });
    out[`campaign_${c.id}`] = error ? `error: ${error.message}` : remaining > 0 ? "refunded" : "completed";
  }
  out.campaigns_checked = expired?.length ?? 0;

  return new Response(JSON.stringify({ ok: true, ...out }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
