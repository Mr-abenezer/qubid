import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, type ActionResult, type Campaign } from "../lib/types";
import { haptic } from "../lib/telegram";
import { Bar, Button, Chip, Empty, Field, IcoBolt, IcoCoin, IcoEye, IcoLink, IcoMega, IcoPause, IcoPlay, IcoX, Modal, Pill } from "../components/ui";

const MAX_BUDGET = 50000;

export default function Promote() {
  const { wallet, settings, api, toast, setWalletBalance, refreshCore } = useApp();
  const [mine, setMine] = useState<Campaign[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [budget, setBudget] = useState(100);
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [busyAct, setBusyAct] = useState<string | null>(null);
  const [armedDel, setArmedDel] = useState<string | null>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [editBudget, setEditBudget] = useState(0);
  const [editBusy, setEditBusy] = useState(false);

  const load = () => api.listMyCampaigns().then(setMine).catch(() => {});
  useEffect(() => { load(); }, [api]);

  // the delete button arms for a moment — one more tap confirms, waiting disarms
  useEffect(() => {
    if (!armedDel) return;
    const t = setTimeout(() => setArmedDel(null), 2600);
    return () => clearTimeout(t);
  }, [armedDel]);

  if (!wallet || !settings) return <div className="px-4 pt-4"><div className="skeleton h-[110px] rounded-2xl" /><div className="skeleton h-[300px] mt-4 rounded-2xl" /></div>;

  const minB = settings.min_campaign_budget;
  const cap = Math.max(minB, Math.min(MAX_BUDGET, wallet.balance));
  const effBudget = Math.min(budget, cap);
  const clicks = Math.floor(effBudget / settings.click_price);
  const valid = title.trim().length >= 3 && /^https?:\/\//.test(url.trim()) && effBudget >= minB && effBudget <= wallet.balance;

  const submit = async () => {
    if (!valid) { toast("Check the title, link and budget", "err"); haptic("error"); return; }
    setBusy(true);
    const res: ActionResult = await api.createCampaign({ title: title.trim(), description: desc.trim(), url: url.trim(), image_url: image.trim(), budget: effBudget, days }).catch((e): ActionResult => ({ ok: false, error: String(e) }));
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not create campaign", "err"); return; }
    haptic("success");
    toast("Campaign is live — it's on everyone's Home now", "ok");
    if (res.balance !== undefined) setWalletBalance(res.balance);
    setTitle(""); setDesc(""); setUrl(""); setImage(""); setBudget(Math.max(minB, 100));
    refreshCore(); load();
  };

  const act = async (id: string, action: "pause" | "resume" | "delete") => {
    setBusyAct(id + action);
    const res: ActionResult = await api.ownerCampaignAction(id, action).catch((e): ActionResult => ({ ok: false, error: String(e) }));
    setBusyAct(null);
    setArmedDel(null);
    if (!res.ok) { toast(res.error ?? "Action failed", "err"); return; }
    haptic("success");
    toast(action === "pause" ? "Campaign paused — hidden from Home" : action === "resume" ? "Campaign is live on Home again" : "Campaign deleted — remaining Coins refunded", "ok");
    refreshCore(); load();
  };

  const openEdit = (c: Campaign) => { setEditing(c); setEditBudget(Math.max(c.budget, minB, c.spent)); };
  const saveEdit = async () => {
    if (!editing) return;
    setEditBusy(true);
    const res: ActionResult = await api.ownerSetCampaignBudget(editing.id, editBudget).catch((e): ActionResult => ({ ok: false, error: String(e) }));
    setEditBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not update budget", "err"); return; }
    haptic("success");
    toast("Campaign budget updated", "ok");
    if (res.balance !== undefined) setWalletBalance(res.balance);
    setEditing(null);
    refreshCore(); load();
  };

  const editMin = editing ? Math.max(minB, editing.spent) : minB;
  const editDelta = editing ? editBudget - editing.budget : 0;

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="font-display text-[19px] font-bold anim-rise">Promote</h1>
      <p className="text-[13px] text-mut mt-1 anim-rise" style={{ animationDelay: "40ms" }}>
        Publish your ad and it goes live on every user's Home screen — instantly, no approval needed.
      </p>

      {/* pitch strip */}
      <div className="card mt-4 p-4 flex items-center gap-3 border-gold/30 anim-rise" style={{ animationDelay: "80ms" }}>
        <span className="w-11 h-11 rounded-xl bg-gold/14 border border-gold/35 text-gold flex items-center justify-center shrink-0"><IcoMega size={22} /></span>
        <div className="grow text-[12.5px] text-mut leading-relaxed">
          <b className="text-ink">Live the second you publish</b>
          <span className="block text-dim">Budget is reserved up-front · unspent Coins refunded if you delete.</span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-dim">Balance</div>
          <div className="font-display text-[17px] font-bold gold-text tnum">{fmt(wallet.balance)}</div>
        </div>
      </div>

      {/* form */}
      <div className="card mt-4 p-4 anim-rise" style={{ animationDelay: "120ms" }}>
        <div className="text-[13px] font-extrabold uppercase tracking-wider text-mut mb-3">New ad</div>
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Summer sale — 50% off" className="input" /></Field>
        <Field label="Description"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={160} placeholder="One line that sells the click…" className="input resize-none" /></Field>
        <Field label="Destination URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-link.com" className="input tnum" /></Field>
        <Field label="Image URL" hint="optional"><input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…/banner.png" className="input" /></Field>

        <Field label={`Budget — ${fmt(effBudget)} Coins`} hint={`min ${fmt(minB)} · max ${fmt(MAX_BUDGET)}`}>
          <input type="range" min={minB} max={cap} step={10} value={effBudget}
            onChange={(e) => setBudget(Number(e.target.value))} className="w-full accent-[#ffc24b]" />
          <div className="flex justify-between text-[11.5px] text-dim tnum mt-1">
            <span>{fmt(minB)}</span><span>{fmt(cap)}</span>
          </div>
        </Field>
        <Field label="Duration">
          <div className="flex gap-2">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={`tap flex-1 rounded-xl border py-2.5 text-[13.5px] font-bold transition-all ${days === d ? "border-gold/50 bg-gold/12 text-gold" : "border-line text-mut hover:text-ink"}`}>
                {d} days
              </button>
            ))}
          </div>
        </Field>

        <div className="card bg-panel/70 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-mut"><IcoEye size={16} className="text-sky" /> Estimated reach</div>
          <div className="font-display text-[17px] font-bold tnum">{fmt(clicks)} <span className="text-[12px] text-mut font-body font-bold">views</span></div>
        </div>

        <Button full size="lg" className="mt-4" loading={busy} disabled={!valid} onClick={submit}>
          <IcoCoin size={18} /> Reserve {fmt(effBudget)} Coins &amp; publish
        </Button>
        <div className="flex items-center justify-center gap-1.5 text-[12px] font-bold text-mint mt-2.5">
          <IcoBolt size={13} /> Publishes instantly — no admin approval
        </div>
      </div>

      {/* my campaigns */}
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut mt-6 mb-1 anim-rise">Your campaigns</h2>
      <p className="text-[11.5px] text-dim mb-2.5">Pause, re-budget or delete anytime — unspent Coins come straight back.</p>
      {mine.length === 0 ? (
        <Empty icon={<IcoLink size={20} />} title="No campaigns yet" sub="Launch your first ad — it appears on every Home screen the moment you publish." />
      ) : (
        <div className="space-y-3">
          {mine.map((c, i) => (
            <div key={c.id} className="stagger card p-4" style={{ "--i": i } as React.CSSProperties}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-extrabold text-[14.5px] leading-tight">{c.title}</div>
                  <div className="text-[11.5px] text-dim mt-0.5">published {timeAgo(c.created_at)}</div>
                </div>
                <Pill status={c.status} />
              </div>
              <div className="mt-3">
                <Bar pct={(c.clicks / Math.max(1, c.max_clicks)) * 100} tone={c.status === "active" ? "gold" : "sky"} />
                <div className="flex justify-between text-[11.5px] mt-1.5 tnum">
                  <span className="text-mut font-bold">{fmt(c.clicks)} / {fmt(c.max_clicks)} views</span>
                  <span className="text-dim">{fmt(c.spent)} of {fmt(c.budget)} Coins spent</span>
                </div>
              </div>
              {!["rejected", "refunded"].includes(c.status) && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {c.status === "active" && (
                    <Button variant="ghost" size="sm" loading={busyAct === c.id + "pause"} onClick={() => act(c.id, "pause")}>
                      <IcoPause size={14} /> Pause
                    </Button>
                  )}
                  {c.status === "paused" && (
                    <Button variant="ghost" size="sm" loading={busyAct === c.id + "resume"} onClick={() => act(c.id, "resume")}>
                      <IcoPlay size={14} /> Resume
                    </Button>
                  )}
                  <Button variant="dark" size="sm" onClick={() => { haptic("light"); openEdit(c); }}>
                    <IcoCoin size={14} /> Edit budget
                  </Button>
                  {armedDel === c.id ? (
                    <Button variant="danger" size="sm" loading={busyAct === c.id + "delete"} onClick={() => act(c.id, "delete")}>
                      <IcoX size={14} /> Confirm delete
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => { haptic("light"); setArmedDel(c.id); }}>
                      <IcoX size={14} /> Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* edit budget */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit budget" center>
        {editing && (
          <>
            <div className="text-[13px] font-bold truncate">{editing.title}</div>
            <div className="text-[11.5px] text-dim mt-0.5 mb-3 tnum">Current budget {fmt(editing.budget)} · spent {fmt(editing.spent)}</div>
            <Field label={`New budget — ${fmt(editBudget)} Coins`} hint={`${fmt(editMin)} – ${fmt(MAX_BUDGET)}`}>
              <input type="range" min={editMin} max={MAX_BUDGET} step={10} value={Math.min(Math.max(editBudget, editMin), MAX_BUDGET)}
                onChange={(e) => setEditBudget(Number(e.target.value))} className="w-full accent-[#ffc24b]" />
            </Field>
            <div className="card bg-panel/70 p-3.5 flex items-center justify-between">
              <span className="text-[12.5px] text-mut flex items-center gap-1.5"><IcoEye size={15} className="text-sky" /> New reach</span>
              <span className="font-display text-[15px] font-bold tnum">{fmt(Math.floor(editBudget / settings.click_price))} <span className="text-[11px] text-mut font-body font-bold">views</span></span>
            </div>
            {editDelta !== 0 && (
              <div className={`text-[12px] font-bold mt-2.5 text-center ${editDelta > 0 ? "text-gold" : "text-mint"}`}>
                {editDelta > 0 ? `${fmt(editDelta)} Coins will be reserved from your balance` : `${fmt(-editDelta)} Coins will be refunded to your balance`}
              </div>
            )}
            <Button full size="lg" className="mt-4" loading={editBusy} onClick={saveEdit}>Save budget</Button>
          </>
        )}
      </Modal>

      <div className="flex items-center justify-center gap-1.5 text-[11.5px] text-dim mt-6 mb-2">
        <IcoChipNote /> Ads run until the budget is spent or the duration ends.
      </div>
    </div>
  );
}

function IcoChipNote() {
  return <span className="text-gold/70"><IcoCoin size={12} /></span>;
}
