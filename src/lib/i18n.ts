import { useSyncExternalStore } from "react";
import { ES, AR, AM, RU, HI, BN } from "./i18n-langs";

export type Lang = "en" | "es" | "ar" | "am" | "ru" | "hi" | "bn";

export const LANGS: { code: Lang; native: string; english: string }[] = [
  { code: "en", native: "English", english: "English" },
  { code: "es", native: "Español", english: "Spanish" },
  { code: "ar", native: "العربية", english: "Arabic" },
  { code: "am", native: "አማርኛ", english: "Amharic" },
  { code: "ru", native: "Русский", english: "Russian" },
  { code: "hi", native: "हिन्दी", english: "Hindi" },
  { code: "bn", native: "বাংলা", english: "Bengali" },
];

/* ── English — the source dictionary every other language falls back to ── */
export const EN: Record<string, string> = {
  "nav.home": "Home", "nav.promote": "Promote", "nav.arena": "Arena", "nav.invite": "Invite", "nav.wallet": "Wallet",
  "splash.verifying": "Verifying your Telegram account…", "splash.connecting": "Connecting to Telegram…",
  "splash.note": "Your Bid X account is created automatically from your Telegram ID.",
  "c.coins": "Coins", "c.close": "Close", "c.cancel": "Cancel", "c.save": "Save", "c.confirm": "Confirm",
  "c.delete": "Delete", "c.edit": "Edit", "c.copy": "Copy", "c.copied": "Copied!", "c.retry": "Retry",
  "c.loading": "Loading…", "c.pending": "Pending", "c.approved": "Approved", "c.rejected": "Rejected",
  "c.active": "Active", "c.paused": "Paused", "c.completed": "Completed", "c.refunded": "Refunded",
  "c.open": "Open", "c.done": "Done", "c.live": "Live", "c.closed": "Closed", "c.max": "Max", "c.you": "You",
  "c.days": "{n} days", "c.balance": "balance {n}",

  "h.welcome": "Welcome back",
  "h.watchAd": "Watch Ad", "h.watchCTA": "Watch · +{n} Coins",
  "h.adNotReady": "Ad system loading — please try again in a moment",
  "h.adSkipped": "Watch the full ad to earn Coins",
  "h.rewardFailed": "Could not credit reward — please try again",
  "h.rewardCredited": "+{n} Coins added to your balance", "h.verifyingView": "Verifying ad view…",
  "h.autoNote": "+{n} Coins land automatically — no claim tap",
  "h.addingCoins": "Adding your Coins…", "h.addedAuto": "Coins added to your balance automatically",
  "h.earned": "+{n} Coins earned", "h.verified": "+{n} Coins — view verified",
  "h.liveAds": "Live ads ({n})", "h.community": "Community", "h.sponsored": "Sponsored",
  "h.endsIn": "ends {x}", "h.noAds": "No ads right now",
  "h.noAdsSub": "Ads are removed the moment you complete them — new ones from Promote land here instantly.",
  "h.tasks": "Available Tasks ({n})", "h.startTask": "Start task", "h.instructions": "Instructions",
  "h.openLink": "Open link", "h.pasteProof": "Paste proof…", "h.submit": "Submit",
  "h.awaiting": "Awaiting review", "h.activity": "Recent activity", "h.keepEarning": "Keep earning",
  "h.viewSec": "{n}s view", "h.verifying": "Verifying your view…",
  "h.autoClaim": "Coins are added automatically when the timer ends — nothing to claim.",
  "h.reopen": "Reopen destination", "h.verifiedNote": "View verified — Coins added automatically",

  "h.coinBal": "Coin balance", "h.today": "Today +{n}", "h.total": "Total earned {n}",
  "h.inReview": "In review", "h.start": "Start",
  "h.noTasks": "No tasks right now",
  "h.noTasksSub": "Check the live ads above — new ones land there the moment they're published.",
  "h.nothing": "Nothing yet.",
  "h.claim": "Claim +{n} Coins", "h.almost": "Almost there",
  "h.almostSub": "Claim your reward below — verification is instant for this task.",
  "h.openTask": "Open task", "h.userPub": "User-published", "h.taskVerified": "+{n} Coins — task verified",

  "a.title": "Bid & Win",
  "a.sub": "Every bid must beat the last one by at least 1. Last bidder standing takes the pot.",
  "a.pool": "Prize pool", "a.roundN": "Coins · round #{n}", "a.minBid": "min bid {n}", "a.bids": "{n} bids",
  "a.winnerPct": "Winner {p}%", "a.platformPct": "Platform {p}%",
  "a.youLeading": "You're leading", "a.leading": "Leading · {n}",
  "a.noBids": "No bids yet", "a.openLadder": "Open the ladder at {n} Coins — the clock starts with you.",
  "a.yourBid": "Your bid", "a.overBal": "over your balance", "a.bidN": "bid {n} Coins",
  "a.bidBtn": "Bid {n} Coins", "a.bidMinBtn": "Bid min {n} Coins", "a.roundOver": "Round over", "a.waiting": "Waiting…",
  "a.notEnough": "Not enough Coins — you need at least {n} to bid.",
  "a.liveBids": "Live bids", "a.total": "{n} total",
  "a.firstBid": "The first bid starts the {n}s countdown.", "a.latest": "latest",
  "a.winners": "Recent winners", "a.roundPool": "round #{n} · pool {p}", "a.noWinners": "No rounds settled yet.",
  "a.how": "How it works",
  "a.rule1": "Bidding starts at {n} Coins. Every next bid must be at least 1 Coin above the previous one.",
  "a.rule2": "Each bid resets the timer to {s}s. At zero, the last bidder wins {p}% of the pool.",
  "a.rule3": "When a round settles, the ladder resets back to {n} for the next round. The platform keeps {p}%.",
  "a.rule4": "Timer, ladder and winner are enforced server-side — never by your device.",
  "a.settled": "Round settled", "a.youWon": "You won round #{n}!",
  "a.ofPool": "Coins · {p}% of the {t} pool", "a.collect": "Collect & continue",
  "a.outbid": "You've been outbid — strike back!",
  "a.bidLow": "A bid must be at least {n} — 1 above the last bidder.", "a.minN": "Min {n}",

  "p.title": "Promote", "p.sub": "Put your link in front of thousands of users.",
  "p.fTitle": "Title", "p.fDesc": "Description", "p.fUrl": "Link / URL", "p.fImage": "Image URL (optional)",
  "p.budget": "Budget (Coins)", "p.duration": "Duration", "p.estViews": "Estimated views",
  "p.submit": "Reserve & submit", "p.liveMsg": "Campaign is live — it's on everyone's Home now",
  "p.my": "My campaigns", "p.none": "No campaigns yet",
  "p.newAd": "New ad", "p.destUrl": "Destination URL", "p.imgHint": "optional",
  "p.budgetLbl": "Budget — {n} Coins", "p.budgetHint": "min {a} · max {b}",
  "p.reach": "Estimated reach", "p.viewsW": "views",
  "p.pubBtn": "Reserve {n} Coins & publish", "p.instant": "Publishes instantly — no admin approval",
  "p.your": "Your campaigns",
  "p.yourSub": "Pause, re-budget or delete anytime — unspent Coins come straight back.",
  "p.noneSub2": "Launch your first ad — it appears on every Home screen the moment you publish.",
  "p.published": "published {x}",
  "p.pitch1": "Live the second you publish",
  "p.pitch2": "Budget is reserved up-front · unspent Coins refunded if you delete.",
  "p.balLbl": "Balance", "p.check": "Check the title, link and budget",
  "p.paused": "Campaign paused — hidden from Home", "p.resumed": "Campaign is live on Home again",
  "p.deleted": "Campaign deleted — remaining Coins refunded",
  "p.spent": "{a} of {b} Coins spent", "p.viewsOf": "{a} / {b} views",
  "p.confirmDel": "Confirm delete",
  "p.curBudget": "Current budget {a} · spent {b}", "p.newBudgetLbl": "New budget — {n} Coins",
  "p.newReach": "New reach",
  "p.willReserve": "{n} Coins will be reserved from your balance",
  "p.willRefund": "{n} Coins will be refunded to your balance",
  "p.saveBudget": "Save budget",
  "p.foot": "Ads run until the budget is spent or the duration ends.",
  "p.noneSub": "Create your first campaign and reach thousands of users instantly.",
  "p.pause": "Pause", "p.resume": "Resume", "p.del": "Delete",
  "p.editBudget": "Edit budget", "p.newBudget": "New budget",
  "p.delAsk": "Delete this campaign? Unspent Coins are refunded instantly.",
  "p.budgetMsg": "Campaign budget updated", "p.views": "{n} views", "p.clicks": "{n} clicks",

  "i.title": "Invite Friends",
  "i.sub": "Get +{b} when a friend completes their first task — then +{c} on every task after.",
  "i.perFriend": "Coins / friend",
  "i.heroNote": "Credited when your friend completes their first task — then +{c} Coins for every task or ad after that. Forever.",
  "i.joined": "Friends joined", "i.earnedC": "Coins earned", "i.yourLink": "Your invite link",
  "i.copy": "Copy link", "i.share": "Share on Telegram",
  "i.codeNote": "Your code: {c} — friends must open the app through this link to be attached to you. Your +{b} unlocks once they complete their first task.",
  "i.friends": "Your friends", "i.tasksDone": "{n} tasks done", "i.empty": "No friends yet",
  "i.emptySub": "Share your link — the first +{b} Coins are one tap away.", "i.shareNow": "Share now",
  "i.validated": "Validated", "i.joinedAgo": "joined {x} · {n} tasks", "i.unlocks": "— +{b} unlocks on first task",
  "i.how": "How rewards flow",
  "i.step1t": "Friend opens your link",
  "i.step1s": "They land in the app with your code attached — no forms, no setup. They show up in your list as Pending.",
  "i.step2t": "They finish 1 task → you get +{b}",
  "i.step2s": "The first completed task validates the referral and unlocks your bonus instantly.",
  "i.step3t": "+{c} Coins on every task after that",
  "i.step3s": "Ads, tasks, clicks — you earn a commission on all of it, automatically. Forever.",
  "i.foot": "Referral rewards are validated and credited server-side. Self-referrals and bots are filtered out.",
  "i.friend": "Friend",

  "h.payouts": "Recent payouts", "h.payoutsLive": "Live",
  "h.payoutsTap": "Full feed",
  "h.payoutsEmpty": "Payouts appear here the moment they happen — bid wins and approved withdrawals, published for everyone to see.",
  "h.wonRound": "won {d}", "h.cashedOut": "cashed out",
  "h.payoutsNote": "Every approved withdrawal is published here automatically — real money, paid out, in the open. Only first names are shown.",
  "h.channel": "Public payouts channel",
  "h.channelSub": "Each payout is also announced in our public Telegram channel — full transparency.",
  "h.openChannel": "Open channel",
  "h.leaderboard": "Leaderboard",
  "h.lbSub": "Top 10 earners by Coin balance — first names only.",
  "h.lbYou": "You",
  "h.lbEmpty": "No rankings yet — earn Coins to claim your spot on the board.",
  "h.lbCoins": "Coins",
  "i.shareText": "I'm earning Coins on Bid X — watch ads, complete tasks and win bid pots. Join with my link and I get +{b} Coins when you finish your first task: {link}",

  "w.title": "Wallet", "w.balance": "Available balance",
  "w.withdrawable": "Withdrawable {n}", "w.deposited": "Deposited {n}",
  "w.rateNote": "1 Coin = {r} USDT. Coins convert only when you withdraw — to USDT (BEP20) or Ethiopian Birr (Telebirr). Minimum {m} Coins ({u} USDT).",
  "w.earnOnly": "Withdrawals come from earned Coins only. Deposited Coins power your bids & promotions but can't be cashed out.",
  "w.withdraw": "Withdraw", "w.withdrawSub": "Cash out earned Coins — USDT or Telebirr",
  "w.deposit": "Deposit", "w.depositSub": "Top up Coins for bids & promotions",
  "w.usdtSub": "BEP20 wallet", "w.tbSub": "Ethiopia · 09…",
  "w.receive": "You receive", "w.send": "You send exactly", "w.get": "You get",
  "w.valid": "valid", "w.minCoins": "min {n} Coins", "w.overBalC": "over balance", "w.overWd": "over withdrawable",
  "w.addrUsdt": "USDT address · BEP20 (BNB Smart Chain)", "w.addrTb": "Telebirr phone number · Ethiopia",
  "w.addrNote": "Payouts are sent in USDT on BEP20 only. Double-check your address — other networks are not supported and funds sent there cannot be recovered.",
  "w.tbFormat": "Format 09xxxxxxxx — 10 digits, starting with 09.",
  "w.digits": "{n} digits left", "w.validNum": "valid number",
  "w.birrNote": "Paid in Ethiopian Birr · 1 Coin ≈ {r} Birr (1 USDT ≈ 180 Birr)",
  "w.bonusNote": "+{p}% deposit bonus — paid together with your Coins once approved.",
  "w.payUsdt": "Send USDT to this BEP20 address", "w.payTb": "Send Birr to this Telebirr number",
  "w.notSet": "not set yet",
  "w.notSetSub": "The admin hasn't published this payment method yet — check back soon or use the other method.",
  "w.bep20Note": "BEP20 (BNB Smart Chain) only — USDT sent on any other network cannot be credited.",
  "w.proofTx": "Transaction hash", "w.proofTb": "Telebirr reference or sender number",
  "w.proofNote": "After you pay, paste the proof here — an admin verifies it and your Coins are added automatically.",
  "w.depBtn": "Submit deposit proof",
  "w.depToast": "Deposit of {n} Coins submitted — pending review",
  "w.wdToast": "Withdrawal of {n} Coins submitted via {m}",
  "w.topupTag": "Promote · Bid",
  "w.topupSub": "Want to promote your socials or bid without earning first? Send USDT or Birr and Coins are added after a quick admin check.",
  "w.wds": "Withdrawals", "w.deps": "Deposits", "w.history": "Transaction history",
  "w.all": "All", "w.earned": "Earned", "w.spent": "Spent", "w.bids": "Bids",
  "w.empty": "Nothing here yet.", "w.noWds": "No withdrawals yet", "w.noDeps": "No deposits yet",
  "w.noDepsSub": "Top up with USDT or Telebirr to promote your socials or join bids instantly.",

  "w.wdTitle": "Withdraw Coins", "w.depTitle": "Deposit Coins",
  "w.noWdsSub": "Withdraw your earned Coins to USDT (BEP20) or Telebirr when you're ready.",
  "w.minWd": "Minimum withdrawal is {n} Coins", "w.overEarned": "That's more than your withdrawable (earned) Coins",
  "w.badTb": "Enter a valid Telebirr number — 09 followed by 8 digits",
  "w.badBep": "Enter a valid BEP20 address (starts with 0x, 42 characters)",
  "w.earnedOnly": "earned only", "w.wdBtn": "Withdraw {x}",
  "w.wdFoot": "Only your {n} earned Coins can be withdrawn — deposited Coins stay for bids & promotions.",
  "w.min": "min {n}", "w.proofLbl": "proof: {x}",
  "w.depIntro": "Send USDT or Birr, paste the proof — an admin verifies it and your Coins land automatically. Deposited Coins power bids & promotions (not withdrawals).",
  "w.usdtNet": "BEP20 network", "w.copyBtn": "Copy",
  "w.proofOne": "One transaction ID = one deposit. After you pay, paste the proof here.",
  "w.rates2": "1 Coin ≈ {r} Birr · 1 USDT ≈ 180 Birr", "w.rates1": "1 Coin = {r} USDT · BEP20 only",

  "pr.title": "Profile", "pr.appearance": "Appearance", "pr.dark": "Dark", "pr.light": "Light",
  "pr.language": "Language", "pr.choose": "Choose language", "pr.joined": "Joined", "pr.totalEarned": "Total earned",
};

