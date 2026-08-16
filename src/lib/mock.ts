// ─── Bid X developer preview engine ──────────────────────────────────────
// A local, in-memory simulation of the authoritative server logic so the
// product can be explored outside Telegram. In production, the Postgres
// SECURITY DEFINER RPCs (see supabase/migrations) enforce every rule here.

import type {
  Ad, ActionResult, AdminStats, AdminUserRow, Backend, Bid, BidRound, Bootstrap,
  Campaign, RoundState, Settings, Submission, Task, Tx, UserProfile, Wallet,
  Withdrawal, WinnerEntry,
} from "./types";

const LS_KEY = "bidx_mock_v5";
const EARN_TYPES = ["ad_reward", "task_reward", "click_reward", "bid_winnings", "referral_bonus", "referral_commission"];
const now = () => Date.now();
const iso = (t: number) => new Date(t).toISOString();
const day = 86_400_000;

interface MUser {
  id: string; telegram_id: string; username: string; first_name: string; last_name: string;
  photo_url: string | null; language: string; status: string; balance: number; total_earned: number;
  created_at: string; referred_by?: string | null;
}
interface Db {
  users: Record<string, MUser>;
  me: string;
  txs: Record<string, Tx[]>;
  ads: (Ad & { status: string })[];
  adDone: Record<string, Record<string, number>>;
  tasks: Task[];
  subs: (Submission & { user_id: string; task_id: string })[];
  campaigns: (Campaign & { user_id: string; ends_at: string })[];
  clicks: Record<string, string[]>;
  round: BidRound;
  roundNextAt: number | null;
  roundStartedAt: number;
  bids: (Bid & { user_id: string })[];
  winners: WinnerEntry[];
  withdrawals: (Withdrawal & { user_id: string })[];
  referrals: { user_id: string; referred_by: string; completed: number; earned: number }[];
  settings: Settings;
  fees: number;
  seq: number;
}

const DEFAULTS: Settings = {
  ad_reward: 5, task_reward: 5, click_price: 7, click_reward: 5,
  min_campaign_budget: 50, bid_amount: 10, bid_timer_sec: 60,
  winner_pct: 85, platform_pct: 15, coin_usdt_rate: 0.0006,
  min_withdrawal: 300, daily_ad_limit: 20,
  referral_bonus: 30, referral_commission: 5,
  maintenance_mode: false,
  admin_telegram_id: "7734124559",
};

function bot(id: string, telegram_id: string, username: string, first_name: string, last_name: string, createdDaysAgo: number): MUser {
  return { id, telegram_id, username, first_name, last_name, photo_url: null, language: "en", status: "active", balance: 300 + (id.length * 137) % 900, total_earned: 1500, created_at: iso(now() - createdDaysAgo * day) };
}

