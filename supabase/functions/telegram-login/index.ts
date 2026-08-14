// ─── Bid X · telegram-login Edge Function ────────────────────────────────
// Verifies the signed Telegram initData (HMAC-SHA256 with the BOT TOKEN,
// which lives ONLY in Edge Function secrets), auto-creates the Bid X
// account keyed by Telegram user id, and mints a Supabase session via a
// magiclink token. The frontend never sees the bot token or service key.
//
// ZERO DEPENDENCIES — pure Deno + fetch, so it can be pasted directly into
// the Supabase Dashboard editor:
//   Dashboard → Edge Functions → "New function" → name: telegram-login
//   → replace the code with this file → Deploy
// Then: Dashboard → Edge Functions → Secrets → add:
//   TELEGRAM_BOT_TOKEN        = 8073660163:AAEyc-DmLQk16CaSSMjIfOg6OHsXfqxPGT8
//   SERVICE_ROLE_KEY        = <the service_role key from Project Settings → API>
// (SUPABASE_URL is injected automatically.)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Telegram WebApp initData verification, exactly per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(initData: string): Promise<Record<string, string> | null> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const pairs: string[] = [];
  params.forEach((v, k) => {
    if (k !== "hash") pairs.push(`${k}=${v}`);
  });
  pairs.sort();

  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", secretKey, enc.encode(botToken));
  const dataKey = await crypto.subtle.importKey(
    "raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", dataKey, enc.encode(pairs.join("\n")));
  const computed = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (computed !== hash) return null;

  // replay window: initData older than 24 h is rejected
  const authDate = Number(params.get("auth_date") ?? 0);
  if (authDate && Date.now() / 1000 - authDate > 86_400) return null;

  const out: Record<string, string> = {};
  params.forEach((v, k) => (out[k] = v));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { init_data } = await req.json();
    const data = await verifyInitData(String(init_data ?? ""));
    if (!data?.user) return json({ error: "Invalid Telegram initData" }, 401);

    const tuser = JSON.parse(data.user) as Record<string, unknown>;
    const tid = String(tuser.id);
    if (!tid) return json({ error: "initData has no user id" }, 401);

    const BASE = Deno.env.get("SUPABASE_URL");
    // NB: secret name must NOT start with SUPABASE_ (reserved by Supabase)
    const SERVICE = Deno.env.get("SERVICE_ROLE_KEY");
    if (!BASE || !SERVICE) return json({ error: "Function secrets not configured — add SERVICE_ROLE_KEY and TELEGRAM_BOT_TOKEN under Edge Functions → Secrets" }, 500);
    if (!Deno.env.get("TELEGRAM_BOT_TOKEN")) return json({ error: "Function secrets not configured (TELEGRAM_BOT_TOKEN)" }, 500);

    const rest = (path: string, opts: RequestInit = {}) =>
      fetch(`${BASE}/rest/v1/${path}`, {
        ...opts,
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          "Content-Type": "application/json",
          ...(opts.headers as Record<string, string> | undefined),
        },
      });

    // 1 · upsert the Bid X account — Telegram id is the unique key
    const userRes = await rest("users?on_conflict=telegram_id&select=*", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        telegram_id: tid,
        username: (tuser.username as string) ?? null,
        first_name: (tuser.first_name as string) ?? "",
        last_name: (tuser.last_name as string) ?? null,
        photo_url: (tuser.photo_url as string) ?? null,
        language: (tuser.language_code as string) ?? null,
      }),
    });
    if (!userRes.ok) return json({ error: "User upsert failed", detail: await userRes.text() }, 500);
    const rows = (await userRes.json()) as unknown[];
    const user = (Array.isArray(rows) ? rows[0] : rows) as Record<string, unknown> | undefined;
    if (!user?.id) return json({ error: "Could not resolve the user row" }, 500);
    if (user.status !== "active") return json({ error: `Account is ${user.status}` }, 403);

    // 2 · guarantee a Coin wallet exists
    await rest("wallets?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id }),
    });

    // 3 · brand-new account → welcome notification (delivered by housekeeping worker)
    const createdAt = new Date(String(user.created_at)).getTime();
    if (Number.isFinite(createdAt) && Date.now() - createdAt < 5_000) {
      await rest("notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          kind: "system",
          title: "Welcome to Bid X 🎉",
          body: "Your account was created automatically from Telegram. Earn Coins from ads, tasks and Bid & Win.",
        }),
      });
    }

    // 4 · mint a magiclink token (GoTrue admin) → the app exchanges it for a session
    const email = `${tid}@bidx.telegram`;
    const linkRes = await fetch(`${BASE}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "magiclink", email }),
    });
    if (!linkRes.ok) return json({ error: "generate_link failed", detail: await linkRes.text() }, 500);
    const link = (await linkRes.json()) as Record<string, unknown>;
    const token_hash =
      (link.hashed_token as string) ??
      (typeof link.action_link === "string"
        ? new URL(link.action_link).searchParams.get("token_hash")
        : null);
    if (!token_hash) return json({ error: "No token in generate_link response" }, 500);

    return json({ email, token_hash, user: { id: user.id, telegram_id: tid } });
  } catch (e) {
    return json({ error: "telegram-login crashed", detail: String(e) }, 500);
  }
});
