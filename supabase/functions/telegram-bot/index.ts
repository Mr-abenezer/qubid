// ─── Bid X · telegram-bot Edge Function ───────────────────────────────────
// The bot's brain. Telegram pushes every chat update to this function via
// webhook; it answers /start (with optional referral payload) with a welcome
// message and an "Open Bid X" button, and gives a friendly hint otherwise.
//
// ZERO DEPENDENCIES — pure Deno + fetch. Deploy exactly like telegram-login:
//   Dashboard → Edge Functions → "New function" → name: telegram-bot
//   → replace the code with this file → Deploy
//   ⚠ then open the function → Settings → turn OFF "Verify JWT"
//     (Telegram calls it server-to-server, without a Supabase JWT)
//
// Secrets (Edge Functions → Secrets — shared with the other functions):
//   TELEGRAM_BOT_TOKEN  = your bot token (already set)
//   MINI_APP_URL        = OPTIONAL — your hosted app URL (e.g. your Vercel
//                         URL). When set, the button opens the app instantly
//                         as a Web App. Without it, the button uses the
//                         t.me/BidX_SmartEarningsbot/Earn link.
//   TELEGRAM_WEBHOOK_SECRET = OPTIONAL — if set, updates are only accepted
//                         when they carry this header (set via setWebhook).
//
// Activate the webhook ONCE — open this URL in any browser (replace <TOKEN>):
//   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://iybyohxhueyzxuzqphjv.supabase.co/functions/v1/telegram-bot&allowed_updates=%5B%22message%22%5D
// Expected answer: {"ok":true,"result":true,"description":"Webhook was set"}

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const MINI_APP_URL = (Deno.env.get("MINI_APP_URL") ?? "").replace(/\/+$/, "");
const TG_APP_LINK = "https://t.me/BidX_SmartEarningsbot/Earn";

const api = (method: string, body: unknown) =>
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

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

/** Button that opens the mini app. Prefers a native Web App button when the
 *  hosted URL is known, falls back to the t.me app link otherwise. The
 *  referral payload is forwarded as startapp → initData.start_param. */
const openButton = (payload: string) => {
  const q = payload ? `?startapp=${encodeURIComponent(payload)}` : "";
  if (MINI_APP_URL) return { text: "▶  Open Bid X", web_app: { url: `${MINI_APP_URL}${q}` } };
  return { text: "▶  Open Bid X", url: `${TG_APP_LINK}${q}` };
};

const keyboard = (payload: string) => ({ inline_keyboard: [[openButton(payload)]] });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Bid X bot webhook");

  // optional webhook-secret verification
  if (WEBHOOK_SECRET && req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 403 });
  }
  if (!BOT_TOKEN) return new Response("missing TELEGRAM_BOT_TOKEN secret", { status: 500 });

  let update: Record<string, unknown> = {};
  try {
    update = await req.json();
  } catch {
    return new Response("ok"); // malformed body — ack anyway so Telegram stops retrying
  }

  try {
    const msg = update.message as
      | { chat?: { id?: number }; from?: { first_name?: string }; text?: string }
      | undefined;
    const text = (msg?.text ?? "").trim();

    if (msg?.chat?.id && text) {
      const isStart = /^\/start(\b|@)/.test(text);
      const isHelp = /^\/(help|menu)(\b|@)/.test(text);
      // /start R7734124559  →  deep-link payload (inviter's Telegram id)
      const payload = isStart ? (text.split(/\s+/)[1] ?? "").replace(/[^0-9]/g, "") : "";
      const name = msg.from?.first_name ? msg.from.first_name.replace(/[<>&]/g, "") : "earner";

      await api("sendMessage", {
        chat_id: msg.chat.id,
        text: isStart || isHelp ? welcomeText(name, isStart && !!payload) : hintText(),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: keyboard(isStart ? payload : ""),
      });
    }
  } catch {
    /* never throw — Telegram would retry the same update forever */
  }

  // always 200: a non-2xx makes Telegram re-deliver the update
  return new Response("ok");
});
