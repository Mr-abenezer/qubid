import { useCallback, useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, usdtOf, type AdminStats, type AdminUserRow, type Ad, type BidRound, type Campaign, type Deposit, type MiniUser, type Settings, type Submission, type Task, type Tx, type Withdrawal } from "../lib/types";
import { haptic } from "../lib/telegram";
import { Avatar, Bar, Button, Chip, CopyBtn, Empty, Field, IcoBan, IcoCheck, IcoChev, IcoCoin, IcoDoc, IcoDownL, IcoGear, IcoGavel, IcoMega, IcoPause, IcoPlay, IcoPlus, IcoRefresh, IcoSearch, IcoShield, IcoStop, IcoUsers, IcoWallet, IcoX, Modal, Pill, Spinner, Toggle } from "../components/ui";
import { TxRow } from "./Wallet";

type ATab = "overview" | "users" | "content" | "campaigns" | "rounds" | "withdrawals" | "deposits" | "settings";
const TABS: { v: ATab; label: string; icon: React.ReactNode }[] = [
  { v: "overview", label: "Overview", icon: <IcoDoc size={15} /> },
  { v: "users", label: "Users", icon: <IcoUsers size={15} /> },
  { v: "content", label: "Ads & Tasks", icon: <IcoDoc size={15} /> },
  { v: "campaigns", label: "Campaigns", icon: <IcoMega size={15} /> },
  { v: "rounds", label: "Bid & Win", icon: <IcoGavel size={15} /> },
  { v: "withdrawals", label: "Withdrawals", icon: <IcoWallet size={15} /> },
  { v: "deposits", label: "Deposits", icon: <IcoDownL size={15} /> },
  { v: "settings", label: "Settings", icon: <IcoGear size={15} /> },
];

