import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, type ActionResult, type Campaign } from "../lib/types";
import { haptic } from "../lib/telegram";
import { Bar, Button, Chip, Empty, Field, IcoCoin, IcoEye, IcoLink, IcoMega, Pill } from "../components/ui";

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

  const load = () => api.listMyCampaigns().then(setMine).catch(() => {});
  useEffect(() => { load(); }, [api]);

  if (!wallet || !settings) return <div className="px-4 pt-4"><div className="skeleton h-[110px] rounded-2xl" /><div className="skeleton h-[300px] mt-4 rounded-2xl" /></div>;

  const cpc = settings.click_price;
  const minB = settings.min_campaign_budget;
  const clicks = Math.floor(budget / cpc);
  const valid = title.trim().length >= 3 && /^https?:\/\//.test(url.trim()) && budget >= minB && budget <= wallet.balance;

  const submit = async () => {
    if (!valid) { toast(budget > wallet.balance ? "Budget exceeds your balance" : "Check title, link and budget", "err"); haptic("error"); return; }
    setBusy(true);
    const res: ActionResult = await api.createCampaign({ title: title.trim(), description: desc.trim(), url: url.trim(), image_url: image.trim(), budget, days }).catch((e): ActionResult => ({ ok: false, error: String(e) }));
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not create campaign", "err"); return; }
    haptic("success");
    toast("Campaign submitted — pending admin approval", "ok");
    if (res.balance !== undefined) setWalletBalance(res.balance);
    setTitle(""); setDesc(""); setUrl(""); setImage(""); setBudget(Math.max(minB, 100));
    refreshCore(); load();
  };

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="font-display text-[19px] font-bold anim-rise">Promote</h1>
      <p className="text-[13px] text-mut mt-1 anim-rise" style={{ animationDelay: "40ms" }}>
        Publish your ad as a task — it goes live on every user's Home screen. You only pay for completed, verified views.
      </p>

      {/* pitch strip */}
      <div className="card mt-4 p-4 flex items-center gap-3 border-gold/30 anim-rise" style={{ animationDelay: "80ms" }}>
        <span className="w-11 h-11 rounded-xl bg-gold/14 border border-gold/35 text-gold flex items-center justify-center shrink-0"><IcoMega size={22} /></span>
        <div className="grow text-[12.5px] text-mut leading-relaxed">
          <b className="text-ink">{cpc} Coins per completed view</b> · min budget {fmt(minB)} Coins
          <span className="block text-dim">Budget is reserved up-front and refunded if rejected.</span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-dim">Balance</div>
          <div className="font-display text-[17px] font-bold gold-text tnum">{fmt(wallet.balance)}</div>
        </div>
      </div>

      {/* form */}
      <div className="card mt-4 p-4 anim-rise" style={{ animationDelay: "120ms" }}>
        <div className="text-[13px] font-extrabold uppercase tracking-wider text-mut mb-3">New ad / task</div>
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Summer sale — 50% off" className="input" /></Field>
        <Field label="Description"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={160} placeholder="One line that sells the click…" className="input resize-none" /></Field>
        <Field label="Destination URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-link.com" className="input tnum" /></Field>
        <Field label="Image URL" hint="optional"><input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…/banner.png" className="input" /></Field>

        <Field label={`Budget — ${fmt(budget)} Coins`} hint={`min ${fmt(minB)}`}>
          <input type="range" min={minB} max={Math.max(minB, Math.min(2000, wallet.balance))} step={10} value={Math.min(budget, Math.max(minB, wallet.balance))}
            onChange={(e) => setBudget(Number(e.target.value))} className="w-full accent-[#ffc24b]" />
          <div className="flex justify-between text-[11.5px] text-dim tnum mt-1">
            <span>{fmt(minB)}</span><span>{fmt(Math.max(minB, Math.min(2000, wallet.balance)))}</span>
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
          <div className="font-display text-[17px] font-bold tnum">{fmt(clicks)} <span className="text-[12px] text-mut font-body font-bold">clicks</span></div>
        </div>

        <Button full size="lg" className="mt-4" loading={busy} disabled={!valid} onClick={submit}>
          <IcoCoin size={18} /> Reserve {fmt(budget)} Coins & submit
        </Button>
        {!valid && budget > wallet.balance && <div className="text-center text-[12px] text-coral font-bold mt-2">Budget exceeds your balance of {fmt(wallet.balance)} Coins.</div>}
      </div>

      {/* my campaigns */}
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut mt-6 mb-2.5">Your campaigns</h2>
      {mine.length === 0 ? (
        <Empty icon={<IcoLink size={20} />} title="No campaigns yet" sub="Launch your first ad — approval usually takes under an hour." />
      ) : (
        <div className="space-y-3">
          {mine.map((c, i) => (
            <div key={c.id} className="stagger card p-4" style={{ "--i": i } as React.CSSProperties}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-extrabold text-[14.5px] leading-tight">{c.title}</div>
                  <div className="text-[11.5px] text-dim mt-0.5">created {timeAgo(c.created_at)} · {c.cpc} Coins/click</div>
                </div>
                <Pill status={c.status} />
              </div>
              <div className="mt-3">
                <Bar pct={(c.clicks / Math.max(1, c.max_clicks)) * 100} tone={c.status === "active" ? "gold" : "sky"} />
                <div className="flex justify-between text-[11.5px] mt-1.5 tnum">
                  <span className="text-mut font-bold">{fmt(c.clicks)} / {fmt(c.max_clicks)} clicks</span>
                  <span className="text-dim">{fmt(c.spent)} of {fmt(c.budget)} Coins spent</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
