import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, type ActionResult, type Ad, type Tx } from "../lib/types";
import { haptic, openLink } from "../lib/telegram";
import { AdArt, Avatar, Button, Chip, CountUp, IcoBell, IcoCheck, IcoChev, IcoClock, IcoCoin, IcoFlame, IcoGavel, IcoGift, IcoMega, IcoPlay, IcoShield, IcoSpark, Modal, Ring, SectionH, Spinner } from "../components/ui";
import { TxRow } from "./Wallet";

export default function Home() {
  const { user, wallet, settings, ads, round, api, setTab, openProfile, openAdmin, toast, refreshAds, refreshCore, setWalletBalance } = useApp();
  const [recent, setRecent] = useState<Tx[] | null>(null);
  const [activity, setActivity] = useState(false);
  const [task, setTask] = useState<Ad | null>(null);

  useEffect(() => {
    api.listTransactions(6).then(setRecent).catch(() => setRecent([]));
  }, [api, wallet?.balance]);

  if (!user || !wallet || !settings) return <HomeSkeleton />;

  // tasks = ads published by users through the Promote tab
  const tasks = ads.filter((a) => a.source === "campaign");
  const openTasks = tasks.filter((a) => a.my_completions < a.per_user_limit);
  const r = round?.round;
  const live = r?.status === "running";

  const watchAd = () => {
    haptic("medium");
    toast("Reward video ads (AdsGram) are being wired up — launching very soon!", "info");
  };

  const claimTask = (balance?: number) => {
    if (balance !== undefined) setWalletBalance(balance);
    refreshAds();
    refreshCore();
  };

  return (
    <div className="px-4 pt-4 pb-2">
      {/* header */}
      <div className="flex items-center gap-3 anim-rise">
        <button onClick={openProfile} className="tap rounded-full">
          <Avatar name={`${user.first_name} ${user.last_name ?? ""}`} photo={user.photo_url} size={44} />
        </button>
        <div className="grow min-w-0">
          <div className="text-[15.5px] font-extrabold truncate">
            {user.first_name}
            {user.is_admin && <IcoShield size={14} className="inline ml-1.5 -mt-0.5 text-gold" />}
          </div>
          <div className="text-[12.5px] text-mut truncate">@{user.username}</div>
        </div>
        <button onClick={() => { haptic("light"); setActivity(true); }} className="tap relative p-2.5 rounded-xl border border-line bg-panel text-mut hover:text-ink">
          <IcoBell size={19} />
          {(recent?.length ?? 0) > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-gold" />}
        </button>
      </div>

      {/* balance card */}
      <div className="card sheen mt-4 p-5 anim-rise" style={{ animationDelay: "60ms" }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-mut">Coin balance</div>
            <div className="flex items-center gap-2.5 mt-2">
              <span className="text-gold"><IcoCoin size={30} /></span>
              <span className="font-display text-[34px] leading-none font-bold glow-gold"><CountUp value={wallet.balance} /></span>
            </div>
          </div>
          <button onClick={() => setTab("wallet")} className="tap mt-1 px-3.5 py-2 rounded-xl bg-gold text-[#241a05] text-[13px] font-extrabold shadow-[0_6px_18px_-6px_rgba(255,194,75,0.55)]">
            Withdraw
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          <Chip tone="mint">Today +{fmt(wallet.today_earned)}</Chip>
          <Chip tone="gold">Total earned {fmt(wallet.total_earned)}</Chip>
          <Chip tone="dim">{openTasks.length} tasks open</Chip>
        </div>
      </div>

      {/* watch-ad reward card (AdsGram — integration in progress) */}
      <button onClick={watchAd} className="tap holo-border block w-full mt-4 text-left anim-rise" style={{ animationDelay: "110ms" }}>
        <div className="holo-inner p-4 flex items-center gap-4">
          <span className="relative shrink-0">
            <span className="absolute inset-0 rounded-full border border-coral/40" style={{ animation: "radar 2.2s ease-out infinite" }} />
            <span className="relative w-14 h-14 rounded-full flex items-center justify-center text-[#2b0d12] shadow-[0_8px_24px_-6px_rgba(255,107,122,0.65)]"
              style={{ background: "linear-gradient(135deg,#ff8f6b 0%,#ff6b7a 55%,#e84f8a 100%)" }}>
              <IcoPlay size={24} />
            </span>
          </span>
          <span className="grow min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-display text-[15.5px] font-bold">Watch Ad, Get Paid</span>
              <span className="rounded-full bg-sky/15 border border-sky/40 text-sky text-[9px] font-black uppercase tracking-[0.12em] px-2 py-[3px]">AdsGram</span>
            </span>
            <span className="block text-[12.5px] text-mut mt-1 leading-snug">
              30-second reward videos · instant payout · <b className="text-ink">integrating now</b>
            </span>
          </span>
          <span className="shrink-0 flex flex-col items-end gap-1.5">
            <span className="anim-coinbob text-gold"><IcoCoin size={26} /></span>
            <span className="font-display text-[15px] font-bold text-gold tnum">+{settings.ad_reward}</span>
          </span>
        </div>
      </button>

      {/* bid & win live strip */}
      <button onClick={() => setTab("arena")} className="tap card w-full mt-3 p-4 text-left border-gold/40 anim-rise group" style={{ animationDelay: "150ms" }}>
        <div className="flex items-center gap-3.5">
          <span className="relative shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-[#2b1300]"
            style={{ background: "linear-gradient(135deg,#ffd76a 0%,#ff9440 55%,#ff5e62 100%)" }}>
            <IcoGavel size={22} />
            <span className="absolute -top-1.5 -right-1.5 flex items-center gap-[3px] rounded-full bg-abyss border border-coral/60 px-1.5 py-[2px] text-[8px] font-black tracking-wider text-coral">
              <IcoFlame size={9} />LIVE
            </span>
          </span>
          <span className="grow min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-extrabold text-[15px]">Bid &amp; Win</span>
              {live
                ? <span className="flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-wider text-mint"><span className="w-1.5 h-1.5 rounded-full bg-mint" style={{ animation: "pulsedot 1.4s infinite" }} />Round #{r?.number} live</span>
                : <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-dim">Round ended</span>}
            </span>
            <span className="block text-[12.5px] text-mut mt-0.5 tnum">
              {live
                ? <>Prize pool <b className="text-gold">{fmt(r?.pool ?? 0)}</b> Coins · beat the last bid by 1</>
                : "A fresh round starts in seconds — min bid resets to 10"}
            </span>
          </span>
          <IcoChev size={18} className="text-dim group-hover:text-gold transition-colors shrink-0" />
        </div>
      </button>

      {/* quick actions */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <button onClick={() => setTab("promote")} className="tap stagger card p-4 text-left hover:border-line2 transition-colors" style={{ "--i": 3 } as React.CSSProperties}>
          <span className="text-coral"><IcoMega size={21} /></span>
          <div className="font-extrabold text-[15px] mt-2.5">Post an Ad</div>
          <div className="text-[12.5px] text-mut mt-0.5">{settings.click_price} Coins / completion</div>
        </button>
        <button onClick={() => setTab("invite")} className="tap stagger card p-4 text-left border-mint/30 hover:border-mint/50 transition-colors" style={{ "--i": 4 } as React.CSSProperties}>
          <span className="flex items-center justify-between">
            <span className="text-mint"><IcoGift size={21} /></span>
            <span className="rounded-full bg-mint/12 border border-mint/35 text-mint text-[10px] font-black px-2 py-[3px] tnum">+{settings.referral_bonus ?? 30}</span>
          </span>
          <div className="font-extrabold text-[15px] mt-2.5">Invite Friends</div>
          <div className="text-[12.5px] text-mut mt-0.5">+{settings.referral_commission ?? 5} per task they do</div>
        </button>
      </div>

      {user.is_admin && (
        <button onClick={openAdmin} className="tap card w-full mt-3 p-3.5 flex items-center gap-3 border-gold/35 text-left anim-rise" style={{ animationDelay: "200ms" }}>
          <span className="w-9 h-9 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-gold"><IcoShield size={18} /></span>
          <span className="grow">
            <span className="block font-extrabold text-[14px]">Admin Panel</span>
            <span className="block text-[12px] text-mut">Users, payouts, rounds &amp; platform settings</span>
          </span>
          <IcoChev size={17} className="text-dim" />
        </button>
      )}

      {/* community tasks — ads published by users in Promote */}
      <SectionH title="Available tasks" right={<button onClick={() => setTab("promote")} className="tap text-[12.5px] font-bold text-gold flex items-center gap-0.5">Promote yours <IcoChev size={14} /></button>} />
      <div className="space-y-3">
        {tasks.slice(0, 6).map((a, i) => {
          const done = a.my_completions >= a.per_user_limit;
          return (
            <div key={a.id} className="stagger card p-3 flex gap-3" style={{ "--i": i } as React.CSSProperties}>
              <AdArt hue={a.hue} title={a.title} className="w-[74px] h-[74px]" />
              <div className="grow min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-extrabold text-[14px] leading-tight">{a.title}</div>
                  <Chip tone="gold"><IcoCoin size={12} /> +{a.reward}</Chip>
                </div>
                <p className="text-[12.5px] text-mut leading-snug mt-1 line-clamp-2">{a.description}</p>
                <div className="flex items-center gap-2 mt-auto pt-2">
                  <Chip tone="dim"><IcoClock size={12} /> {a.required_seconds}s</Chip>
                  <Chip tone="tg">Community</Chip>
                  <div className="grow" />
                  {done
                    ? <Chip tone="mint"><IcoCheck size={12} /> Done</Chip>
                    : <Button size="sm" onClick={() => { haptic("medium"); setTask(a); }}>Start</Button>}
                </div>
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="card p-5 text-center">
            <div className="text-[13.5px] font-bold">No community tasks right now</div>
            <p className="text-[12.5px] text-mut mt-1">Be the first — publish your link in Promote and it appears here for every user.</p>
            <Button size="sm" className="mt-3" variant="dark" onClick={() => setTab("promote")}><IcoMega size={15} /> Post an Ad</Button>
          </div>
        )}
      </div>

      {/* recent activity */}
      <SectionH title="Recent activity" right={<button onClick={() => setTab("wallet")} className="tap text-[12.5px] font-bold text-gold flex items-center gap-0.5">History <IcoChev size={14} /></button>} />
      <div className="card divide-y divide-line/60 overflow-hidden">
        {recent === null && <div className="p-4 flex justify-center text-mut"><Spinner /></div>}
        {recent?.slice(0, 4).map((t) => <TxRow key={t.id} tx={t} />)}
        {recent?.length === 0 && <div className="p-5 text-center text-[13px] text-dim">Your earnings will appear here.</div>}
      </div>
      <div className="text-center text-[11px] text-dim mt-5 mb-1">
        1 Coin = {settings.coin_usdt_rate} USDT · Balances are secured server-side
      </div>

      <Modal open={activity} onClose={() => setActivity(false)} title="Recent activity">
        <div className="card divide-y divide-line/60 overflow-hidden">
          {(recent ?? []).map((t) => <TxRow key={t.id} tx={t} showBalance />)}
          {recent?.length === 0 && <div className="p-5 text-center text-[13px] text-dim">Nothing yet.</div>}
        </div>
      </Modal>

      {task && <TaskModal ad={task} onClose={() => setTask(null)} onClaimed={claimTask} />}
    </div>
  );
}

/* Task = an ad published by another user. Open the link, verify the view,
   claim the reward — completion is credited by the server. */
function TaskModal({ ad, onClose, onClaimed }: { ad: Ad; onClose: () => void; onClaimed: (balance?: number) => void }) {
  const { api, toast } = useApp();
  const [phase, setPhase] = useState<"watch" | "claim" | "done">("watch");
  const [deadline] = useState(() => new Date(Date.now() + ad.required_seconds * 1000).toISOString());
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState(ad.reward);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const t = setTimeout(() => openLink(ad.url), 650);
    return () => clearTimeout(t);
  }, [ad.url]);

  const claim = async () => {
    setBusy(true);
    const res: ActionResult = await api.completeAd(ad.id, ad.source).catch((e): ActionResult => ({ ok: false, error: String(e) }));
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not claim reward", "err"); onClose(); return; }
    haptic("success");
    setReward(res.reward ?? ad.reward);
    setPhase("done");
    toast(`+${res.reward ?? ad.reward} Coins earned`, "ok");
    onClaimed(res.balance);
  };

  return (
    <Modal open onClose={onClose} title={phase === "done" ? "Reward credited" : "Completing task"}>
      <div className="flex flex-col items-center text-center">
        {phase !== "done" ? (
          <>
            <AdArt hue={ad.hue} title={ad.title} className="w-full h-[120px] mb-4" />
            <div className="font-extrabold text-[15px]">{ad.title}</div>
            <p className="text-[12.5px] text-mut mt-1 max-w-[280px]">Keep this open — your completion is verified when the timer ends.</p>
            <div className="my-5">
              <Ring deadline={deadline} totalSec={ad.required_seconds} size={140} onExpire={() => { setPhase("claim"); haptic("medium"); }} />
            </div>
            {phase === "watch"
              ? <Chip tone="dim"><IcoClock size={12} /> Verifying your view…</Chip>
              : <Button size="lg" full loading={busy} onClick={claim}><IcoCoin size={18} /> Claim +{ad.reward} Coins</Button>}
          </>
        ) : (
          <div className="anim-pop flex flex-col items-center py-4">
            <div className="relative">
              <span className="text-gold"><IcoCoin size={64} /></span>
              <span className="absolute -top-2 -right-4 text-gold anim-float"><IcoSpark size={20} /></span>
              <span className="absolute -bottom-1 -left-5 text-gold/70 anim-float" style={{ animationDelay: "0.6s" }}><IcoSpark size={14} /></span>
            </div>
            <div className="font-display text-[30px] font-bold gold-text glow-gold mt-4">+{reward}</div>
            <div className="text-[13px] text-mut mt-1">Coins added to your balance</div>
            <Button className="mt-5" full onClick={onClose}>Keep earning</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function HomeSkeleton() {
  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-3">
        <div className="skeleton w-11 h-11 rounded-full" />
        <div className="grow"><div className="skeleton h-4 w-32 mb-2" /><div className="skeleton h-3 w-20" /></div>
      </div>
      <div className="skeleton h-[130px] mt-4 rounded-2xl" />
      <div className="skeleton h-[84px] mt-4 rounded-2xl" />
      <div className="skeleton h-[72px] mt-3 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 mt-3">{[0, 1].map((i) => <div key={i} className="skeleton h-[104px] rounded-2xl" />)}</div>
      <div className="skeleton h-[120px] mt-6 rounded-2xl" />
    </div>
  );
}