function seed(): Db {
  const me: MUser = {
    id: "u-me", telegram_id: "7734124559", username: "smart_earner", first_name: "Alex",
    last_name: "Morozov", photo_url: null, language: "en", status: "active",
    balance: 1240, total_earned: 3210, created_at: iso(now() - 12 * day),
  };
  const users: Record<string, MUser> = {
    "u-me": me,
    u1: bot("u1", "5100000001", "artem_k", "Artem", "Koval", 40),
    u2: bot("u2", "5100000002", "nadia_trades", "Nadia", "Reyes", 33),
    u3: bot("u3", "5100000003", "cryptowolf", "Dan", "Wolf", 29),
    u4: bot("u4", "5100000004", "mila_invest", "Mila", "Sato", 21),
    u5: bot("u5", "5100000005", "sasha_x", "Sasha", "Lin", 14),
    u6: bot("u6", "5100000006", "token_tim", "Tim", "Barker", 9),
    u7: bot("u7", "5100000007", "lena_hodl", "Lena", "Hodl", 4),
    u8: bot("u8", "5100000008", "max_bids", "Max", "Orlov", 1),
  };
  // friends who joined through your invite link
  users.u6.referred_by = "u-me";
  users.u7.referred_by = "u-me";
  users.u8.referred_by = "u-me";
  try {
    const sp = new URLSearchParams(location.search).get("startapp");
    if (sp && users[sp] && sp !== "u-me") me.referred_by = sp;
  } catch { /* noop */ }

  const ads: Db["ads"] = [
    { id: "ad-1", source: "ad", title: "SolanaStake — Earn 7% APY", description: "Stake SOL with non-custodial security. Instant rewards, zero lock-up for flexible pools.", image_url: null, url: "https://example.com/solanastake", reward: 5, required_seconds: 8, per_user_limit: 2, my_completions: 0, ends_at: null, hue: 152, status: "active" },
    { id: "ad-2", source: "ad", title: "CryptoSignals Pro — Free week", description: "Institutional-grade signals for spot and futures. Try the VIP room free for 7 days.", image_url: null, url: "https://example.com/signals", reward: 5, required_seconds: 10, per_user_limit: 1, my_completions: 0, ends_at: null, hue: 205, status: "active" },
    { id: "ad-3", source: "ad", title: "MetaPunks NFT drop — Whitelist", description: "5,000 hand-drawn punks on Ethereum. Whitelist closes Friday at 18:00 UTC.", image_url: null, url: "https://example.com/metapunks", reward: 5, required_seconds: 6, per_user_limit: 1, my_completions: 0, ends_at: iso(now() + 4 * day), hue: 285, status: "active" },
    { id: "ad-4", source: "ad", title: "TradeWiz — $25 sign-up bonus", description: "Commission-free trading app. Register with a link and get a $25 bonus after first trade.", image_url: null, url: "https://example.com/tradewiz", reward: 7, required_seconds: 12, per_user_limit: 1, my_completions: 0, ends_at: null, hue: 32, status: "active" },
    { id: "ad-c1", source: "campaign", title: "AirdropAlert — Claim $AIR", description: "User campaign: verify your wallet and claim the $AIR community airdrop before it ends.", image_url: null, url: "https://example.com/airdrop", reward: 5, required_seconds: 7, per_user_limit: 1, my_completions: 0, ends_at: iso(now() + 9 * day), hue: 190, status: "active" },
  ];

  const tasks: Task[] = [
    { id: "t-1", title: "Join the Bid X channel", description: "Stay in the loop with rounds, payouts and new campaigns.", instructions: "Open the link, press Join, then submit.", link: "https://t.me/BidX_SmartEarningsbot", reward: 5, requires_proof: false, deadline: null, status: "active", my_status: null },
    { id: "t-2", title: "Follow @BidX on X", description: "Help us reach 10k followers and unlock a bonus pool round.", instructions: "Follow the account, then submit. We verify within 24h.", link: "https://x.com", reward: 5, requires_proof: false, deadline: null, status: "active", my_status: null },
    { id: "t-3", title: "Watch: How Bid & Win works", description: "A 90-second explainer of rounds, timers and the 85/15 split.", instructions: "Watch the full video and paste the link or a timestamp as proof.", link: "https://youtube.com", reward: 8, requires_proof: true, deadline: iso(now() + 6 * day), status: "active", my_status: null },
    { id: "t-4", title: "Beta feedback survey", description: "Tell us what to build next — the 20 best answers get 25 extra Coins.", instructions: "Complete the survey and paste your completion code as proof.", link: "https://example.com/survey", reward: 10, requires_proof: true, deadline: iso(now() + 3 * day), status: "active", my_status: null },
  ];

  const mk = (n: number, hoursAgo: number, type: string, amount: number, note: string): Tx => ({
    id: n, type, amount, balance_after: 0, note, created_at: iso(now() - hoursAgo * 3_600_000),
  });
  const myTxs: Tx[] = [
    mk(26, 1, "referral_commission", 5, "@max_bids completed a task"),
    mk(25, 6, "referral_commission", 5, "@lena_hodl completed a task"),
    mk(24, 22, "referral_bonus", 30, "@max_bids joined with your link"),
    mk(23, 26, "referral_commission", 5, "@token_tim completed a task"),
    mk(22, 96, "referral_bonus", 30, "@lena_hodl joined with your link"),
    mk(21, 2, "ad_reward", 5, "SolanaStake — Earn 7% APY"),
    mk(20, 5, "bid_payment", -10, "Bid & Win round #36"),
    mk(19, 6, "bid_payment", -10, "Bid & Win round #36"),
    mk(18, 7, "bid_winnings", 425, "Won round #36 — 85% of 500 pool"),
    mk(17, 26, "task_reward", 5, "Join the Bid X channel"),
    mk(16, 28, "click_reward", 5, "AirdropAlert — Claim $AIR"),
    mk(15, 30, "bid_payment", -10, "Bid & Win round #35"),
    mk(14, 50, "ad_reward", 5, "CryptoSignals Pro — Free week"),
    mk(13, 54, "ad_reward", 5, "MetaPunks NFT drop — Whitelist"),
    mk(12, 74, "withdrawal", -300, "Withdrawal to BEP20 ••••A063"),
    mk(11, 74, "campaign_deposit", -100, "Campaign budget — Mega Airdrop"),
    mk(10, 98, "bid_payment", -10, "Bid & Win round #33"),
    mk(9, 100, "bid_payment", -10, "Bid & Win round #33"),
    mk(8, 101, "bid_payment", -10, "Bid & Win round #33"),
    mk(7, 122, "task_reward", 8, "Watch: How Bid & Win works"),
    mk(6, 126, "ad_reward", 7, "TradeWiz — $25 sign-up bonus"),
    mk(5, 150, "ad_reward", 5, "SolanaStake — Earn 7% APY"),
    mk(4, 176, "bid_winnings", 289, "Won round #30 — 85% of 340 pool"),
    mk(3, 200, "task_reward", 5, "Follow @BidX on X"),
    mk(2, 240, "ad_reward", 5, "CryptoSignals Pro — Free week"),
    mk(1, 280, "admin_adjust", 1500, "Welcome bonus — Bid X beta"),
  ];

  const t0 = now();
  const bids: Db["bids"] = [];
  const botIds = ["u1", "u3", "u2", "u5", "u4", "u7", "u6", "u3", "u1", "u8", "u2", "u5"];
  // every bid must beat the previous one by at least 1 — seeded bids escalate 10 → 21
  botIds.forEach((uid, i) => {
    const u = users[uid];
    bids.unshift({
      id: 100 + i, user_id: uid,
      user: { id: uid, username: u.username, first_name: u.first_name, photo_url: null },
      amount: 10 + i, placed_at: iso(t0 - (botIds.length - i) * 47_000), is_me: false,
    });
  });

  return {
    users, me: "u-me", txs: { "u-me": myTxs },
    ads, adDone: {}, tasks, subs: [],
    campaigns: [
      { id: "c-1", user_id: "u-me", title: "Mega Airdrop — claim now", description: "Community airdrop for early holders.", url: "https://example.com/mega", image_url: null, budget: 100, cpc: 7, clicks: 0, max_clicks: 14, spent: 0, status: "active", created_at: iso(now() - 2 * day), ends_at: iso(now() + 12 * day) },
      { id: "c-2", user_id: "u3", title: "AirdropAlert — Claim $AIR", description: "User campaign: verify your wallet and claim the $AIR community airdrop.", url: "https://example.com/airdrop", image_url: null, budget: 250, cpc: 7, clicks: 17, max_clicks: 35, spent: 119, status: "active", created_at: iso(now() - 6 * day), ends_at: iso(now() + 9 * day) },
    ],
    clicks: {},
    round: {
      id: "r-37", number: 37, bid_amount: 10, timer_sec: 60, winner_pct: 85, platform_pct: 15,
      pool: 186, bid_count: 12, status: "running", ends_at: iso(t0 + 44_000),
      winner: null, payout: null,
    },
    roundNextAt: null, roundStartedAt: t0 - 12 * 60_000,
    bids,
    winners: [
      { user: { id: "u3", username: "cryptowolf", first_name: "Dan" }, payout: 425, pool: 500, at: iso(now() - 6 * 3_600_000), round: 36 },
      { user: { id: "u2", username: "nadia_trades", first_name: "Nadia" }, payout: 187, pool: 220, at: iso(now() - day), round: 34 },
      { user: { id: "u-me", username: "smart_earner", first_name: "Alex" }, payout: 289, pool: 340, at: iso(now() - 2 * day), round: 30 },
    ],
    withdrawals: [
      { id: "w-1", user_id: "u-me", coins: 300, usdt: 0.18, address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", network: "BEP20", status: "completed", created_at: iso(now() - 3 * day) },
    ],
    referrals: [
      { user_id: "u6", referred_by: "u-me", completed: 12, earned: 90 },
      { user_id: "u7", referred_by: "u-me", completed: 7, earned: 65 },
      { user_id: "u8", referred_by: "u-me", completed: 3, earned: 45 },
      // joined recently, hasn't completed a task yet — shows as Pending
      { user_id: "u4", referred_by: "u-me", completed: 0, earned: 0 },
    ],
    settings: { ...DEFAULTS },
    fees: 1350, seq: 1000,
  };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const db = JSON.parse(raw) as Db;
      if (db?.users && db.settings && db.round) return db;
    }
  } catch { /* reseed */ }
  return seed();
}

