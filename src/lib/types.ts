// ─── Bid X shared contract ────────────────────────────────────────────────
// Every coin movement, bid, timer and game result is authoritative on the
// server (Postgres SECURITY DEFINER RPCs). The frontend only renders state
// and calls RPCs — it never writes balances directly.

export interface MiniUser {
  id: string;
  telegram_id?: string;
  username: string;
  first_name: string;
  last_name?: string;
  photo_url?: string | null;
}

export interface UserProfile extends MiniUser {
  language?: string;
  status: "active" | "banned" | "suspended";
  is_admin: boolean;
  created_at: string;
}

export interface Settings {
  ad_reward: number;
  task_reward: number;
  click_price: number;
  click_reward: number;
  min_campaign_budget: number;
  bid_amount: number;
  bid_timer_sec: number;
  winner_pct: number;
  platform_pct: number;
  coin_usdt_rate: number; // 1 Coin = X USDT (default 0.0006)
  min_withdrawal: number;
  daily_ad_limit: number;
  maintenance_mode: boolean;
  admin_telegram_id?: string;
}

export interface Wallet {
  balance: number;
  total_earned: number;
  today_earned: number;
}

export interface Bootstrap {
  user: UserProfile;
  wallet: Wallet;
  settings: Settings;
}

export interface Ad {
  id: string;
  source: "ad" | "campaign";
  title: string;
  description: string;
  image_url: string | null;
  url: string;
  reward: number;
  required_seconds: number;
  per_user_limit: number;
  my_completions: number;
  ends_at: string | null;
  hue: number; // deterministic artwork hue
}

export interface Task {
  id: string;
  title: string;
  description: string;
  instructions: string;
  link: string | null;
  reward: number;
  requires_proof: boolean;
  deadline: string | null;
  status: string;
  my_status: "pending" | "approved" | "rejected" | null;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  budget: number;
  cpc: number;
  clicks: number;
  max_clicks: number;
  spent: number;
  status: "pending" | "active" | "paused" | "completed" | "rejected" | "refunded";
  created_at: string;
}

export interface Tx {
  id: number | string;
  type: string;
  amount: number;
  balance_after: number;
  note: string;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  coins: number;
  usdt: number;
  address: string;
  network: string;
  status: "pending" | "approved" | "processing" | "completed" | "rejected" | "cancelled";
  created_at: string;
}

export interface BidRound {
  id: string;
  number: number;
  bid_amount: number;
  timer_sec: number;
  winner_pct: number;
  platform_pct: number;
  pool: number;
  bid_count: number;
  status: "running" | "completed" | "cancelled";
  ends_at: string | null; // server-controlled deadline
  winner: string | null;
  payout: number | null;
}

export interface Bid {
  id: number | string;
  user: MiniUser;
  amount: number;
  placed_at: string;
  is_me: boolean;
}

export interface WinnerEntry {
  user: MiniUser;
  payout: number;
  pool: number;
  at: string;
  round: number;
}

export interface RoundState {
  round: BidRound;
  last_bid: Bid | null;
  bids: Bid[];
  winners: WinnerEntry[];
  server_now: string;
}

export interface Submission {
  id: string;
  proof: string;
  status: string;
  created_at: string;
  task: { id: string; title: string; reward: number };
  user: MiniUser;
}

export interface AdminUserRow extends MiniUser {
  status: string;
  balance: number;
  total_earned: number;
  created_at: string;
}