export default function Admin({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<ATab>("overview");
  const { user } = useApp();
  return (
    <div className="fixed inset-0 z-[60] bg-abyss overflow-y-auto hide-scroll">
      <div className="max-w-md mx-auto px-4 pt-4 pb-24">
        <div className="flex items-center gap-3 anim-rise">
          <span className="w-10 h-10 rounded-xl bg-gold/14 border border-gold/35 text-gold flex items-center justify-center"><IcoShield size={20} /></span>
          <div className="grow">
            <div className="font-display text-[17px] font-bold">Admin Panel</div>
            <div className="text-[11.5px] text-mut">@{user?.username} · verified server-side</div>
          </div>
          <button onClick={onClose} className="tap p-2.5 rounded-xl border border-line text-mut hover:text-ink"><IcoX size={18} /></button>
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scroll mt-4 -mx-4 px-4">
          {TABS.map((t) => (
            <button key={t.v} onClick={() => { setTab(t.v); haptic("light"); }}
              className={`tap shrink-0 flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12.5px] font-bold transition-all ${tab === t.v ? "border-gold/50 bg-gold/12 text-gold" : "border-line text-mut hover:text-ink"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="mt-4" key={tab}>
          {tab === "overview" && <Overview />}
          {tab === "users" && <Users />}
          {tab === "content" && <Content />}
          {tab === "campaigns" && <Campaigns />}
          {tab === "rounds" && <Rounds />}
          {tab === "withdrawals" && <Withdrawals />}
          {tab === "deposits" && <Deposits />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}

/* ── overview ── */
function Overview() {
  const { api } = useApp();
  const [s, setS] = useState<AdminStats | null>(null);
  useEffect(() => { api.adminStats().then(setS).catch(() => setS(null)); }, [api]);
  if (!s) return <div className="space-y-3"><div className="skeleton h-[90px] rounded-2xl" /><div className="skeleton h-[180px] rounded-2xl" /></div>;
  const t = s.totals;
  const max = Math.max(1, ...s.last7.map((d) => d.earned));
  const tiles: { l: string; v: string; tone?: string }[] = [
    { l: "Total users", v: fmt(t.users) }, { l: "New today", v: fmt(t.new_today), tone: "text-mint" },
    { l: "Coins issued", v: fmt(t.coins_issued), tone: "text-gold" }, { l: "Coins spent", v: fmt(t.coins_spent) },
    { l: "Ad earnings", v: fmt(t.ad_earnings), tone: "text-mint" }, { l: "Task earnings", v: fmt(t.task_earnings), tone: "text-mint" },
    { l: "Click rewards", v: fmt(t.click_earnings) }, { l: "Campaign clicks", v: fmt(t.campaign_clicks) },
    { l: "Campaign spend", v: fmt(t.campaign_spend) }, { l: "Bid volume", v: fmt(t.bid_volume), tone: "text-gold" },
    { l: "Platform fees", v: fmt(t.platform_fees), tone: "text-sky" }, { l: "WD pending", v: fmt(t.withdrawals_pending), tone: t.withdrawals_pending > 0 ? "text-coral" : "" },
  ];
  return (
    <div className="anim-fade">
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((x, i) => (
          <div key={x.l} className="stagger card p-3" style={{ "--i": i } as React.CSSProperties}>
            <div className={`font-display text-[16px] font-bold tnum ${x.tone ?? ""}`}>{x.v}</div>
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-dim mt-1 leading-tight">{x.l}</div>
          </div>
        ))}
      </div>

      <div className="card p-4 mt-4">
        <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut mb-3">Coins earned · last 7 days</div>
        <div className="flex items-end gap-2 h-[110px]">
          {s.last7.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[9.5px] text-dim tnum">{d.earned}</span>
              <div className="w-full rounded-t-md bg-gradient-to-t from-gold2/70 to-gold bar-grow" style={{ height: `${Math.max(6, (d.earned / max) * 78)}%`, animationDelay: `${i * 60}ms` }} />
              <span className="text-[10px] font-bold text-mut">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-4 divide-y divide-line/60 overflow-hidden">
        <div className="px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-wider text-mut">Newest users</div>
        {s.recent_users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar name={u.username} photo={u.photo_url} size={32} />
            <div className="grow text-[13px] font-bold truncate">@{u.username}</div>
            <span className="text-[12px] text-mut tnum">{fmt(u.balance)} C</span>
            <span className="text-[11px] text-dim">{timeAgo(u.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── users ── */
function Users() {
  const { api, toast } = useApp();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [sel, setSel] = useState<AdminUserRow | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [amt, setAmt] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState("");

  const load = useCallback(() => { api.adminUsers(q).then(setRows).catch(() => setRows([])); }, [api, q]);
  useEffect(load, [load]);

  const open = (u: AdminUserRow) => { setSel(u); api.adminUserTxns(u.id).then(setTxs).catch(() => setTxs([])); };
  const adjust = async (delta: number) => {
    if (!sel) return;
    const n = Math.floor(Number(amt) || 0);
    if (n <= 0) { toast("Enter an amount", "err"); return; }
    setBusy(delta > 0 ? "c" : "d");
    const res = await api.adminAdjust(sel.id, delta > 0 ? n : -n, reason.trim() || (delta > 0 ? "Admin credit" : "Admin debit"));
    setBusy("");
    if (!res.ok) { toast(res.error ?? "Failed", "err"); return; }
    toast(`${delta > 0 ? "Credited" : "Debited"} ${n} Coins`, "ok"); setAmt(""); setReason(""); load(); open(sel);
  };
  const setStatus = async (status: string) => {
    if (!sel) return;
    const res = await api.adminSetUserStatus(sel.id, status);
    if (!res.ok) { toast(res.error ?? "Failed", "err"); return; }
    toast(`User ${status === "active" ? "activated" : status}`, "ok"); load(); setSel({ ...sel, status });
  };

  return (
    <div className="anim-fade">
      <div className="relative">
        <IcoSearch size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, @username or Telegram ID" className="input !pl-10" />
      </div>
      {!rows ? <div className="skeleton h-[180px] mt-3 rounded-2xl" /> : (
        <div className="card mt-3 divide-y divide-line/60 overflow-hidden">
          {rows.map((u) => (
            <button key={u.id} onClick={() => open(u)} className="tap w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-panel2/40">
              <Avatar name={u.username} photo={u.photo_url} size={36} />
              <div className="grow min-w-0">
                <div className="text-[13.5px] font-extrabold truncate">{u.first_name} <span className="text-mut font-semibold">@{u.username}</span></div>
                <div className="text-[11px] text-dim tnum">TG {u.telegram_id}</div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-extrabold gold-text tnum">{fmt(u.balance)}</div>
                <Pill status={u.status} />
              </div>
              <IcoChev size={15} className="text-dim" />
            </button>
          ))}
          {rows.length === 0 && <div className="p-6 text-center text-[13px] text-dim">No users match.</div>}
        </div>
      )}

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `@${sel.username}` : ""} tall>
        {sel && (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={sel.username} photo={sel.photo_url} size={52} />
              <div>
                <div className="font-extrabold">{sel.first_name} {sel.last_name}</div>
                <div className="text-[12px] text-mut tnum">Telegram ID {sel.telegram_id} · joined {timeAgo(sel.created_at)}</div>
                <div className="mt-1"><Pill status={sel.status} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <div className="card p-3"><div className="font-display text-[18px] font-bold gold-text tnum">{fmt(sel.balance)}</div><div className="text-[10.5px] uppercase tracking-wider text-dim font-bold mt-0.5">Balance</div></div>
              <div className="card p-3"><div className="font-display text-[18px] font-bold text-mint tnum">{fmt(sel.total_earned)}</div><div className="text-[10.5px] uppercase tracking-wider text-dim font-bold mt-0.5">Total earned</div></div>
            </div>

            <div className="card p-3.5 mt-4">
              <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut mb-2">Credit / debit Coins</div>
              <div className="flex gap-2">
                <input inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ""))} placeholder="Amount" className="input tnum" />
              </div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (ledger note)" className="input mt-2" />
              <div className="flex gap-2 mt-2.5">
                <Button variant="mint" size="sm" className="flex-1" loading={busy === "c"} onClick={() => adjust(1)}><IcoPlus size={15} /> Credit</Button>
                <Button variant="danger" size="sm" className="flex-1" loading={busy === "d"} onClick={() => adjust(-1)}><IcoX size={15} /> Debit</Button>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              {sel.status === "active"
                ? <><Button variant="dark" size="sm" className="flex-1" onClick={() => setStatus("suspended")}><IcoPause size={15} /> Suspend</Button>
                  <Button variant="danger" size="sm" className="flex-1" onClick={() => setStatus("banned")}><IcoBan size={15} /> Ban</Button></>
                : <Button variant="mint" size="sm" full onClick={() => setStatus("active")}><IcoCheck size={15} /> {sel.status === "banned" ? "Unban" : "Activate"}</Button>}
            </div>

            <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut mt-5 mb-2">Recent transactions</div>
            <div className="card divide-y divide-line/60 overflow-hidden">
              {txs.slice(0, 8).map((t) => <TxRow key={t.id} tx={t} showBalance />)}
              {txs.length === 0 && <div className="p-4 text-center text-[12.5px] text-dim">No transactions.</div>}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ── ads & tasks & submissions ── */
function Content() {
  const { api, toast, settings } = useApp();
  const [sub, setSub] = useState("ads");
  const [ads, setAds] = useState<(Ad & { status: string })[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [adModal, setAdModal] = useState<(Partial<Ad> & { status: string }) | null>(null);
  const [taskModal, setTaskModal] = useState<(Partial<Task> & { status: string }) | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = useCallback(() => {
    api.adminAds().then(setAds).catch(() => setAds([]));
    api.adminTasks().then(setTasks).catch(() => setTasks([]));
    api.adminSubmissions().then(setSubs).catch(() => setSubs([]));
  }, [api]);
  useEffect(load, [load]);

  const saveAd = async () => {
    if (!adModal) return;
    const res = await api.adminUpsertAd({ reward: settings?.ad_reward ?? 5, required_seconds: 10, per_user_limit: 1, ...adModal });
    if (!res.ok) { toast(res.error ?? "Save failed", "err"); return; }
    toast("Ad saved", "ok"); setAdModal(null); load();
  };
  const saveTask = async () => {
    if (!taskModal) return;
    const res = await api.adminUpsertTask({ reward: settings?.task_reward ?? 5, requires_proof: false, ...taskModal });
    if (!res.ok) { toast(res.error ?? "Save failed", "err"); return; }
    toast("Task saved", "ok"); setTaskModal(null); load();
  };

  return (
    <div className="anim-fade">
      <div className="flex gap-2 mb-3">
        {[["ads", "Ads"], ["tasks", "Tasks"], ["queue", `Review queue${subs?.filter((s) => s.status === "pending").length ? ` (${subs.filter((s) => s.status === "pending").length})` : ""}`]].map(([v, l]) => (
          <button key={v} onClick={() => setSub(v)} className={`tap flex-1 rounded-xl border py-2 text-[13px] font-bold ${sub === v ? "border-gold/50 bg-gold/12 text-gold" : "border-line text-mut"}`}>{l}</button>
        ))}
      </div>

      {sub === "ads" && (
        <>
          <Button size="sm" onClick={() => setAdModal({ status: "active" })}><IcoPlus size={15} /> New ad</Button>
          <div className="space-y-2.5 mt-3">
            {!ads ? <div className="skeleton h-[90px] rounded-2xl" /> : ads.map((a) => (
              <div key={a.id} className="card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-extrabold text-[14px] leading-tight">{a.title}</div>
                  <Pill status={a.status} />
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Chip tone="gold"><IcoCoin size={12} /> +{a.reward}</Chip>
                  <Chip tone="dim">{a.required_seconds}s</Chip>
                  <Chip tone="dim">limit {a.per_user_limit}/user</Chip>
                </div>
                <div className="flex gap-2 mt-2.5">
                  <Button variant="dark" size="sm" onClick={() => setAdModal(a)}>Edit</Button>
                  <Button variant={a.status === "active" ? "ghost" : "mint"} size="sm" onClick={async () => { await api.adminUpsertAd({ ...a, status: a.status === "active" ? "paused" : "active" }); toast(a.status === "active" ? "Ad paused" : "Ad resumed", "ok"); load(); }}>
                    {a.status === "active" ? <><IcoPause size={14} /> Pause</> : <><IcoPlay size={14} /> Resume</>}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDel(a.id)}><IcoX size={14} /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {sub === "tasks" && (
        <>
          <Button size="sm" onClick={() => setTaskModal({ status: "active" })}><IcoPlus size={15} /> New task</Button>
          <div className="space-y-2.5 mt-3">
            {!tasks ? <div className="skeleton h-[90px] rounded-2xl" /> : tasks.map((t) => (
              <div key={t.id} className="card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-extrabold text-[14px] leading-tight">{t.title}</div>
                  <Pill status={t.status} />
                </div>
                <div className="flex gap-1.5 mt-2">
                  <Chip tone="gold"><IcoCoin size={12} /> +{t.reward}</Chip>
                  {t.requires_proof && <Chip tone="sky">proof</Chip>}
                </div>
                <div className="flex gap-2 mt-2.5">
                  <Button variant="dark" size="sm" onClick={() => setTaskModal(t)}>Edit</Button>
                  <Button variant={t.status === "active" ? "ghost" : "mint"} size="sm" onClick={async () => { await api.adminUpsertTask({ ...t, status: t.status === "active" ? "paused" : "active" }); toast(t.status === "active" ? "Task paused" : "Task resumed", "ok"); load(); }}>
                    {t.status === "active" ? <><IcoPause size={14} /> Pause</> : <><IcoPlay size={14} /> Resume</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {sub === "queue" && (
        <div className="space-y-2.5">
          {!subs ? <div className="skeleton h-[90px] rounded-2xl" /> : subs.filter((s) => s.status === "pending").map((s) => (
            <div key={s.id} className="card p-3.5">
              <div className="flex items-center gap-2.5">
                <Avatar name={s.user.username} size={30} />
                <div className="grow text-[13px] font-bold truncate">@{s.user.username} → {s.task.title}</div>
                <Chip tone="gold">+{s.task.reward}</Chip>
              </div>
              <div className="card bg-abyss/60 p-2.5 mt-2 text-[12.5px] text-mut break-all">{s.proof}</div>
              <div className="flex gap-2 mt-2.5">
                <Button variant="mint" size="sm" className="flex-1" onClick={async () => { const r = await api.adminReviewSubmission(s.id, true); if (r.ok) { toast("Approved — Coins credited", "ok"); load(); } }}><IcoCheck size={14} /> Approve</Button>
                <Button variant="danger" size="sm" className="flex-1" onClick={async () => { const r = await api.adminReviewSubmission(s.id, false); if (r.ok) { toast("Submission rejected", "info"); load(); } }}><IcoX size={14} /> Reject</Button>
              </div>
            </div>
          ))}
          {subs?.filter((s) => s.status === "pending").length === 0 && <Empty icon={<IcoCheck size={20} />} title="Queue is clear" sub="No submissions waiting for review." />}
        </div>
      )}

      {/* ad editor */}
      <Modal open={!!adModal} onClose={() => setAdModal(null)} title={adModal?.id ? "Edit ad" : "New ad"} tall>
        {adModal && (
          <>
            <Field label="Title"><input className="input" value={adModal.title ?? ""} onChange={(e) => setAdModal({ ...adModal, title: e.target.value })} /></Field>
            <Field label="Description"><textarea className="input resize-none" rows={2} value={adModal.description ?? ""} onChange={(e) => setAdModal({ ...adModal, description: e.target.value })} /></Field>
            <Field label="Destination URL"><input className="input" value={adModal.url ?? ""} onChange={(e) => setAdModal({ ...adModal, url: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Reward"><input inputMode="numeric" className="input tnum" value={String(adModal.reward ?? 5)} onChange={(e) => setAdModal({ ...adModal, reward: Number(e.target.value) || 0 })} /></Field>
              <Field label="Seconds"><input inputMode="numeric" className="input tnum" value={String(adModal.required_seconds ?? 10)} onChange={(e) => setAdModal({ ...adModal, required_seconds: Number(e.target.value) || 5 })} /></Field>
              <Field label="Limit"><input inputMode="numeric" className="input tnum" value={String(adModal.per_user_limit ?? 1)} onChange={(e) => setAdModal({ ...adModal, per_user_limit: Number(e.target.value) || 1 })} /></Field>
            </div>
            <Field label="Status">
              <div className="flex gap-2">
                {["active", "paused"].map((s) => (
                  <button key={s} onClick={() => setAdModal({ ...adModal, status: s })} className={`tap flex-1 rounded-xl border py-2 text-[13px] font-bold capitalize ${adModal.status === s ? "border-gold/50 bg-gold/12 text-gold" : "border-line text-mut"}`}>{s}</button>
                ))}
              </div>
            </Field>
            <Button full size="lg" onClick={saveAd}>Save ad</Button>
          </>
        )}
      </Modal>

      {/* task editor */}
      <Modal open={!!taskModal} onClose={() => setTaskModal(null)} title={taskModal?.id ? "Edit task" : "New task"} tall>
        {taskModal && (
          <>
            <Field label="Title"><input className="input" value={taskModal.title ?? ""} onChange={(e) => setTaskModal({ ...taskModal, title: e.target.value })} /></Field>
            <Field label="Description"><textarea className="input resize-none" rows={2} value={taskModal.description ?? ""} onChange={(e) => setTaskModal({ ...taskModal, description: e.target.value })} /></Field>
            <Field label="Instructions"><textarea className="input resize-none" rows={2} value={taskModal.instructions ?? ""} onChange={(e) => setTaskModal({ ...taskModal, instructions: e.target.value })} /></Field>
            <Field label="Link"><input className="input" value={taskModal.link ?? ""} onChange={(e) => setTaskModal({ ...taskModal, link: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Reward"><input inputMode="numeric" className="input tnum" value={String(taskModal.reward ?? 5)} onChange={(e) => setTaskModal({ ...taskModal, reward: Number(e.target.value) || 0 })} /></Field>
              <Field label="Status">
                <div className="flex gap-2">
                  {["active", "paused"].map((s) => (
                    <button key={s} onClick={() => setTaskModal({ ...taskModal, status: s })} className={`tap flex-1 rounded-xl border py-2 text-[12.5px] font-bold capitalize ${taskModal.status === s ? "border-gold/50 bg-gold/12 text-gold" : "border-line text-mut"}`}>{s}</button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex items-center justify-between card p-3.5 mb-4">
              <span className="text-[13.5px] font-bold">Require proof submission</span>
              <Toggle on={!!taskModal.requires_proof} onChange={(v) => setTaskModal({ ...taskModal, requires_proof: v })} />
            </div>
            <Button full size="lg" onClick={saveTask}>Save task</Button>
          </>
        )}
      </Modal>

      {/* delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete ad?">
        <p className="text-[13.5px] text-mut">This permanently removes the ad and its completion records. This action is logged.</p>
        <div className="flex gap-2 mt-4">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmDel(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={async () => { if (confirmDel) { await api.adminDeleteAd(confirmDel); toast("Ad deleted", "info"); setConfirmDel(null); load(); } }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ── campaigns ── */
function Campaigns() {
  const { api, toast } = useApp();
  const [rows, setRows] = useState<(Campaign & { user: MiniUser })[] | null>(null);
  const [edit, setEdit] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ title: "", description: "", url: "" });
  const load = useCallback(() => { api.adminCampaigns().then(setRows).catch(() => setRows([])); }, [api]);
  useEffect(load, [load]);
  const openEdit = (c: Campaign) => { setEdit(c); setForm({ title: c.title, description: c.description, url: c.url }); };
  const saveEdit = async () => {
    if (!edit) return;
    const r = await api.adminEditCampaign(edit.id, form);
    if (!r.ok) { toast(r.error ?? "Save failed", "err"); return; }
    toast("Campaign updated", "ok"); setEdit(null); load();
  };
  const act = async (id: string, action: "approve" | "reject" | "pause" | "resume" | "refund") => {
    const r = await api.adminCampaignAction(id, action);
    if (!r.ok) { toast(r.error ?? "Action failed", "err"); return; }
    toast(`Campaign ${action}${["reject", "refund"].includes(action) ? " — remaining budget refunded" : ""}`, "ok");
    load();
  };
  return (
    <div className="space-y-2.5 anim-fade">
      {!rows ? <div className="skeleton h-[120px] rounded-2xl" /> : rows.map((c) => (
        <div key={c.id} className="card p-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar name={c.user.username} size={30} />
            <div className="grow min-w-0">
              <div className="font-extrabold text-[13.5px] truncate">{c.title}</div>
              <div className="text-[11px] text-dim">@{c.user.username} · {c.cpc} C/click</div>
            </div>
            <Pill status={c.status} />
          </div>
          <div className="mt-2.5"><Bar pct={(c.spent / Math.max(1, c.budget)) * 100} tone="gold" /></div>
          <div className="flex justify-between text-[11.5px] text-dim mt-1 tnum">
            <span>{fmt(c.clicks)}/{fmt(c.max_clicks)} clicks</span><span>{fmt(c.spent)}/{fmt(c.budget)} Coins</span>
          </div>
          <div className="flex gap-2 mt-2.5 flex-wrap">
            {c.status === "pending" && <><Button variant="mint" size="sm" onClick={() => act(c.id, "approve")}><IcoCheck size={14} /> Approve</Button><Button variant="danger" size="sm" onClick={() => act(c.id, "reject")}><IcoX size={14} /> Reject</Button></>}
            {c.status === "active" && <><Button variant="ghost" size="sm" onClick={() => act(c.id, "pause")}><IcoPause size={14} /> Pause</Button><Button variant="sky" size="sm" onClick={() => act(c.id, "refund")}><IcoRefresh size={14} /> Refund</Button></>}
            {c.status === "paused" && <><Button variant="mint" size="sm" onClick={() => act(c.id, "resume")}><IcoPlay size={14} /> Resume</Button><Button variant="sky" size="sm" onClick={() => act(c.id, "refund")}><IcoRefresh size={14} /> Refund</Button></>}
            <Button variant="dark" size="sm" onClick={() => openEdit(c)}>Edit</Button>
          </div>
        </div>
      ))}
      {rows?.length === 0 && <Empty icon={<IcoMega size={20} />} title="No campaigns" sub="Campaigns publish themselves to Home instantly — pause, refund or edit them here." />}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit campaign" tall>
        {edit && (
          <>
            <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Description"><textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Destination URL"><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
            <div className="card bg-panel/70 p-3 text-[12.5px] text-mut tnum">
              Budget {fmt(edit.budget)} · spent {fmt(edit.spent)} · {fmt(edit.clicks)}/{fmt(edit.max_clicks)} clicks — budget fields are locked and ledger-controlled.
            </div>
            <Button full size="lg" className="mt-4" onClick={saveEdit}>Save changes</Button>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ── rounds ── */
function Rounds() {
  const { api, toast } = useApp();
  const [rows, setRows] = useState<BidRound[] | null>(null);
  const [amount, setAmount] = useState(10); const [timer, setTimer] = useState(60);
  const load = useCallback(() => { api.adminRounds().then(setRows).catch(() => setRows([])); }, [api]);
  useEffect(load, [load]);
  return (
    <div className="anim-fade space-y-3">
      {!rows ? <div className="skeleton h-[120px] rounded-2xl" /> : rows.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-center justify-between">
            <div className="font-display text-[15px] font-bold">Round #{r.number}</div>
            <Pill status={r.status} />
          </div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <Chip tone="gold">pool {fmt(r.pool)}</Chip>
            <Chip tone="dim">{r.bid_count} bids</Chip>
            <Chip tone="dim">bid {r.bid_amount}</Chip>
            <Chip tone="dim">{r.timer_sec}s timer</Chip>
            <Chip tone="sky">{r.winner_pct}/{r.platform_pct} split</Chip>
          </div>
          {r.status === "running" && (
            <div className="flex gap-2 mt-3">
              <Button variant="dark" size="sm" className="flex-1" onClick={async () => { const x = await api.adminRoundAction("end"); if (x.ok) { toast("Round force-settled", "ok"); setTimeout(load, 600); } }}><IcoGavel size={14} /> Settle now</Button>
              <Button variant="danger" size="sm" className="flex-1" onClick={async () => { const x = await api.adminRoundAction("cancel"); if (x.ok) { toast("Round cancelled — bids refunded", "info"); setTimeout(load, 600); } }}><IcoStop size={14} /> Cancel & refund</Button>
            </div>
          )}
          {r.status !== "running" && r.winner && <div className="text-[12.5px] text-mint font-bold mt-2.5 tnum">Winner paid +{fmt(r.payout ?? 0)} Coins</div>}
        </div>
      ))}

      <div className="card p-4">
        <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut mb-3">Start a custom round</div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Starting bid (min)"><input inputMode="numeric" className="input tnum" value={String(amount)} onChange={(e) => setAmount(Number(e.target.value) || 1)} /></Field>
          <Field label="Timer (sec)"><input inputMode="numeric" className="input tnum" value={String(timer)} onChange={(e) => setTimer(Number(e.target.value) || 10)} /></Field>
        </div>
        <Button full onClick={async () => { const x = await api.adminRoundAction("start", { bid_amount: amount, timer_sec: timer }); if (x.ok) { toast(`Round started — opens at ${amount} C, ${timer}s timer`, "ok"); load(); } }}>
          <IcoPlay size={16} /> Start new round
        </Button>
      </div>
    </div>
  );
}

/* ── withdrawals ── */
function Withdrawals() {
  const { api, toast } = useApp();
  const [rows, setRows] = useState<(Withdrawal & { user: MiniUser })[] | null>(null);
  const load = useCallback(() => { api.adminWithdrawals().then(setRows).catch(() => setRows([])); }, [api]);
  useEffect(load, [load]);
  const set = async (id: string, status: string) => {
    const r = await api.adminSetWithdrawal(id, status);
    if (!r.ok) { toast(r.error ?? "Failed", "err"); return; }
    toast(status === "rejected" || status === "cancelled" ? `Withdrawal ${status} — Coins refunded` : `Marked ${status}`, "ok");
    load();
  };
  return (
    <div className="space-y-2.5 anim-fade">
      {!rows ? <div className="skeleton h-[120px] rounded-2xl" /> : rows.map((w) => (
        <div key={w.id} className="card p-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar name={w.user.username} size={32} />
            <div className="grow min-w-0">
              <div className="text-[13.5px] font-extrabold truncate">@{w.user.username}</div>
              <div className="text-[11px] text-dim tnum">{fmt(w.coins)} C → {w.usdt} USDT · {w.network} · {timeAgo(w.created_at)}</div>
            </div>
            <Pill status={w.status} />
          </div>
          {/* full payout address — always visible, one tap to copy */}
          <div className="mt-2.5 rounded-xl border border-line bg-abyss/60 p-2.5 flex items-center gap-2.5">
            <span className="grow text-[11.5px] font-semibold text-sky tnum break-all leading-relaxed select-all">{w.address}</span>
            <CopyBtn text={w.address} />
          </div>
          <div className="flex gap-2 mt-2.5 flex-wrap">
            {w.status === "pending" && <><Button variant="mint" size="sm" onClick={() => set(w.id, "approved")}><IcoCheck size={14} /> Approve</Button><Button variant="danger" size="sm" onClick={() => set(w.id, "rejected")}><IcoX size={14} /> Reject</Button></>}
            {w.status === "approved" && <><Button variant="sky" size="sm" onClick={() => set(w.id, "processing")}>Processing</Button><Button variant="danger" size="sm" onClick={() => set(w.id, "cancelled")}>Cancel</Button></>}
            {w.status === "processing" && <><Button variant="mint" size="sm" onClick={() => set(w.id, "completed")}><IcoCheck size={14} /> Complete</Button><Button variant="danger" size="sm" onClick={() => set(w.id, "cancelled")}>Cancel</Button></>}
          </div>
        </div>
      ))}
      {rows?.length === 0 && <Empty icon={<IcoWallet size={20} />} title="No withdrawal requests" sub="Pending requests will queue here for processing." />}
    </div>
  );
}

/* ── deposits (manual top-ups: USDT BEP20 + Telebirr) ── */
function Deposits() {
  const { api, toast } = useApp();
  const [rows, setRows] = useState<Deposit[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(() => { api.adminDeposits().then(setRows).catch(() => setRows([])); }, [api]);
  useEffect(load, [load]);
  const set = async (id: string, status: "approved" | "rejected") => {
    setBusyId(id + status);
    const r = await api.adminSetDeposit(id, status).catch((e) => ({ ok: false as const, error: String(e) }));
    setBusyId(null);
    if (!r.ok) { toast(r.error ?? "Failed", "err"); return; }
    haptic("success");
    const dp = rows?.find((x) => x.id === id);
    const total = dp ? dp.coins + (dp.bonus_coins ?? 0) : 0;
    toast(status === "approved" ? `Approved — ${fmt(total)} Coins credited (not withdrawable)` : "Deposit rejected — user notified", "ok");
    load();
  };
  const pending = rows?.filter((r) => r.status === "pending").length ?? 0;
  return (
    <div className="space-y-2.5 anim-fade">
      <div className="text-[11.5px] text-dim leading-relaxed">
        Verify the payment on your {""}<b className="text-mut">BEP20 wallet</b> or <b className="text-mut">Telebirr</b> before approving — approving credits the Coins instantly and can't be undone.
        {pending > 0 && <span className="text-gold font-bold"> · {pending} pending</span>}
      </div>
      {!rows ? <div className="skeleton h-[120px] rounded-2xl" /> : rows.map((dp) => (
        <div key={dp.id} className="card p-3.5">
          <div className="flex items-center gap-2.5">
            <Avatar name={dp.user?.username ?? "?"} size={32} />
            <div className="grow min-w-0">
              <div className="text-[13.5px] font-extrabold truncate">
                @{dp.user?.username ?? "unknown"}
                {(dp.bonus_coins ?? 0) > 0 && <span className="text-mint font-bold text-[11px] ml-1.5">+{fmt(dp.bonus_coins)} bonus</span>}
              </div>
              <div className="text-[11px] text-dim tnum">
                {fmt(dp.coins)} Coins · {dp.method === "Telebirr" ? `${dp.amount_birr ?? "—"} Birr` : `${dp.amount_usdt ?? "—"} USDT`} · {timeAgo(dp.created_at)}
              </div>
            </div>
            <Chip tone={dp.method === "Telebirr" ? "sky" : "mint"} className="shrink-0">{dp.method}</Chip>
            <Pill status={dp.status} />
          </div>
          <div className="mt-2.5 rounded-xl border border-line bg-abyss/60 p-2.5 flex items-center gap-2.5">
            <span className="grow text-[11.5px] font-semibold text-sky tnum break-all leading-relaxed select-all">{dp.proof}</span>
            <CopyBtn text={dp.proof} />
          </div>
          {dp.status === "pending" && (
            <div className="flex gap-2 mt-2.5">
              <Button variant="mint" size="sm" loading={busyId === dp.id + "approved"} onClick={() => set(dp.id, "approved")}><IcoCheck size={14} /> Approve · credit {fmt(dp.coins)}</Button>
              <Button variant="danger" size="sm" loading={busyId === dp.id + "rejected"} onClick={() => set(dp.id, "rejected")}><IcoX size={14} /> Reject</Button>
            </div>
          )}
        </div>
      ))}
      {rows?.length === 0 && <Empty icon={<IcoDownL size={20} />} title="No deposit requests" sub="When a user submits a USDT or Telebirr payment proof it queues here." />}
    </div>
  );
}

/* ── settings ── */
function SettingsTab() {
  const { api, toast, refreshCore } = useApp();
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // defaults for keys added in migrations 002/005 (older servers may not have them yet)
    api.adminGetSettings()
      .then((x) => setS({ referral_bonus: 30, referral_commission: 5, min_deposit: 100, deposit_bonus_pct: 0, deposit_bep20_address: "", deposit_telebirr_number: "", ...(x as Partial<Settings>) } as Settings))
      .catch(() => setS(null));
  }, [api]);
  if (!s) return <div className="skeleton h-[300px] rounded-2xl" />;
  const num = (k: keyof Settings, v: string) => setS({ ...s, [k]: Number(v) || 0 });
  const str = (k: keyof Settings, v: string) => setS({ ...s, [k]: v });
  const F = ({ k, label, step }: { k: keyof Settings; label: string; step?: string }) => (
    <Field label={label}><input inputMode="decimal" className="input tnum" step={step ?? "1"} value={String(s[k])} onChange={(e) => num(k, e.target.value)} /></Field>
  );
  return (
    <div className="anim-fade">
      <div className="card p-4">
        <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut mb-3">Economy</div>
        <div className="grid grid-cols-2 gap-x-2.5">
          <F k="ad_reward" label="Ad reward (Coins)" />
          <F k="task_reward" label="Task reward (Coins)" />
          <F k="click_price" label="Click price (Coins)" />
          <F k="click_reward" label="Click reward (Coins)" />
          <F k="min_campaign_budget" label="Min campaign budget" />
          <F k="min_withdrawal" label="Min withdrawal (Coins)" />
          <F k="coin_usdt_rate" label="1 Coin = USDT" step="0.0001" />
          <F k="daily_ad_limit" label="Daily ad limit / user" />
        </div>
      </div>
      <div className="card p-4 mt-3">
        <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut mb-3">Referral program</div>
        <div className="grid grid-cols-2 gap-x-2.5">
          <F k="referral_bonus" label="Invite bonus (Coins)" />
          <F k="referral_commission" label="Per-task commission" />
        </div>
        <div className="text-[11.5px] text-dim leading-relaxed mt-1">
          A referral is <b className="text-mut">validated when the friend completes their first task</b> — only then the invite bonus is paid. The commission applies to every task/ad the friend completes. Withdrawals are paid in <b className="text-mut">USDT · BEP20</b> only.
        </div>
      </div>
      <div className="card p-4 mt-3">
        <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut mb-3">Deposit payments</div>
        <div className="grid grid-cols-2 gap-x-2.5">
          <F k="min_deposit" label="Min deposit (Coins)" />
          <F k="deposit_bonus_pct" label="Deposit bonus (%)" />
        </div>
        <Field label="USDT wallet · BEP20 (shown to users)"><input className="input tnum" placeholder="0x…" value={s.deposit_bep20_address ?? ""} onChange={(e) => str("deposit_bep20_address", e.target.value)} /></Field>
        <Field label="Telebirr number · Ethiopia (shown to users)"><input inputMode="numeric" className="input tnum" placeholder="09xxxxxxxx" value={s.deposit_telebirr_number ?? ""} onChange={(e) => str("deposit_telebirr_number", e.target.value)} /></Field>
        <div className="text-[11.5px] text-dim leading-relaxed mt-1">
          Users top up by sending USDT or Birr to these, then submit the payment proof — you review it in the <b className="text-mut">Deposits</b> tab. Leave a field empty to hide that method.
        </div>
      </div>
      <div className="card p-4 mt-3">
        <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut mb-3">Bid &amp; Win</div>
        <div className="grid grid-cols-2 gap-x-2.5">
          <F k="bid_amount" label="Starting bid (Coins)" />
          <F k="bid_timer_sec" label="Timer (seconds)" />
          <F k="winner_pct" label="Winner %" />
          <F k="platform_pct" label="Platform %" />
        </div>
        {s.winner_pct + s.platform_pct !== 100 && <div className="text-[12px] text-coral font-bold mt-1">Winner + platform should total 100%.</div>}
      </div>
      <div className="card p-4 mt-3 flex items-center justify-between">
        <div>
          <div className="text-[13.5px] font-extrabold">Maintenance mode</div>
          <div className="text-[12px] text-mut">Pauses earning for everyone except admins.</div>
        </div>
        <Toggle on={s.maintenance_mode} onChange={(v) => setS({ ...s, maintenance_mode: v })} />
      </div>
      <Button full size="lg" className="mt-4" loading={busy} onClick={async () => {
        setBusy(true);
        const r = await api.adminSaveSettings(s);
        setBusy(false);
        if (!r.ok) { toast(r.error ?? "Save failed", "err"); return; }
        haptic("success"); toast("Settings saved — applied server-side", "ok"); refreshCore();
      }}>
        <IcoGear size={17} /> Save settings
      </Button>
      <p className="text-[11.5px] text-dim leading-relaxed mt-3 mb-2">
        Admin identity: Telegram ID {s.admin_telegram_id ?? "7734124559"} · all changes are validated and logged by the database.
      </p>
    </div>
  );
}