export function resetMock() {
  localStorage.removeItem(LS_KEY);
  location.reload();
}

export function createMockBackend(): Backend {
  const db = load();
  const listeners = new Set<() => void>();
  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* full */ } };
  const emit = () => { save(); listeners.forEach((cb) => cb()); };
  const d = (ms = 220) => new Promise<void>((r) => setTimeout(r, ms + Math.random() * 180));
  const meU = () => db.users[db.me];

  const credit = (userId: string, amount: number, type: string, note: string): Tx => {
    const u = db.users[userId];
    u.balance += amount;
    if (amount > 0 && EARN_TYPES.includes(type)) u.total_earned += amount;
    const tx: Tx = { id: ++db.seq, type, amount, balance_after: u.balance, note, created_at: iso(now()) };
    (db.txs[userId] ??= []).unshift(tx);
    return tx;
  };

  // Referral program: when a user completes a task/ad, their inviter earns a
  // commission and the referral counter ticks up.
  const commission = (actorId: string, note: string) => {
    const rid = db.users[actorId]?.referred_by;
    const c = db.settings.referral_commission;
    if (!rid || !db.users[rid] || c <= 0) return;
    credit(rid, c, "referral_commission", note);
    const row = db.referrals.find((x) => x.user_id === actorId && x.referred_by === rid);
    if (row) { row.completed += 1; row.earned += c; }
  };

  const finalize = () => {
    const r = db.round;
    if (r.status !== "running" || !r.ends_at || now() < new Date(r.ends_at).getTime()) return;
    const last = db.bids[db.bids.length - 1];
    if (last) {
      const payout = Math.floor((r.pool * r.winner_pct) / 100);
      db.fees += r.pool - payout;
      credit(last.user_id, payout, "bid_winnings", `Won round #${r.number} — ${r.winner_pct}% of ${r.pool} pool`);
      r.winner = last.user_id;
      r.payout = payout;
      db.winners.unshift({ user: last.user, payout, pool: r.pool, at: iso(now()), round: r.number });
      db.winners = db.winners.slice(0, 10);
    }
    r.status = "completed";
    db.roundNextAt = now() + 7_000;
    emit();
  };

  // A bid must beat the previous bid by at least 1 Coin. When a round ends the
  // ladder resets to the round's starting bid (10 by default).
  const minBidNow = () => {
    const last = db.bids[db.bids.length - 1];
    return last ? last.amount + 1 : db.round.bid_amount;
  };

  const pushBid = (userId: string, amount?: number) => {
    const u = db.users[userId];
    const r = db.round;
    if (r.status !== "running") return false;
    if (r.ends_at && now() >= new Date(r.ends_at).getTime()) { finalize(); return false; }
    const min = minBidNow();
    const amt = Math.floor(amount ?? min);
    if (amt < min || u.balance < amt) return false;
    credit(userId, -amt, "bid_payment", `Bid & Win round #${r.number}`);
    const bid: Bid & { user_id: string } = {
      id: ++db.seq, user_id: userId,
      user: { id: userId, username: u.username, first_name: u.first_name, photo_url: null },
      amount: amt, placed_at: iso(now()), is_me: userId === db.me,
    };
    db.bids.push(bid);
    db.bids = db.bids.slice(-60);
    r.pool += amt;
    r.bid_count += 1;
    r.ends_at = iso(now() + r.timer_sec * 1000);
    emit();
    return true;
  };

  const newRound = (overrides?: Partial<BidRound>) => {
    db.round = {
      id: `r-${db.round.number + 1}`, number: db.round.number + 1,
      bid_amount: overrides?.bid_amount ?? db.settings.bid_amount,
      timer_sec: overrides?.timer_sec ?? db.settings.bid_timer_sec,
      winner_pct: db.settings.winner_pct, platform_pct: db.settings.platform_pct,
      pool: 0, bid_count: 0, status: "running", ends_at: null, winner: null, payout: null,
    };
    db.roundStartedAt = now();
    db.roundNextAt = null;
    db.bids = [];
    emit();
  };

  // 1s heartbeat: countdown, bot activity, settlements, referral activity
  let lastRefTick = now();
  setInterval(() => {
    const r = db.round;
    if (r.status === "running") {
      if (r.ends_at && now() >= new Date(r.ends_at).getTime()) { finalize(); return; }
      const botIds = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"];
      const last = db.bids[db.bids.length - 1];
      const meLeading = last?.user_id === db.me;
      if (!r.ends_at) {
        if (now() - db.roundStartedAt > 6_000 && Math.random() < 0.35) {
          pushBid(botIds[Math.floor(Math.random() * botIds.length)], minBidNow() + Math.floor(Math.random() * 4));
        }
      } else if (r.pool < 1500 && r.bid_count < 110) {
        const p = meLeading ? 0.16 : 0.055;
        if (Math.random() < p) pushBid(botIds[Math.floor(Math.random() * botIds.length)], minBidNow() + Math.floor(Math.random() * 4));
      }
    } else if (r.status === "completed" && db.roundNextAt && now() >= db.roundNextAt) {
      newRound();
    }

    // referred friends keep completing tasks — you earn commissions while away
    if (now() - lastRefTick > 15_000 && Math.random() < 0.55) {
      lastRefTick = now();
      const mine = db.referrals.filter((x) => x.referred_by === db.me);
      if (mine.length) {
        const row = mine[Math.floor(Math.random() * mine.length)];
        const c = db.settings.referral_commission;
        const friend = db.users[row.user_id];
        const uname = friend?.username ?? "friend";
        const isFirst = row.completed === 0;
        row.completed += 1;
        row.earned += c;
        if (c > 0) credit(db.me, c, "referral_commission", `@${uname} completed a task`);
        if (isFirst) {
          // first task validates the referral — one-time join bonus unlocks
          const b = db.settings.referral_bonus;
          row.earned += b;
          if (b > 0) credit(db.me, b, "referral_bonus", `@${uname} completed their first task — referral validated`);
        }
      }
    }

    listeners.forEach((cb) => cb());
  }, 1000);

  const snap = (): RoundState => ({
    round: { ...db.round },
    last_bid: db.bids.length ? { ...db.bids[db.bids.length - 1] } : null,
    bids: db.bids.slice(-15).reverse(),
    winners: [...db.winners],
    server_now: iso(now()),
  });

  const ok = (extra?: Partial<ActionResult>): ActionResult => ({ ok: true, ...extra });
  const fail = (error: string): ActionResult => ({ ok: false, error });

  return {
    mode: "mock",

    async bootstrap() {
      await d(500);
      const u = meU();
      const txs = db.txs[db.me] ?? [];
      const today = iso(now()).slice(0, 10);
      const wallet: Wallet = {
        balance: u.balance,
        total_earned: u.total_earned,
        today_earned: txs.filter((t) => t.created_at.slice(0, 10) === today && t.amount > 0 && EARN_TYPES.includes(t.type)).reduce((s, t) => s + t.amount, 0),
      };
      const user: UserProfile = {
        id: u.id, telegram_id: u.telegram_id, username: u.username, first_name: u.first_name,
        last_name: u.last_name, photo_url: u.photo_url, language: u.language,
        status: u.status as UserProfile["status"], is_admin: u.telegram_id === db.settings.admin_telegram_id,
        created_at: u.created_at,
      };
      return { user, wallet, settings: { ...db.settings } };
    },

    async listAds() {
      await d();
      const rows: Ad[] = [];
      for (const a of db.ads) {
        if (a.status !== "active") continue;
        if (a.ends_at && now() > new Date(a.ends_at).getTime()) continue;
        rows.push({ ...a, my_completions: db.adDone[a.id]?.[db.me] ?? 0 });
      }
      for (const c of db.campaigns) {
        if (c.status !== "active" || c.user_id === db.me) continue;
        if (c.spent >= c.budget) continue;
        rows.push({
          id: c.id, source: "campaign", title: c.title, description: c.description, image_url: c.image_url,
          url: c.url, reward: db.settings.click_reward, required_seconds: 7, per_user_limit: 1,
          my_completions: (db.clicks[c.id] ?? []).includes(db.me) ? 1 : 0,
          ends_at: c.ends_at, hue: (c.title.length * 47) % 360,
        });
      }
      return rows;
    },

    async completeAd(adId, source) {
      await d(350);
      const u = meU();
      if (source === "campaign") {
        const c = db.campaigns.find((x) => x.id === adId);
        if (!c || c.status !== "active") return fail("Campaign is no longer active");
        if (c.user_id === db.me) return fail("You can't click your own campaign");
        if ((db.clicks[c.id] ?? []).includes(db.me)) return fail("Already completed");
        if (c.spent + c.cpc > c.budget) return fail("Campaign budget exhausted");
        c.spent += c.cpc; c.clicks += 1;
        if (c.spent >= c.budget) c.status = "completed";
        (db.clicks[c.id] ??= []).push(db.me);
        const tx = credit(db.me, db.settings.click_reward, "click_reward", c.title);
        commission(db.me, `${c.title} — friend activity`);
        emit();
        return ok({ reward: tx.amount, balance: meU().balance });
      }
      const a = db.ads.find((x) => x.id === adId);
      if (!a || a.status !== "active") return fail("Ad unavailable");
      const done = db.adDone[a.id]?.[db.me] ?? 0;
      if (done >= a.per_user_limit) return fail("Limit reached for this ad");
      const today = iso(now()).slice(0, 10);
      const todayCount = (db.txs[db.me] ?? []).filter((t) => t.created_at.slice(0, 10) === today && (t.type === "ad_reward" || t.type === "click_reward")).length;
      if (todayCount >= db.settings.daily_ad_limit) return fail("Daily ad limit reached");
      (db.adDone[a.id] ??= {})[db.me] = done + 1;
      const tx = credit(db.me, a.reward, "ad_reward", a.title);
      commission(db.me, `${a.title} — friend activity`);
      emit();
      return ok({ reward: tx.amount, balance: meU().balance });
    },

    async listTasks() {
      await d();
      return db.tasks.filter((t) => t.status === "active").map((t) => ({
        ...t,
        my_status: db.subs.find((s) => s.task_id === t.id && s.user_id === db.me)?.status as Task["my_status"] ?? null,
      }));
    },

    async submitTask(taskId, proof) {
      await d(380);
      const t = db.tasks.find((x) => x.id === taskId);
      if (!t || t.status !== "active") return fail("Task unavailable");
      if (db.subs.some((s) => s.task_id === taskId && s.user_id === db.me)) return fail("Already submitted");
      const u = meU();
      if (!t.requires_proof) {
      db.subs.unshift({ id: `s-${++db.seq}`, user_id: db.me, task_id: taskId, user: { id: u.id, username: u.username, first_name: u.first_name }, task: { id: t.id, title: t.title, reward: t.reward }, proof: "auto-verified", status: "approved", created_at: iso(now()) });
      const tx = credit(db.me, t.reward, "task_reward", t.title);
      commission(db.me, `${t.title} — friend activity`);
      emit();
      return { ...ok({ reward: tx.amount, balance: meU().balance }), auto: true };      }
      db.subs.unshift({ id: `s-${++db.seq}`, user_id: db.me, task_id: taskId, user: { id: u.id, username: u.username, first_name: u.first_name }, task: { id: t.id, title: t.title, reward: t.reward }, proof, status: "pending", created_at: iso(now()) });
      emit();
      return ok();
    },

    async listMyCampaigns() {
      await d();
      return db.campaigns.filter((c) => c.user_id === db.me).map(({ user_id: _u, ...c }) => c as Campaign);
    },

    async createCampaign(input) {
      await d(420);
      const u = meU();
      const s = db.settings;
      if (input.budget < s.min_campaign_budget) return fail(`Minimum budget is ${s.min_campaign_budget} Coins`);
      if (u.balance < input.budget) return fail("Insufficient balance");
      credit(db.me, -input.budget, "campaign_deposit", `Campaign budget — ${input.title}`);
      // No approval gate — the campaign is live on every Home screen immediately.
      db.campaigns.unshift({
        id: `c-${++db.seq}`, user_id: db.me, title: input.title, description: input.description,
        url: input.url, image_url: input.image_url || null, budget: input.budget, cpc: s.click_price,
        clicks: 0, max_clicks: Math.floor(input.budget / s.click_price), spent: 0, status: "active",
        created_at: iso(now()), ends_at: iso(now() + input.days * day),
      });
      emit();
      return ok({ balance: u.balance });
    },

    // ── owner-side campaign management ──────────────────────────────────
    async ownerCampaignAction(id, action) {
      await d(280);
      const c = db.campaigns.find((x) => x.id === id && x.user_id === db.me);
      if (!c) return fail("Campaign not found");
      if (action === "pause") {
        if (c.status !== "active") return fail("Only live campaigns can be paused");
        c.status = "paused";
      } else if (action === "resume") {
        if (c.status !== "paused") return fail("Only paused campaigns can be resumed");
        if (c.ends_at && now() > new Date(c.ends_at).getTime()) return fail("This campaign already ended");
        c.status = "active";
      } else if (action === "delete") {
        const remaining = c.budget - c.spent;
        if (remaining > 0) credit(db.me, remaining, "campaign_refund", `Campaign deleted — ${c.title}`);
        db.campaigns = db.campaigns.filter((x) => x.id !== id);
      } else return fail("Unknown action");
      emit();
      return ok({ balance: meU().balance });
    },

    async ownerSetCampaignBudget(id, budget) {
      await d(320);
      const c = db.campaigns.find((x) => x.id === id && x.user_id === db.me);
      if (!c) return fail("Campaign not found");
      if (["completed", "rejected", "refunded"].includes(c.status)) return fail("This campaign is finished");
      const newBudget = Math.max(Math.floor(budget), c.spent, db.settings.min_campaign_budget);
      if (newBudget > 50000) return fail("Maximum campaign budget is 50,000 Coins");
      const delta = newBudget - c.budget;
      if (delta !== 0) credit(db.me, -delta, "campaign_deposit", `Budget updated — ${c.title}`);
      c.budget = newBudget;
      c.max_clicks = c.cpc > 0 ? Math.floor(newBudget / c.cpc) : 0;
      emit();
      return ok({ balance: meU().balance });
    },

    async getRound() { await d(180); return snap(); },
    async placeBid(amount) {
      await d(300);
      const u = meU();
      if (db.round.status !== "running") return fail("Round is not running");
      const min = minBidNow();
      const amt = Math.floor(Number(amount) || 0);
      if (amt < min) return fail(`Your bid must be at least ${min} Coins — always 1 above the last bidder`);
      if (u.balance < amt) return fail("Not enough Coins");
      pushBid(db.me, amt);
      return ok({ balance: meU().balance });
    },
    async tryFinalize() { finalize(); },
    subscribeRound(cb) { listeners.add(cb); return () => listeners.delete(cb); },

    async listTransactions(limit = 100) { await d(); return (db.txs[db.me] ?? []).slice(0, limit); },

    async requestWithdrawal(coins, address, network) {
      await d(420);
      const u = meU(); const s = db.settings;
      if (coins < s.min_withdrawal) return fail(`Minimum withdrawal is ${s.min_withdrawal} Coins`);
      if (coins > u.balance) return fail("Insufficient balance");
      if (!address.trim()) return fail("Enter a withdrawal address");
      credit(db.me, -coins, "withdrawal", `Withdrawal to ${network} ••••${address.slice(-4)}`);
      db.withdrawals.unshift({ id: `w-${++db.seq}`, user_id: db.me, coins, usdt: parseFloat((coins * s.coin_usdt_rate).toFixed(4)), address, network, status: "pending", created_at: iso(now()) });
      emit();
      return ok({ balance: u.balance });
    },

    async listMyWithdrawals() { await d(); return db.withdrawals.filter((w) => w.user_id === db.me); },

    async getReferralStats() {
      await d();
      const bonus = db.settings.referral_bonus;
      const comm = db.settings.referral_commission;
      const rows = db.referrals
        .filter((x) => x.referred_by === db.me)
        .map((x) => {
          const u = db.users[x.user_id];
          const validated = x.completed >= 1;
          return {
            id: `rf-${x.user_id}`,
            user: { id: u.id, telegram_id: u.telegram_id, username: u.username, first_name: u.first_name, photo_url: u.photo_url },
            joined_at: u.created_at,
            completed: x.completed,
            earned: x.completed * comm + (validated ? bonus : 0),
            status: (validated ? "validated" : "pending") as "validated" | "pending",
          };
        })
        .sort((a, b) => b.joined_at.localeCompare(a.joined_at));
      return {
        code: meU().telegram_id,
        count: rows.length,
        earned: rows.reduce((s, r) => s + r.earned, 0),
        referrals: rows,
      };
    },

    // ── admin ────────────────────────────────────────────────────────────
    async adminStats() {
      await d();
      const all = Object.values(db.users);
      const allTxs = Object.values(db.txs).flat();
      const sum = (f: (t: Tx) => boolean) => allTxs.filter(f).reduce((s, t) => s + t.amount, 0);
      const totals: Record<string, number> = {
        users: all.length,
        active_users: all.filter((u) => u.status === "active").length,
        new_today: all.filter((u) => u.created_at.slice(0, 10) === iso(now()).slice(0, 10)).length,
        coins_issued: sum((t) => t.amount > 0),
        coins_spent: Math.abs(sum((t) => t.amount < 0)),
        ad_earnings: sum((t) => t.type === "ad_reward"),
        task_earnings: sum((t) => t.type === "task_reward"),
        click_earnings: sum((t) => t.type === "click_reward"),
        campaign_clicks: db.campaigns.reduce((s, c) => s + c.clicks, 0),
        campaign_spend: db.campaigns.reduce((s, c) => s + c.spent, 0),
        bid_volume: Math.abs(sum((t) => t.type === "bid_payment")),
        platform_fees: db.fees,
        withdrawals_total: db.withdrawals.reduce((s, w) => s + w.coins, 0),
        withdrawals_pending: db.withdrawals.filter((w) => w.status === "pending").length,
        withdrawals_completed: db.withdrawals.filter((w) => w.status === "completed").reduce((s, w) => s + w.coins, 0),
      };
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const dte = iso(now() - (6 - i) * day).slice(0, 10);
        return {
          day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dte).getDay()],
          earned: Math.max(8, allTxs.filter((t) => t.created_at.slice(0, 10) === dte && t.amount > 0).reduce((s, t) => s + t.amount, 0) + ((i * 53) % 40)),
          bids: allTxs.filter((t) => t.created_at.slice(0, 10) === dte && t.type === "bid_payment").length + ((i * 7) % 9),
        };
      });
      return { totals, last7, recent_users: [...all].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5).map((u) => ({ id: u.id, telegram_id: u.telegram_id, username: u.username, first_name: u.first_name, last_name: u.last_name, photo_url: u.photo_url, status: u.status, balance: u.balance, total_earned: u.total_earned, created_at: u.created_at })) };
    },

    async adminUsers(q = "") {
      await d();
      const s = q.trim().toLowerCase();
      return Object.values(db.users)
        .filter((u) => !s || u.username.toLowerCase().includes(s) || u.first_name.toLowerCase().includes(s) || u.telegram_id.includes(s))
        .map((u) => ({ id: u.id, telegram_id: u.telegram_id, username: u.username, first_name: u.first_name, last_name: u.last_name, photo_url: u.photo_url, status: u.status, balance: u.balance, total_earned: u.total_earned, created_at: u.created_at }));
    },

    async adminUserTxns(userId) { await d(); return db.txs[userId] ?? []; },

    async adminAdjust(userId, delta, reason) {
      await d(300);
      const u = db.users[userId];
      if (!u) return fail("User not found");
      if (delta < 0 && u.balance + delta < 0) return fail("Would overdraw balance");
      credit(userId, delta, "admin_adjust", reason || "Admin adjustment");
      emit();
      return ok();
    },

    async adminSetUserStatus(userId, status) {
      await d(250);
      const u = db.users[userId];
      if (!u) return fail("User not found");
      u.status = status; emit(); return ok();
    },

    async adminAds() { await d(); return db.ads.map((a) => ({ ...a })); },
    async adminTasks() { await d(); return db.tasks.map((t) => ({ ...t })); },

    async adminUpsertAd(ad) {
      await d(300);
      if (ad.id) {
        const ex = db.ads.find((a) => a.id === ad.id);
        if (ex) Object.assign(ex, ad);
      } else {
        db.ads.unshift({ id: `ad-${++db.seq}`, source: "ad", title: ad.title ?? "New ad", description: ad.description ?? "", image_url: null, url: ad.url ?? "https://example.com", reward: ad.reward, required_seconds: ad.required_seconds, per_user_limit: ad.per_user_limit, my_completions: 0, ends_at: null, hue: Math.floor(Math.random() * 360), status: ad.status });
      }
      emit(); return ok();
    },

    async adminDeleteAd(id) { await d(250); db.ads = db.ads.filter((a) => a.id !== id); emit(); return ok(); },

    async adminUpsertTask(t) {
      await d(300);
      if (t.id) {
        const ex = db.tasks.find((x) => x.id === t.id);
        if (ex) Object.assign(ex, t);
      } else {
        db.tasks.unshift({ id: `t-${++db.seq}`, title: t.title ?? "New task", description: t.description ?? "", instructions: t.instructions ?? "", link: t.link ?? null, reward: t.reward, requires_proof: t.requires_proof, deadline: null, status: t.status, my_status: null });
      }
      emit(); return ok();
    },

    async adminSubmissions() { await d(); return db.subs; },

    async adminReviewSubmission(id, approve) {
      await d(300);
      const s = db.subs.find((x) => x.id === id);
      if (!s || s.status !== "pending") return fail("Submission already reviewed");
      s.status = approve ? "approved" : "rejected";
      if (approve) {
        credit(s.user_id, s.task.reward, "task_reward", s.task.title);
        commission(s.user_id, `${s.task.title} — friend activity`);
      }
      emit(); return ok();
    },

    async adminCampaigns() {
      await d();
      return db.campaigns.map((c) => {
        const { user_id: _u, ...rest } = c;
        const u = db.users[c.user_id];
        return { ...rest, user: { id: u.id, username: u.username, first_name: u.first_name, photo_url: null } };
      });
    },

    async adminCampaignAction(id, action) {
      await d(300);
      const c = db.campaigns.find((x) => x.id === id);
      if (!c) return fail("Campaign not found");
      if (action === "approve") c.status = "active";
      if (action === "reject" || action === "refund") {
        const remaining = c.budget - c.spent;
        if (remaining > 0) credit(c.user_id, remaining, "campaign_refund", `Campaign refund — ${c.title}`);
        c.status = action === "reject" ? "rejected" : "refunded";
      }
      if (action === "pause") c.status = "paused";
      if (action === "resume") c.status = "active";
      emit(); return ok();
    },

    async adminEditCampaign(id, patch) {
      await d(280);
      const c = db.campaigns.find((x) => x.id === id);
      if (!c) return fail("Campaign not found");
      Object.assign(c, patch);
      emit(); return ok();
    },

    async adminRounds() { await d(); return [db.round]; },

    async adminRoundAction(action, opts) {
      await d(320);
      if (action === "start") newRound(opts);
      if (action === "end") {
        if (db.round.ends_at) { db.round.ends_at = iso(now() - 1000); finalize(); }
      }
      if (action === "cancel") {
        const r = db.round;
        const perUser: Record<string, number> = {};
        db.bids.forEach((b) => { perUser[b.user_id] = (perUser[b.user_id] ?? 0) + b.amount; });
        Object.entries(perUser).forEach(([uid, amt]) => credit(uid, amt, "admin_adjust", `Round #${r.number} cancelled — refund`));
        r.status = "cancelled";
        db.roundNextAt = now() + 4_000;
        emit();
      }
      return ok();
    },

    async adminWithdrawals() {
      await d();
      return db.withdrawals.map((w) => {
        const { user_id: _u, ...rest } = w;
        const u = db.users[w.user_id];
        return { ...rest, user: { id: u.id, username: u.username, first_name: u.first_name, photo_url: null } };
      });
    },

    async adminSetWithdrawal(id, status) {
      await d(300);
      const w = db.withdrawals.find((x) => x.id === id);
      if (!w) return fail("Withdrawal not found");
      const refundable = ["pending", "approved", "processing"].includes(w.status);
      if ((status === "rejected" || status === "cancelled") && refundable) {
        credit(w.user_id, w.coins, "withdrawal_refund", `Withdrawal ${status} — refund`);
      }
      w.status = status as Withdrawal["status"];
      emit(); return ok();
    },

    async adminGetSettings() { await d(150); return { ...db.settings }; },

    async adminSaveSettings(s) {
      await d(300);
      db.settings = { ...s };
      emit(); return ok();
    },
  };
}
