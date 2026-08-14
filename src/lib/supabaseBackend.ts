// ─── Bid X live backend (Supabase) ───────────────────────────────────────
// Identity: signed Telegram initData → verified in the `telegram-login`
// Edge Function (HMAC with the bot token, which NEVER reaches the client).
// Economy: every mutation runs through SECURITY DEFINER Postgres RPCs with
// row locks, unique constraints and balance checks — see migrations SQL.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Backend } from "./types";

const ENV = ((import.meta as unknown as { env?: Record<string, string> }).env ?? {});
export const SUPABASE_URL = ENV.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON = ENV.VITE_SUPABASE_ANON_KEY ?? "";
export const hasSupabase = () => Boolean(SUPABASE_URL && SUPABASE_ANON);

async function ensureSession(sb: SupabaseClient, initDataStr: string) {
  const { data } = await sb.auth.getSession();
  if (data?.session) return;

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({ init_data: initDataStr }),
    });
  } catch {
    throw new Error(
      "Cannot reach the telegram-login Edge Function (network/CORS). It is most likely not deployed yet — see README step 3.",
    );
  }

  if (res.status === 404) {
    throw new Error("telegram-login Edge Function not found (404). Deploy it: Supabase Dashboard → Edge Functions → New function → paste supabase/functions/telegram-login/index.ts.");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const hint =
      res.status === 401
        ? " Check the TELEGRAM_BOT_TOKEN secret, and reopen the app fresh from Telegram."
        : res.status >= 500
          ? " Check that TELEGRAM_BOT_TOKEN and SUPABASE_SERVICE_ROLE_KEY secrets are set on the function."
          : "";
    throw new Error(`telegram-login failed (${res.status})${hint} ${detail.slice(0, 160)}`.trim());
  }

  const { email, token_hash } = await res.json();
  if (!email || !token_hash) throw new Error("telegram-login returned no session token.");
  const { error } = await sb.auth.verifyOtp({ email, token_hash, type: "magiclink" });
  if (error) throw new Error(`Session exchange failed: ${error.message}`);
}

async function rpc<T = unknown>(sb: SupabaseClient, name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(name as never, (params ?? {}) as never);
  if (error) throw new Error(error.message);
  return data as T;
}

export function createSupabaseBackend(initDataStr: string): Backend {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: true } });
  type RpcCall = PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const A = async (p: RpcCall) => {
    const { data, error } = await p;
    if (error) return { ok: false, error: error.message };
    const d = (data ?? {}) as { ok?: boolean; error?: string; balance?: number; reward?: number };
    return { ok: d.ok ?? true, error: d.error, balance: d.balance, reward: d.reward };
  };

  const roundChannel = { cb: null as (() => void) | null, unsub: null as (() => void) | null };

  return {
    mode: "live",

    async bootstrap() {
      await ensureSession(sb, initDataStr);
      return rpc(sb, "bootstrap");
    },

    async listAds() { return rpc(sb, "list_ads"); },
    async completeAd(adId, source) { return A(sb.rpc("complete_ad" as never, { p_id: adId, p_source: source } as never)); },
    async listTasks() { return rpc(sb, "list_tasks"); },
    async submitTask(taskId, proof) {
      const r = await A(sb.rpc("submit_task" as never, { p_id: taskId, p_proof: proof } as never));
      return { ...r, auto: (r as { auto?: boolean }).auto };
    },

    async listMyCampaigns() { return rpc(sb, "list_my_campaigns"); },
    async createCampaign(input) {
      return A(sb.rpc("create_campaign" as never, {
        p_title: input.title, p_description: input.description, p_url: input.url,
        p_image: input.image_url, p_budget: input.budget, p_days: input.days,
      } as never));
    },

    async getRound() { return rpc(sb, "get_round"); },
    async placeBid() { return A(sb.rpc("place_bid" as never)); },
    async tryFinalize() { await sb.rpc("try_finalize_round" as never); },

    subscribeRound(cb) {
      roundChannel.cb = cb;
      const ch = sb
        .channel("bidx-arena")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, () => roundChannel.cb?.())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bid_rounds" }, () => roundChannel.cb?.())
        .subscribe();
      roundChannel.unsub = () => { sb.removeChannel(ch); };
      return () => roundChannel.unsub?.();
    },

    async listTransactions(limit = 100) { return rpc(sb, "list_transactions", { p_limit: limit }); },
    async requestWithdrawal(coins, address, network) {
      return A(sb.rpc("request_withdrawal" as never, { p_coins: coins, p_address: address, p_network: network } as never));
    },
    async listMyWithdrawals() { return rpc(sb, "list_my_withdrawals"); },

    async adminStats() { return rpc(sb, "admin_stats"); },
    async adminUsers(q = "") { return rpc(sb, "admin_users", { p_q: q }); },
    async adminUserTxns(userId) { return rpc(sb, "admin_user_txns", { p_user: userId }); },
    async adminAdjust(userId, delta, reason) { return A(sb.rpc("admin_adjust" as never, { p_user: userId, p_delta: delta, p_reason: reason } as never)); },
    async adminSetUserStatus(userId, status) { return A(sb.rpc("admin_set_user_status" as never, { p_user: userId, p_status: status } as never)); },
    async adminAds() { return rpc(sb, "admin_ads"); },
    async adminTasks() { return rpc(sb, "admin_tasks"); },
    async adminUpsertAd(ad) { return A(sb.rpc("admin_upsert_ad" as never, { p: ad } as never)); },
    async adminDeleteAd(id) { return A(sb.rpc("admin_delete_ad" as never, { p_id: id } as never)); },
    async adminUpsertTask(t) { return A(sb.rpc("admin_upsert_task" as never, { p: t } as never)); },
    async adminSubmissions() { return rpc(sb, "admin_submissions"); },
    async adminReviewSubmission(id, approve) { return A(sb.rpc("admin_review_submission" as never, { p_id: id, p_approve: approve } as never)); },
    async adminCampaigns() { return rpc(sb, "admin_campaigns"); },
    async adminCampaignAction(id, action) { return A(sb.rpc("admin_campaign_action" as never, { p_id: id, p_action: action } as never)); },
    async adminEditCampaign(id, patch) { return A(sb.rpc("admin_campaign_edit" as never, { p_id: id, p: patch } as never)); },
    async adminRounds() { return rpc(sb, "admin_rounds"); },
    async adminRoundAction(action, opts) {
      return A(sb.rpc("admin_round_action" as never, { p_action: action, p_amount: opts?.bid_amount ?? null, p_timer: opts?.timer_sec ?? null } as never));
    },
    async adminWithdrawals() { return rpc(sb, "admin_withdrawals"); },
    async adminSetWithdrawal(id, status) { return A(sb.rpc("admin_set_withdrawal" as never, { p_id: id, p_status: status } as never)); },
    async adminGetSettings() { return rpc(sb, "admin_get_settings"); },
    async adminSaveSettings(s) { return A(sb.rpc("admin_save_settings" as never, { p: s } as never)); },
  };
}
