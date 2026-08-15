import { useCallback, useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, type ReferralStats } from "../lib/types";
import { haptic, openLink } from "../lib/telegram";
import { Avatar, Chip, CopyBtn, IcoCheck, IcoCoin, IcoGift, IcoRefresh, IcoShare, IcoUsers } from "../components/ui";

const BOT_BASE = "https://t.me/BidX_SmartEarningsbot";

export default function Invite() {
  const { user, settings, api, toast } = useApp();
  const [stats, setStats] = useState<ReferralStats | null>(null);

  const load = useCallback(() => {
    api.getReferralStats().then(setStats).catch(() => setStats({ code: "", count: 0, earned: 0, referrals: [] }));
  }, [api]);
  useEffect(load, [load]);

  if (!user || !settings) {
    return <div className="px-4 pt-4"><div className="skeleton h-[220px] rounded-2xl" /><div className="skeleton h-[120px] mt-4 rounded-2xl" /><div className="skeleton h-[200px] mt-4 rounded-2xl" /></div>;
  }

  // defaults mirror the server values — keeps live sessions working before migration 002 lands
  const bonus = settings.referral_bonus ?? 30;
  const comm = settings.referral_commission ?? 5;
  const code = stats?.code || user.telegram_id || user.id;
  const link = `${BOT_BASE}?startapp=${code}`;
  const shareText = `I'm earning Coins on Bid X — watch ads, complete tasks and win bid pots. Join with my link and we both get +${bonus} Coins: ${link}`;
  const share = () => {
    haptic("light");
    openLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`);
  };
  const totalCompleted = (stats?.referrals ?? []).reduce((s, r) => s + r.completed, 0);

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between anim-rise">
        <div>
          <h1 className="font-display text-[19px] font-bold flex items-center gap-2">Invite Friends <IcoGift size={19} className="text-mint" /></h1>
          <p className="text-[13px] text-mut mt-1">Your link pays you twice — once when they join, then on every task they finish.</p>
        </div>
        <button onClick={() => { haptic("light"); load(); }} className="tap p-2.5 rounded-xl border border-line bg-panel text-mut hover:text-ink shrink-0"><IcoRefresh size={17} /></button>
      </div>

      {/* reward hero */}
      <div className="card sheen mt-4 p-5 anim-rise overflow-hidden relative" style={{ animationDelay: "60ms" }}>
        <div className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-mint/12 blur-[50px] pointer-events-none" />
        <div className="flex items-center gap-4 relative">
          <span className="relative shrink-0">
            <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-mint to-[#1d9e6d] flex items-center justify-center text-[#04241a] shadow-[0_10px_28px_-8px_rgba(61,220,151,0.6)]">
              <IcoGift size={30} />
            </span>
            <span className="absolute -top-2 -right-2 text-gold anim-coinbob"><IcoCoin size={20} /></span>
          </span>
          <div className="grow">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[30px] font-bold text-mint glow-gold tnum leading-none">+{bonus}</span>
              <span className="text-[13px] font-bold text-mut">Coins / friend</span>
            </div>
            <div className="text-[12.5px] text-mut mt-1.5 leading-snug">
              Credited the moment your friend joins — plus <b className="text-mint">+{comm} Coins</b> for <b className="text-ink">every task or ad</b> they complete. Forever.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-4 relative">
          <div className="card bg-abyss/50 p-3 text-center">
            <div className="font-display text-[19px] font-bold tnum">{stats ? fmt(stats.count) : "—"}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-dim mt-0.5">Friends joined</div>
          </div>
          <div className="card bg-abyss/50 p-3 text-center">
            <div className="font-display text-[19px] font-bold text-gold tnum">{stats ? `+${fmt(stats.earned)}` : "—"}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-dim mt-0.5">Coins earned</div>
          </div>
        </div>
      </div>

      {/* link card */}
      <div className="card mt-4 p-4 anim-rise" style={{ animationDelay: "110ms" }}>
        <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut">Your invite link</div>
        <div className="card bg-abyss/60 p-3 mt-2.5 text-[12.5px] font-semibold text-sky break-all tnum leading-relaxed">{link}</div>
        <div className="flex gap-2 mt-3">
          <CopyBtn text={link} label="Copy link" className="flex-1 justify-center !py-2.5" />
          <button onClick={share} className="tap flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-tg/15 border border-tg/45 text-tg px-2.5 py-2.5 text-[12px] font-extrabold hover:brightness-110 transition-all">
            <IcoShare size={14} /> Share on Telegram
          </button>
        </div>
        <div className="text-[11.5px] text-dim mt-2.5 leading-relaxed">
          Your code: <b className="text-mut tnum">{code}</b> — friends are linked to you automatically when they open the bot with this link.
        </div>
      </div>

      {/* friends list */}
      <div className="flex items-center justify-between mt-6 mb-2.5">
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut flex items-center gap-2"><IcoUsers size={15} /> Your friends</h2>
        {stats && stats.count > 0 && <Chip tone="mint">{fmt(totalCompleted)} tasks done</Chip>}
      </div>
      {!stats ? (
        <div className="skeleton h-[140px] rounded-2xl" />
      ) : stats.referrals.length === 0 ? (
        <div className="card flex flex-col items-center text-center py-9 px-6 anim-fade">
          <div className="w-12 h-12 rounded-full bg-panel2 border border-line flex items-center justify-center text-dim mb-3"><IcoGift size={22} /></div>
          <div className="font-bold text-[15px]">No friends yet</div>
          <p className="text-[13px] text-mut mt-1 max-w-[260px] leading-relaxed">Share your link — the first +{bonus} Coins are one tap away.</p>
          <button onClick={share} className="tap mt-4 inline-flex items-center gap-2 rounded-xl bg-tg/15 border border-tg/45 text-tg px-4 py-2.5 text-[13px] font-extrabold"><IcoShare size={15} /> Share now</button>
        </div>
      ) : (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {stats.referrals.map((r, i) => (
            <div key={r.id} className={`flex items-center gap-3 px-3.5 py-3 ${i === 0 ? "anim-slide" : "anim-fade"}`}>
              <Avatar name={r.user.username} photo={r.user.photo_url} size={38} />
              <div className="grow min-w-0">
                <div className="text-[13.5px] font-extrabold truncate">{r.user.first_name} <span className="text-mut font-semibold">@{r.user.username}</span></div>
                <div className="text-[11.5px] text-dim mt-0.5">joined {timeAgo(r.joined_at)} · {r.completed} tasks completed</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13.5px] font-extrabold text-gold tnum">+{fmt(r.earned)}</div>
                <div className="text-[10.5px] text-dim">Coins</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* how it works */}
      <div className="card p-4 mt-6">
        <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut mb-3">How rewards flow</div>
        {[
          { n: "1", t: "Friend opens your link", s: `They land in the bot with your code attached — no forms, no setup.`, tone: "text-sky border-sky/40 bg-sky/10" },
          { n: "2", t: `You instantly get +${bonus} Coins`, s: "Credited to your balance the second their account is created.", tone: "text-mint border-mint/40 bg-mint/10" },
          { n: "3", t: `+${comm} Coins on every task they finish`, s: "Ads, tasks, clicks — you earn a commission on all of it, automatically.", tone: "text-gold border-gold/40 bg-gold/10" },
        ].map((x) => (
          <div key={x.n} className="flex gap-3 py-2.5">
            <span className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-[12.5px] font-black ${x.tone}`}>{x.n}</span>
            <div>
              <div className="text-[13.5px] font-extrabold flex items-center gap-1.5">{x.t} <IcoCheck size={13} className="text-mint" /></div>
              <div className="text-[12.5px] text-mut leading-snug mt-0.5">{x.s}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-dim text-center mt-5 mb-1">Referral rewards are validated and credited server-side. Self-referrals and bots are filtered out.</p>
    </div>
  );
}
