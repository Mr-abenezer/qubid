// ─── Bid X · telegram-login Edge Function ────────────────────────────────
// Verifies the signed Telegram initData (HMAC-SHA256 with the BOT TOKEN,
// which lives ONLY in Edge Function secrets), auto-creates the Bid X
// account + wallet, and returns a one-time token_hash that the client
// exchanges for a Supabase session via verifyOtp(magiclink).
//
// Deploy:  supabase functions deploy telegram-login --no-verify-jwt
// Secrets: supabase secrets set TELEGRAM_BOT_TOKEN=...
//          supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function hmacSha256(key: string | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const raw = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const k = await crypto.subtle.importKey("raw", raw as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
}
const toHex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");

// Telegram WebApp initData verification, exactly per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(initData: string): Promise<Record<string, string> | null> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secretKey = await hmacSha256("WebAppData", botToken);
  const calculated = toHex(await hmacSha256(new Uint8Array(secretKey), dataCheckString));
  if (calculated !== hash) return null; // signature mismatch → reject
  const authDate = Number(params.get("auth_date") ?? "0");
  if (Date.now() / 1000 - authDate > 86_400) return null; // older than 24h → reject (replay protection)
  return Object.fromEntries(params.entries());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { init_data } = await req.json();
    const data = await verifyInitData(String(init_data ?? ""));
    if (!data || !data.user) return json({ error: "Invalid Telegram initData" }, 401);

    const tgUser = JSON.parse(data.user) as {
      id: number; username?: string; first_name?: string; last_name?: string;
      photo_url?: string; language_code?: string;
    };
    const telegramId = String(tgUser.id);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE")!,
      { auth: { persistSession: false } },
    );

    // Deterministic private email per Telegram ID → Supabase Auth user.
    const email = `tg${telegramId}@users.bidx.app`;
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { data: { telegram_id: telegramId } },
    });
    if (linkErr || !link) return json({ error: linkErr?.message ?? "Could not create session" }, 500);

    // Upsert the Bid X profile (unique on telegram_id — never trust client data).
    const { data: profile, error: upErr } = await admin
      .from("users")
      .upsert(
        {
          auth_id: link.user.id,
          telegram_id: telegramId,
          username: tgUser.username ?? null,
          first_name: tgUser.first_name ?? "",
          last_name: tgUser.last_name ?? null,
          photo_url: tgUser.photo_url ?? null,
          language: tgUser.language_code ?? null,
        },
        { onConflict: "telegram_id" },
      )
      .select("id, created_at")
      .single();
    if (upErr || !profile) return json({ error: upErr?.message ?? "Profile upsert failed" }, 500);

    await admin.from("wallets").upsert({ user_id: profile.id }, { onConflict: "user_id" });

    // Welcome ping for brand-new accounts (delivered by the housekeeping worker).
    if (Date.now() - new Date(profile.created_at).getTime() < 10_000) {
      await admin.from("notifications").insert({
        user_id: profile.id,
        kind: "welcome",
        title: "Welcome to Bid X! 🪙",
        body: "Your account was created automatically with your Telegram ID. Watch ads, finish tasks and win Bid & Win rounds.",
      });
    }

    // Client exchanges this ONE-TIME hash via supabase.auth.verifyOtp({ email, token_hash, type: 'magiclink' }).
    return json({ email, token_hash: (link.properties as { token_hash: string }).token_hash });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
