// ─── Bid X · telegram-bot Edge Function ───────────────────────────────────
// The bot's brain. Telegram pushes every chat update here via webhook; it
// answers /start with a welcome message + "Open Bid X" button.
//
// 🔍 SELF-TEST: open this function's URL in any browser. It returns a JSON
//    diagnostic showing whether the bot token is loaded and valid. No logs
//    to read — the answer appears right in the browser.
//
// Deploy: Dashboard → Edge Functions → telegram-bot → Editor → paste → Deploy
// ⚠ Settings → turn OFF "Verify JWT".
//
// Secrets (Edge Functions → Secrets, must be available to ALL functions):
//   TELEGRAM_BOT_TOKEN  = your bot token
//   MINI_APP_URL        = OPTIONAL hosted app URL (Web App button)
//   TELEGRAM_WEBHOOK_SECRET = OPTIONAL

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const MINI_APP_URL = (Deno.env.get("MINI_APP_URL") ?? "").replace(/\/+$/, "");
const TG_APP_LINK = "https://t.me/BidX_SmartEarningsbot/Earn";

const tgApi = (method: string, body?: unknown) =>
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((e) => ({ ok: false, _fetchError: String(e) }) as unknown as Response);

const welcomeText = (name: string, invited: boolean) =>
  `⚡ <b>Welcome to Bid X</b>, ${name}!\n\n` +
  `🎰 <b>Bid &amp; Win</b> — outlast everyone and take 85% of the pot\n` +
  `📺 Watch ads &amp; finish tasks to earn Coins\n` +
  `💸 Withdraw to <b>USDT (BEP20)</b>\n` +
  `🎁 Invite friends — <b>+30 Coins</b> per friend, <b>+5</b> per task they finish\n\n` +
  (invited ? `🤝 You joined with a friend's link — your bonus is being applied!\n\n` : ``) +
  `Tap below and start earning 👇`;

const hintText = () =>
  `🎰 <b>Bid X</b> lives in the mini app — balance, ads, tasks, Bid &amp; Win and withdrawals.\n\nTap below to open it 👇`;

// Telegram only accepts web_app buttons whose URL starts with https://.
// Anything else (e.g. a bare t.me link saved in MINI_APP_URL) would make every
// sendMessage fail with "invalid button url" — so we validate and fall back to
// the t.me app link instead of silently breaking the bot.
const openButton = (payload: string) => {
  const q = payload ? `?startapp=${encodeURIComponent(payload)}` : "";
  if (/^https:\/\//.test(MINI_APP_URL)) {
    return { text: "▶  Open Bid X", web_app: { url: `${MINI_APP_URL}${q}` } };
  }
  return { text: "▶  Open Bid X", url: `${TG_APP_LINK}${q}` };
};

const keyboard = (payload: string) => ({ inline_keyboard: [[openButton(payload)]] });

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── 🔍 SELF-TEST (browser) ──────────────────────────────────────────────
  if (req.method !== "POST") {
    const diag: Record<string, unknown> = {
      service: "Bid X bot webhook",
      hasToken: BOT_TOKEN.length > 0,
      tokenPrefix: BOT_TOKEN ? BOT_TOKEN.slice(0, 10) + "…" : "(empty)",
      tokenLength: BOT_TOKEN.length,
      webhookSecretSet: WEBHOOK_SECRET.length > 0,
      miniAppUrl: MINI_APP_URL || "(not set — using t.me link)",
    };
    if (BOT_TOKEN) {
      try {
        const gm = await tgApi("getMe");
        const gmBody = await gm.json().catch(() => ({}));
        diag.telegramGetMe = gmBody;
        diag.verdict =
          (gmBody as { ok?: boolean }).ok
            ? "✅ TOKEN WORKS — bot should reply to /start. If it doesn't, the webhook secret or message route is the issue."
            : `❌ TOKEN REJECTED BY TELEGRAM (${(gmBody as { description?: string }).description ?? gm.status}) — the token value in the secret is wrong.`;
      } catch (e) {
        diag.telegramGetMe = { error: String(e) };
        diag.verdict = "❌ Could not reach Telegram from this function.";
      }
    } else {
      diag.verdict =
        "❌ TELEGRAM_BOT_TOKEN IS NOT REACHING THIS FUNCTION. Add it under Edge Functions → Secrets for ALL functions (it may currently be scoped only to telegram-login).";
    }
    return new Response(JSON.stringify(diag, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Real webhook (Telegram POST) ────────────────────────────────────────
  if (WEBHOOK_SECRET && req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    console.error("rejected: webhook secret mismatch");
    return new Response("unauthorized", { status: 403 });
  }
  if (!BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN secret missing in telegram-bot");
    return new Response("missing TELEGRAM_BOT_TOKEN secret", { status: 500 });
  }

  let update: Record<string, unknown> = {};
  try {
    update = await req.json();
  } catch {
    return new Response("ok");
  }

  try {
    const msg = update.message as
      | { chat?: { id?: number }; from?: { first_name?: string }; text?: string }
      | undefined;
    const text = (msg?.text ?? "").trim();

    if (msg?.chat?.id && text) {
      const isStart = /^\/start(\b|@)/.test(text);
      const isHelp = /^\/(help|menu)(\b|@)/.test(text);
      const payload = isStart ? (text.split(/\s+/)[1] ?? "").replace(/[^0-9]/g, "") : "";
      const name = msg.from?.first_name ? msg.from.first_name.replace(/[<>&]/g, "") : "earner";

      const res = await tgApi("sendMessage", {
        chat_id: msg.chat.id,
        text: isStart || isHelp ? welcomeText(name, isStart && !!payload) : hintText(),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: keyboard(isStart ? payload : ""),
      });
      if (!res || !res.ok) {
        const detail = res ? await res.text().catch(() => "") : "no response";
        console.error(`sendMessage failed (${res?.status ?? "?"})`, detail.slice(0, 300));
      } else {
        console.log(`replied to ${msg.chat.id}`);
      }
    } else {
      console.log("update ignored (no text)", JSON.stringify(update).slice(0, 200));
    }
  } catch (e) {
    console.error("bot handler error", String(e));
  }

  return new Response("ok");
});
