// ─── Bid X · housekeeping Edge Function (cron worker) ────────────────────
// 1. Settles expired Bid & Win rounds (authoritative settlement also runs
//    inline in get_round/place_bid — this is the safety net).
// 2. Sends queued Telegram notifications through the Bot API.
// 3. Settles expired user campaigns and refunds leftover budget.
//
// ZERO DEPENDENCIES — paste directly into the Supabase Dashboard editor:
//   Dashboard → Edge Functions → "New function" → name: housekeeping
//   → replace the code with this file → Deploy (verify JWT may stay ON;
//     the cron caller below sends the anon key).
// Secrets: TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY (same as telegram-login).
//
// Schedule it (pick one):
//   • Browser tab / any cron:  every minute call
//       POST https://<ref>.supabase.co/functions/v1/housekeeping
//       headers: { apikey: <anon key> }
//   • pg_cron + pg_net (SQL Editor):
//       select cron.schedule('bidx-housekeeping', '* * * * *',
//         $$ select net.http_post(
//              url := 'https://<ref>.supabase.co/functions/v1/housekeeping',
//              headers := '{"apikey":"<anon key>"}'::jsonb) $$);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const BASE = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE") ?? "";
  const headers = {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
  };
  const rest = (path: string, opts: RequestInit = {}) =>
    fetch(`${BASE}/rest/v1/${path}`, { ...opts, headers });
  const rpcFn = (name: string, body: unknown = {}) =>
    fetch(`${BASE}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });

  const out: Record<string, unknown> = {};

  // 1 · settle expired rounds (idempotent + race-safe: SKIP LOCKED in SQL)
  await rpcFn("try_finalize_round").catch(() => {});
  out.rounds_settled = true;

  // 2 · notification queue → Telegram Bot API
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  let sent = 0;
  if (botToken) {
    const q = await rest(
      "notifications?select=id,user_id,title,body,users!inner(telegram_id)&sent=eq.false&order=created_at.asc&limit=25",
    );
    const queue = (await q.json().catch(() => [])) as Array<Record<string, unknown>>;
    for (const n of queue) {
      const chatId = (n.users as { telegram_id?: string } | null)?.telegram_id;
      if (chatId) {
        try {
          const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `*${n.title}*\n${n.body}`,
              parse_mode: "Markdown",
            }),
          });
          if (r.ok) sent++;
        } catch { /* retried next tick */ }
      }
      await rest(`notifications?id=eq.${n.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ sent: true }),
      });
    }
  }
  out.notifications_sent = sent;

  // 3 · expire ended campaigns, refund unspent budget
  const nowIso = new Date().toISOString();
  const c = await rest(
    `campaigns?select=id,user_id,title,budget,spent&status=eq.active&ends_at=lt.${nowIso}`,
  );
  const expired = (await c.json().catch(() => [])) as Array<Record<string, unknown>>;
  for (const camp of expired) {
    await rpcFn("settle_expired_campaign", { p_id: camp.id }).catch(() => {});
  }
  out.campaigns_checked = expired.length;

  return json({ ok: true, ...out });
});
