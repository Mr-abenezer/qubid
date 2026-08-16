import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, timeLeft, type Ad, type ActionResult, type Task, type Tx } from "../lib/types";
import { haptic, openLink } from "../lib/telegram";
import { Button, Chip, CountUp, IcoBell, IcoCheck, IcoClock, IcoCoin, IcoEye, IcoLink, IcoMega, IcoPlay, IcoShield, IcoSpark, IcoUpR, Modal, Ring, SectionH, Spinner } from "../components/ui";
import { TxRow } from "./Wallet";

export default function Home() {
  const { user, wallet, settings, tasks, ads, api, openProfile, setTab, refreshTasks, refreshAds, refreshCore } = useApp();
  const [recent, setRecent] = useState<Tx[] | null>(null);
  const [activity, setActivity] = useState(false);
  const [watch, setWatch] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    api.listTransactions(6).then(setRecent).catch(() => setRecent([]));
  }, [api, wallet?.balance]);

  useEffect(() => { refreshTasks(); }, [refreshTasks]);
  useEffect(() => { refreshAds(); }, [refreshAds, wallet?.balance]);

  if (!user || !wallet || !settings) return <HomeSkeleton />;

  const availTasks = tasks.filter((t) => !t.my_status || t.my_status === "rejected");
  const adReward = settings.ad_reward ?? 5;
  const liveAds = [...ads].sort((a, b) => (a.my_completions >= a.per_user_limit ? 1 : 0) - (b.my_completions >= b.per_user_limit ? 1 : 0));
  const onReward = () => { refreshTasks(); refreshAds(); refreshCore(); };

  return (
    <div className="px-4 pt-4 pb-2">
      {/* header */}
      <div className="flex items-center gap-3 anim-rise">
        <button onClick={openProfile} className="tap rounded-full">
          <div className="relative">
            <span className="block w-11 h-11 rounded-full bg-gradient-to-br from-tg/70 to-sky/50 text-[#04182a] font-extrabold text-[15px] flex items-center justify-center border border-tg/40">
              {user.first_name.slice(0, 1).toUpperCase()}
            </span>
            {user.is_admin && <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gold border-2 border-abyss text-[#241a05] flex items-center justify-center"><IcoShield size={9} /></span>}
          </div>
        </button>
        <div className="grow min-w-0">
          <div className="text-[15.5px] font-extrabold truncate">{user.first_name}</div>
          <div className="text-[12.5px] text-mut truncate">@{user.username}</div>
        </div>
        <button onClick={() => { haptic("light"); setActivity(true); }} className="tap relative p-2.5 rounded-xl border border-line bg-panel text-mut hover:text-ink">
          <IcoBell size={19} />
          {(recent?.length ?? 0) > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-gold" />}
        </button>
      </div>

      {/* coin balance */}
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
        </div>
      </div>

      {/* watch ad — reward ad (AdsGram integration point) */}
      <div className="holo-border mt-4 anim-rise" style={{ animationDelay: "120ms" }}>
        <div className="holo-inner p-4 flex items-center gap-3.5">
          <span className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-gold/25 to-coral/15 border border-gold/35 text-gold flex items-center justify-center shrink-0">
            <IcoPlay size={22} />
          </span>
          <button
            onClick={() => { haptic("medium"); setWatch(true); }}
            className="tap grow flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-gold to-gold2 text-[#241a05] font-extrabold text-[15.5px] px-4 py-3.5 shadow-[0_8px_24px_-8px_rgba(255,194,75,0.6)] hover:brightness-105 transition-[filter]"
          >
            <IcoPlay size={18} />
            Watch Ad
            <span className="flex items-center gap-1 rounded-full bg-[#241a05]/15 px-2 py-0.5 text-[13px] tnum">
              <IcoCoin size={13} /> +{adReward}
            </span>
          </button>
        </div>
      </div>

      {/* live ads — campaigns published in Promote appear here instantly */}
      <SectionH title={`Live ads (${liveAds.length})`} />
      <div className="space-y-3">
        {liveAds.map((a, i) => {
          const done = a.my_completions >= a.per_user_limit;
          return (
            <div key={a.id} className="stagger card p-3.5" style={{ "--i": i } as React.CSSProperties}>
              <div className="flex items-start gap-3">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 border border-white/10"
                  style={{ background: `linear-gradient(140deg, hsl(${a.hue} 72% 46%), hsl(${(a.hue + 42) % 360} 70% 34%))` }}
                >
                  <IcoMega size={19} />
                </span>
                <div className="grow min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-extrabold text-[14.5px] leading-tight truncate">{a.title}</div>
                    <Chip tone="mint" className="shrink-0"><IcoCoin size={12} /> +{a.reward}</Chip>
                  </div>
                  <p className="text-[12.5px] text-mut leading-snug mt-1 line-clamp-2">{a.description}</p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <Chip tone={a.source === "campaign" ? "gold" : "tg"}>
                      {a.source === "campaign" ? <><IcoMega size={12} /> Community</> : <><IcoSpark size={12} /> Sponsored</>}
                    </Chip>
                    {a.ends_at && <Chip tone="dim"><IcoClock size={12} /> {timeLeft(a.ends_at)}</Chip>}
                    <div className="grow" />
                    {done
                      ? <Chip tone="mint"><IcoCheck size={12} /> Done</Chip>
                      : <Button size="sm" onClick={() => { haptic("medium"); setAd(a); }}><IcoUpR size={14} /> Open</Button>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {liveAds.length === 0 && (
          <div className="card p-6 text-center">
            <div className="text-[13.5px] font-bold text-mut">No ads right now</div>
            <div className="text-[12.5px] text-dim mt-1">Ads published in Promote land here the same second they go live.</div>
          </div>
        )}
      </div>

      {/* available tasks */}
      <SectionH title={`Available Tasks (${availTasks.length})`} />
      <div className="space-y-3">
        {availTasks.map((t, i) => (
          <div key={t.id} className="stagger card p-3.5" style={{ "--i": i } as React.CSSProperties}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-extrabold text-[14.5px] leading-tight">{t.title}</div>
              <Chip tone="gold"><IcoCoin size={12} /> +{t.reward}</Chip>
            </div>
            <p className="text-[12.5px] text-mut leading-snug mt-1 line-clamp-2">{t.description}</p>
            <div className="flex items-center gap-2 mt-3">
              <Chip tone="tg"><IcoMega size={12} /> Community</Chip>
              <div className="grow" />
              {t.my_status === "pending"
                ? <Chip tone="gold">In review</Chip>
                : <Button size="sm" onClick={() => { haptic("medium"); setTask(t); }}>Start</Button>}
            </div>
          </div>
        ))}
        {availTasks.length === 0 && (
          <div className="card p-6 text-center">
            <div className="text-[13.5px] font-bold text-mut">No tasks right now</div>
            <div className="text-[12.5px] text-dim mt-1">Check the live ads above — new ones land there the moment they're published.</div>
          </div>
        )}
      </div>

      {watch && <WatchAdModal reward={adReward} onClose={() => setWatch(false)} onReward={onReward} />}
      {task && <TaskModal task={task} onClose={() => setTask(null)} onDone={onReward} />}
      {ad && <AdModal ad={ad} onClose={() => setAd(null)} onDone={onReward} />}

      <Modal open={activity} onClose={() => setActivity(false)} title="Recent activity">
        <div className="card divide-y divide-line/60 overflow-hidden">
          {(recent ?? []).map((t) => <TxRow key={t.id} tx={t} showBalance />)}
          {recent?.length === 0 && <div className="p-5 text-center text-[13px] text-dim">Nothing yet.</div>}
        </div>
      </Modal>
    </div>
  );
}

/* ── Watch Ad flow — AdsGram reward ad will plug in here ──────────────────── */
function WatchAdModal({ reward, onClose, onReward }: { reward: number; onClose: () => void; onReward: () => void }) {
  const { api, toast, setWalletBalance } = useApp();
  const [phase, setPhase] = useState<"ready" | "watch" | "crediting" | "done">("ready");
  const [got, setGot] = useState(reward);
  const [deadline] = useState(() => new Date(Date.now() + 5000).toISOString());
  const settled = useRef(false);

  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(onClose, 1600);
    return () => clearTimeout(t);
  }, [phase, onClose]);

  // Coins are credited automatically the moment the timer ends — no claim tap
  const settle = async () => {
    if (settled.current) return;
    settled.current = true;
    setPhase("crediting");
    const res: ActionResult = await api.completeAd("reward-ad", "ad").catch((e): ActionResult => ({ ok: false, error: String(e) }));
    if (!res.ok) { toast(res.error ?? "Could not claim reward", "err"); onClose(); return; }
    haptic("success");
    if (res.balance !== undefined) setWalletBalance(res.balance);
    setGot(res.reward ?? reward);
    setPhase("done");
    toast(`+${res.reward ?? reward} Coins earned`, "ok");
    onReward();
  };

  return (
    <Modal open onClose={onClose} title={phase === "done" ? "Reward credited" : "Watch Ad"} center>
      <div className="flex flex-col items-center text-center">
        {phase === "done" ? (
          <div className="anim-pop flex flex-col items-center py-5">
            <div className="relative">
              <span className="text-gold"><IcoCoin size={64} /></span>
              <span className="absolute -top-2 -right-4 text-gold anim-float"><IcoSpark size={20} /></span>
              <span className="absolute -bottom-1 -left-5 text-gold/70 anim-float" style={{ animationDelay: "0.6s" }}><IcoSpark size={14} /></span>
            </div>
            <div className="font-display text-[32px] font-bold gold-text glow-gold mt-4">+{got}</div>
            <div className="text-[13px] text-mut mt-1">Coins added to your balance automatically</div>
          </div>
        ) : phase === "crediting" ? (
          <div className="flex flex-col items-center py-9">
            <Spinner size={26} className="text-gold" />
            <div className="text-[13.5px] font-bold mt-3">Adding your Coins…</div>
          </div>
        ) : (
          <>
            <div className="my-2">
              <Ring deadline={deadline} totalSec={5} size={150} onExpire={() => { haptic("medium"); settle(); }} />
            </div>
            {phase === "ready" && (
              <Button size="lg" full onClick={() => { setPhase("watch"); haptic("medium"); }}>
                <IcoPlay size={18} /> Watch · +{reward} Coins
              </Button>
            )}
            {phase === "watch" && <Chip tone="dim"><IcoClock size={12} /> Verifying — Coins land automatically…</Chip>}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Live ad flow (campaigns published in Promote — instant payout) ────────── */
function AdModal({ ad: a, onClose, onDone }: { ad: Ad; onClose: () => void; onDone: () => void }) {
  const { api, toast, setWalletBalance } = useApp();
  const totalSec = Math.max(3, a.required_seconds);
  const [phase, setPhase] = useState<"verify" | "crediting" | "done">("verify");
  const [got, setGot] = useState(a.reward);
  const [deadline] = useState(() => new Date(Date.now() + totalSec * 1000).toISOString());
  const settled = useRef(false);

  // the destination loads immediately — no confirmation step
  useEffect(() => { haptic("light"); openLink(a.url); }, [a.url]);

  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(onClose, 1600);
    return () => clearTimeout(t);
  }, [phase, onClose]);

  // Coins are credited automatically the moment the timer ends — nothing to claim
  const settle = async () => {
    if (settled.current) return;
    settled.current = true;
    setPhase("crediting");
    const res: ActionResult = await api.completeAd(a.id, a.source).catch((e): ActionResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    if (!res.ok) { toast(res.error ?? "Could not verify this view", "err"); onClose(); return; }
    haptic("success");
    if (res.balance !== undefined) setWalletBalance(res.balance);
    setGot(res.reward ?? a.reward);
    setPhase("done");
    toast(`+${res.reward ?? a.reward} Coins — view verified`, "ok");
    onDone();
  };

  return (
    <Modal open onClose={onClose} title={a.title} center>
      {phase === "done" ? (
        <div className="anim-pop flex flex-col items-center py-6 text-center">
          <div className="relative">
            <span className="text-mint"><IcoCoin size={64} /></span>
            <span className="absolute -top-2 -right-4 text-gold anim-float"><IcoSpark size={20} /></span>
            <span className="absolute -bottom-1 -left-5 text-gold/70 anim-float" style={{ animationDelay: "0.5s" }}><IcoSpark size={13} /></span>
          </div>
          <div className="font-display text-[32px] font-bold text-mint mt-4">+{got}</div>
          <div className="text-[13px] text-mut mt-1">View verified — Coins added automatically</div>
        </div>
      ) : phase === "crediting" ? (
        <div className="flex flex-col items-center py-9">
          <Spinner size={26} className="text-gold" />
          <div className="text-[13.5px] font-bold mt-3">Adding your Coins…</div>
        </div>
      ) : (
        <>
          <div className="flex justify-center">
            <Ring deadline={deadline} totalSec={totalSec} size={150} onExpire={() => { haptic("medium"); settle(); }} />
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Chip tone="mint"><IcoCoin size={12} /> +{a.reward}</Chip>
            <Chip tone="dim"><IcoEye size={12} /> Verifying your view…</Chip>
          </div>
          <p className="text-[12.5px] text-dim text-center mt-2.5 leading-relaxed">
            Coins are added automatically when the timer ends — nothing to claim.
          </p>
          <button onClick={() => { haptic("light"); openLink(a.url); }} className="tap mx-auto mt-3.5 flex items-center gap-1.5 text-[12.5px] font-bold text-sky hover:text-ink transition-colors">
            <IcoUpR size={14} /> Reopen destination
          </button>
        </>
      )}
    </Modal>
  );
}

/* ── Community task flow (ads published in Promote) ───────────────────────── */
function TaskModal({ task: t, onClose, onDone }: { task: Task; onClose: () => void; onDone: () => void }) {
  const { api, toast } = useApp();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const openTaskLink = () => {
    if (!t.link) return;
    haptic("light");
    openLink(t.link);
    if (t.my_status !== "pending") setSent(true);
  };

  const claim = async () => {
    setBusy(true);
    const res = await api.submitTask(t.id, "completed-from-home").catch((e): ActionResult & { auto?: boolean } => ({ ok: false, error: String(e) }));
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not verify", "err"); return; }
    haptic("success");
    toast(`+${res.reward ?? t.reward} Coins — task verified`, "ok");
    onDone();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={t.title}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13.5px] text-mut leading-relaxed grow">{t.description}</p>
        <Chip tone="gold" className="shrink-0"><IcoCoin size={12} /> +{t.reward}</Chip>
      </div>
      <div className="flex gap-1.5 mt-3 flex-wrap">
        <Chip tone="tg"><IcoMega size={12} /> User-published</Chip>
        {t.my_status === "pending" && <Chip tone="gold">In review</Chip>}
        {t.deadline && <Chip tone="dim"><IcoClock size={12} /> {timeAgo(t.deadline).replace("ago", "left")}</Chip>}
      </div>
      {sent ? (
        <div className="text-center py-5 anim-pop">
          <span className="inline-flex w-14 h-14 rounded-full bg-mint/12 border border-mint/35 text-mint items-center justify-center"><IcoCheck size={26} /></span>
          <div className="font-extrabold mt-3">Almost there</div>
          <p className="text-[13px] text-mut mt-1.5">Claim your reward below — verification is instant for this task.</p>
          <ClaimButton busy={busy} reward={t.reward} onClick={claim} />
        </div>
      ) : (
        <Button variant="sky" full size="lg" className="mt-4" onClick={openTaskLink}>
          {t.link ? <><IcoLink size={17} /> Open task</> : "Start task"}
        </Button>
      )}
    </Modal>
  );
}

function ClaimButton({ busy, reward, onClick }: { busy: boolean; reward: number; onClick: () => void }) {
  return (
    <Button size="lg" full className="mt-4" loading={busy} onClick={onClick}>
      {busy ? <Spinner size={16} /> : <IcoCoin size={18} />} Claim +{reward} Coins
    </Button>
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
      <div className="skeleton h-[76px] mt-4 rounded-2xl" />
      <div className="skeleton h-[120px] mt-6 rounded-2xl" />
      <div className="skeleton h-[120px] mt-3 rounded-2xl" />
    </div>
  );
}