export interface AdminStats {
  totals: Record<string, number>;
  last7: { day: string; earned: number; bids: number }[];
  recent_users: AdminUserRow[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  balance?: number;
  reward?: number;
}

export interface Backend {
  mode: "mock" | "live";
  bootstrap(): Promise<Bootstrap>;
  // earning
  listAds(): Promise<Ad[]>;
  completeAd(adId: string, source: "ad" | "campaign"): Promise<ActionResult>;
  listTasks(): Promise<Task[]>;
  submitTask(taskId: string, proof: string): Promise<ActionResult & { auto?: boolean }>;
  // campaigns
  listMyCampaigns(): Promise<Campaign[]>;
  createCampaign(input: {
    title: string;
    description: string;
    url: string;
    image_url: string;
    budget: number;
    days: number;
  }): Promise<ActionResult>;
  // bid & win
  getRound(): Promise<RoundState>;
  placeBid(): Promise<ActionResult>;
  tryFinalize(): Promise<void>;
  subscribeRound(cb: () => void): () => void;
  // wallet
  listTransactions(limit?: number): Promise<Tx[]>;
  requestWithdrawal(coins: number, address: string, network: string): Promise<ActionResult>;
  listMyWithdrawals(): Promise<Withdrawal[]>;
  // admin
  adminStats(): Promise<AdminStats>;
  adminUsers(q?: string): Promise<AdminUserRow[]>;
  adminUserTxns(userId: string): Promise<Tx[]>;
  adminAdjust(userId: string, delta: number, reason: string): Promise<ActionResult>;
  adminSetUserStatus(userId: string, status: string): Promise<ActionResult>;
  adminAds(): Promise<(Ad & { status: string })[]>;
  adminTasks(): Promise<Task[]>;
  adminUpsertAd(ad: Partial<Ad> & { reward: number; required_seconds: number; per_user_limit: number; status: string }): Promise<ActionResult>;
  adminDeleteAd(id: string): Promise<ActionResult>;
  adminUpsertTask(t: Partial<Task> & { reward: number; requires_proof: boolean; status: string }): Promise<ActionResult>;
  adminSubmissions(): Promise<Submission[]>;
  adminReviewSubmission(id: string, approve: boolean): Promise<ActionResult>;
  adminCampaigns(): Promise<(Campaign & { user: MiniUser })[]>;
  adminCampaignAction(id: string, action: "approve" | "reject" | "pause" | "resume" | "refund"): Promise<ActionResult>;
  adminEditCampaign(id: string, patch: { title?: string; description?: string; url?: string }): Promise<ActionResult>;
  adminRounds(): Promise<BidRound[]>;
  adminRoundAction(action: "start" | "end" | "cancel", opts?: { bid_amount?: number; timer_sec?: number }): Promise<ActionResult>;
  adminWithdrawals(): Promise<(Withdrawal & { user: MiniUser })[]>;
  adminSetWithdrawal(id: string, status: string): Promise<ActionResult>;
  adminGetSettings(): Promise<Settings>;
  adminSaveSettings(s: Settings): Promise<ActionResult>;
}

// ─── formatting helpers ───────────────────────────────────────────────────
export const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

export const usdtOf = (coins: number, rate: number) => {
  const v = coins * rate;
  const s = parseFloat(v.toFixed(4)).toString();
  return s.includes(".") && s.split(".")[1].length < 2 ? v.toFixed(2) : s;
};

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const TX_META: Record<string, { label: string; tone: "mint" | "coral" | "gold" | "sky" }> = {
  ad_reward: { label: "Ad reward", tone: "mint" },
  click_reward: { label: "Click reward", tone: "mint" },
  task_reward: { label: "Task reward", tone: "mint" },
  bid_payment: { label: "Bid placed", tone: "coral" },
  bid_winnings: { label: "Bid & Win prize", tone: "gold" },
  platform_fee: { label: "Platform fee", tone: "sky" },
  campaign_deposit: { label: "Campaign budget", tone: "coral" },
  campaign_spend: { label: "Campaign spend", tone: "coral" },
  campaign_refund: { label: "Campaign refund", tone: "mint" },
  withdrawal: { label: "Withdrawal", tone: "coral" },
  withdrawal_refund: { label: "Withdrawal refund", tone: "mint" },
  admin_adjust: { label: "Admin adjustment", tone: "sky" },
};

export const hueOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};