const DICTS: Record<Lang, Record<string, string>> = { en: EN, es: ES, ar: AR, am: AM, ru: RU, hi: HI, bn: BN };

const LS_KEY = "bidx_lang";
const ALL: Lang[] = ["en", "es", "ar", "am", "ru", "hi", "bn"];

function detect(): Lang {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && (ALL as string[]).includes(saved)) return saved as Lang;
  } catch { /* private mode */ }
  // first launch: honor the Telegram client's language
  try {
    const lc: string | undefined = (window as never as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } })
      .Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (lc) {
      const hit = ALL.find((l) => lc.toLowerCase().startsWith(l));
      if (hit) return hit;
    }
  } catch { /* not in Telegram */ }
  return "en";
}

let current: Lang = detect();
const listeners = new Set<() => void>();

function apply() {
  try {
    document.documentElement.lang = current;
    document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
  } catch { /* no DOM */ }
}
apply();

export function getLang(): Lang { return current; }
export function isRTL(l: Lang = current): boolean { return l === "ar"; }
export function subscribeLang(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function setLang(l: Lang): void {
  if (!(ALL as string[]).includes(l)) return;
  current = l;
  try { localStorage.setItem(LS_KEY, l); } catch { /* full */ }
  apply();
  listeners.forEach((f) => f());
}

/** Translate a key with optional {placeholders}; falls back to English, then the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[current]?.[key] ?? EN[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** React binding — any component using this re-renders on language change. */
export function useLang() {
  const lang = useSyncExternalStore(subscribeLang, getLang);
  return { lang, setLang, t: (key: string, vars?: Record<string, string | number>) => {
    let s = DICTS[lang]?.[key] ?? EN[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }, rtl: lang === "ar" };
}
