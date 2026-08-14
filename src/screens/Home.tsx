import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, type Tx } from "../lib/types";
import { haptic } from "../lib/telegram";
import { AdArt, Avatar, Chip, CountUp, IcoBell, IcoBolt, IcoCheck, IcoChev, IcoCoin, IcoGavel, IcoMega, IcoShield, Modal, SectionH, Spinner } from "../components/ui";
import { TxRow } from "./Wallet";

export default function Home() {
  const { user, wallet, settings, ads, tasks, round, api, setTab, openProfile, openAdmin } = useApp();
  const [recent, setRecent] = useState<Tx[] | null>(null);
  const [activity, setActivity] = useState(false);

  useEffect(() => {
    api.listTransactions(6).then(setRecent).catch(() => setRecent([]));
  }, [api, wallet?.balance]);

  if (!user || !wallet || !settings) return <HomeSkeleton />;

  const availAds = ads.filter((a) => a.my_completions < a.per_user_limit).length;
  const availTasks = tasks.filter((t) => !t.my_status || t.my_status === "rejected").length;

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
          <Chip tone="dim">{ads.length + tasks.length} offers live</Chip>
        </div>
      </div>

      {/* quick actions */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <ActionTile i={0} onClick={() => setTab("earn")} icon={<IcoBolt size={21} />} tone="text-sky" title="Watch Ads" sub={`${availAds} available • +${settings.ad_reward} Coins`} />
        <ActionTile i={1} onClick={() => setTab("earn")} icon={<IcoCheck size={21} />} tone="text-mint" title="Tasks" sub={`${availTasks} open • +${settings.task_reward} Coins`} />
        <button onClick={() => setTab("arena")} className="tap stagger card p-4 text-left border-gold/40 bg-gradient-to-br from-gold/12 to-transparent" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="flex items-center justify-between">
            <span className="text-gold"><IcoGavel size={21} /></span>
            <span className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-gold">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" style={{ animation: "pulsedot 1.4s infinite" }} />Live
            </span>
          </div>
          <div className="font-extrabold text-[15px] mt-2.5">Bid &amp; Win</div>
          <div className="text-[12.5px] text-mut mt-0.5 tnum">
            {round?.round.status === "running" ? <>Pool <b className="text-gold">{fmt(round.round.pool)}</b> Coins</> : "Round ended — next soon"}
          </div>
        </button>
        <ActionTile i={3} onClick={() => setTab("promote")} icon={<IcoMega size={21} />} tone="text-coral" title="Post an Ad" sub={`${settings.click_price} Coins / click`} />
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

      {/* live offers strip */}
      <SectionH title="Available now" right={<button onClick={() => setTab("earn")} className="tap text-[12.5px] font-bold text-gold flex items-center gap-0.5">View all <IcoChev size={14} /></button>} />
      <div className="flex gap-3 overflow-x-auto hide-scroll -mx-4 px-4 pb-1">
        {ads.slice(0, 8).map((a, i) => (
          <button key={a.id} onClick={() => setTab("earn")} className="tap stagger shrink-0 w-[136px] card p-2.5 text-left" style={{ "--i": i } as React.CSSProperties}>
            <AdArt hue={a.hue} title={a.title} className="h-[74px] w-full" />
            <div className="text-[12px] font-bold leading-tight mt-2 line-clamp-2 h-[32px]">{a.title}</div>
            <div className="flex items-center gap-1 mt-1.5 text-gold text-[12px] font-extrabold"><IcoCoin size={13} /> +{a.reward}</div>
          </button>
        ))}
        {ads.length === 0 && <div className="text-[13px] text-dim py-6">No offers right now — check back soon.</div>}
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
    </div>
  );
}

function ActionTile({ i, onClick, icon, tone, title, sub }: { i: number; onClick: () => void; icon: React.ReactNode; tone: string; title: string; sub: string }) {
  return (
    <button onClick={onClick} className="tap stagger card p-4 text-left hover:border-line2 transition-colors" style={{ "--i": i } as React.CSSProperties}>
      <span className={tone}>{icon}</span>
      <div className="font-extrabold text-[15px] mt-2.5">{title}</div>
      <div className="text-[12.5px] text-mut mt-0.5">{sub}</div>
    </button>
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
      <div className="grid grid-cols-2 gap-3 mt-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[104px] rounded-2xl" />)}</div>
      <div className="skeleton h-[120px] mt-6 rounded-2xl" />
    </div>
  );
}
