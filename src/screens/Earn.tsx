import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { type ActionResult, type Ad, type Task } from "../lib/types";
import { haptic, openLink } from "../lib/telegram";
import { AdArt, Button, Chip, Empty, IcoCheck, IcoClock, IcoCoin, IcoDoc, IcoLink, IcoSpark, Modal, Ring, Seg, Spinner } from "../components/ui";

const daysLeft = (isoDate: string) => {
  const d = Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
  return d <= 0 ? "ends today" : `ends in ${d}d`;
};

export default function Earn() {
  const { ads, tasks, setWalletBalance, refreshAds, refreshTasks, refreshCore } = useApp();
  const [seg, setSeg] = useState("ads");
  const [watch, setWatch] = useState<Ad | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const claimReward = (balance?: number) => {
    if (balance !== undefined) setWalletBalance(balance);
    refreshAds(); refreshTasks(); refreshCore();
  };

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="anim-rise">
        <h1 className="font-display text-[19px] font-bold">Earn Coins</h1>
        <p className="text-[13px] text-mut mt-1">Watch ads and complete tasks — rewards are credited instantly and verified server-side.</p>
      </div>

      <div className="mt-4 anim-rise" style={{ animationDelay: "60ms" }}>
        <Seg value={seg} onChange={(v) => { setSeg(v); haptic("light"); }} options={[
          { v: "ads", label: `Ads (${ads.length})` },
          { v: "tasks", label: `Tasks (${tasks.length})` },
        ]} />
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[104px] rounded-2xl" />)}</div>
      ) : seg === "ads" ? (
        <div className="mt-4 space-y-3">
          {ads.map((a, i) => {
            const left = a.per_user_limit - a.my_completions;
            const done = left <= 0;
            return (
              <div key={a.id} className="stagger card p-3 flex gap-3" style={{ "--i": i } as React.CSSProperties}>
                <AdArt hue={a.hue} title={a.title} className="w-[86px] h-[86px]" />
                <div className="grow min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-extrabold text-[14.5px] leading-tight">{a.title}</div>
                    <Chip tone="gold"><IcoCoin size={12} /> +{a.reward}</Chip>
                  </div>
                  <p className="text-[12.5px] text-mut leading-snug mt-1 line-clamp-2">{a.description}</p>
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <Chip tone="dim"><IcoClock size={12} /> {a.required_seconds}s</Chip>
                    {a.source === "campaign" && <Chip tone="tg">Sponsored</Chip>}
                    {!done ? <Chip tone="mint">{left} left</Chip> : <Chip tone="dim">Done</Chip>}
                    <div className="grow" />
                    <Button size="sm" variant={done ? "ghost" : "gold"} disabled={done} onClick={() => { haptic("medium"); setWatch(a); }}>
                      {done ? "Completed" : "Watch"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {ads.length === 0 && <Empty icon={<IcoDoc size={22} />} title="No ads available" sub="Advertisers are setting up new campaigns. Check back shortly." />}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {tasks.map((t, i) => (
            <div key={t.id} className="stagger card p-4" style={{ "--i": i } as React.CSSProperties}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-extrabold text-[14.5px] leading-tight">{t.title}</div>
                <Chip tone="gold"><IcoCoin size={12} /> +{t.reward}</Chip>
              </div>
              <p className="text-[12.5px] text-mut leading-snug mt-1">{t.description}</p>
              <div className="flex items-center gap-2 mt-3">
                {t.requires_proof && <Chip tone="sky">Proof required</Chip>}
                {t.deadline && <Chip tone="dim"><IcoClock size={12} /> {daysLeft(t.deadline)}</Chip>}
                <div className="grow" />
                {t.my_status === "pending" ? <Chip tone="gold">In review</Chip>
                  : t.my_status === "approved" ? <Chip tone="mint"><IcoCheck size={12} /> Completed</Chip>
                    : <Button size="sm" onClick={() => { haptic("medium"); setTask(t); }}>Start task</Button>}
              </div>
            </div>
          ))}
          {tasks.length === 0 && <Empty icon={<IcoCheck size={22} />} title="All tasks completed" sub="New tasks are published regularly — you're all caught up." />}
        </div>
      )}

      {watch && <WatchModal ad={watch} onClose={() => setWatch(null)} onClaimed={claimReward} />}
      {task && <TaskModal task={task} onClose={() => setTask(null)} onDone={claimReward} />}
    </div>
  );
}

/* Module-scope modals: survive parent re-renders, keep countdown state intact */

function WatchModal({ ad, onClose, onClaimed }: { ad: Ad; onClose: () => void; onClaimed: (balance?: number) => void }) {
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
    <Modal open onClose={onClose} title={phase === "done" ? "Reward credited" : "Watching ad"}>
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

function TaskModal({ task: t, onClose, onDone }: { task: Task; onClose: () => void; onDone: (balance?: number) => void }) {
  const { api, toast } = useApp();
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (t.requires_proof && proof.trim().length < 3) { toast("Add your proof before submitting", "err"); return; }
    setBusy(true);
    const res = await api.submitTask(t.id, proof.trim()).catch((e): ActionResult & { auto?: boolean } => ({ ok: false, error: String(e) }));
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not submit", "err"); return; }
    haptic("success");
    if (res.auto) {
      toast(`+${res.reward ?? t.reward} Coins — task verified`, "ok");
      onDone(res.balance);
      onClose();
    } else {
      setSent(true);
      onDone(res.balance);
    }
  };

  return (
    <Modal open onClose={onClose} title={sent ? "Submission received" : t.title}>
      {sent ? (
        <div className="text-center py-6 anim-pop">
          <span className="inline-flex w-14 h-14 rounded-full bg-mint/12 border border-mint/35 text-mint items-center justify-center"><IcoCheck size={26} /></span>
          <div className="font-extrabold mt-3">Pending review</div>
          <p className="text-[13px] text-mut mt-1.5 max-w-[280px] mx-auto">An admin verifies every submission. Your +{t.reward} Coins land the moment it's approved.</p>
          <Button className="mt-5" full onClick={onClose}>Got it</Button>
        </div>
      ) : (
        <>
          <p className="text-[13.5px] text-mut leading-relaxed">{t.description}</p>
          <div className="card bg-panel/60 p-3.5 mt-3">
            <div className="text-[11.5px] font-bold uppercase tracking-wider text-mut mb-1.5">Instructions</div>
            <div className="text-[13.5px] leading-relaxed">{t.instructions}</div>
          </div>
          {t.link && (
            <Button variant="sky" full className="mt-3" onClick={() => openLink(t.link!)}>
              <IcoLink size={17} /> Open link
            </Button>
          )}
          {t.requires_proof && (
            <div className="mt-3">
              <div className="text-[12.5px] font-bold uppercase tracking-wider text-mut mb-1.5">Your proof</div>
              <textarea value={proof} onChange={(e) => setProof(e.target.value)} rows={3}
                placeholder="Screenshot link, completion code, timestamp…" className="input resize-none" />
            </div>
          )}
          <Button full size="lg" className="mt-4" loading={busy} onClick={submit}>
            {t.requires_proof ? "Submit for review" : `Complete & claim +${t.reward}`}
          </Button>
          {busy && <div className="flex justify-center mt-3 text-mut"><Spinner size={16} /></div>}
        </>
      )}
    </Modal>
  );
}
