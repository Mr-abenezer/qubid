import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, usdtOf, TX_META, type ActionResult, type Deposit, type DepositMethod, type Tx, type Withdrawal } from "../lib/types";
import { haptic } from "../lib/telegram";
import { useLang } from "../lib/i18n";
import { Button, Chip, CountUp, Empty, IcoChev, IcoCoin, IcoCopy, IcoDownL, IcoUpR, IcoWallet, Modal, Pill, Seg } from "../components/ui";

// Payout rate for Telebirr: 1 USDT ≈ 180 Birr → 1 Coin ≈ 0.2 Birr
const BIRR_PER_COIN = 0.2;
const birrOf = (coins: number) => (coins * BIRR_PER_COIN).toLocaleString("en-US", { maximumFractionDigits: 1 });

const PhoneGlyph = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
);

export function TxRow({ tx, showBalance }: { tx: Tx; showBalance?: boolean }) {
  const meta = TX_META[tx.type] ?? { label: tx.type, tone: "sky" as const };
  const positive = tx.amount > 0;
  const Icon = positive ? IcoDownL : IcoUpR;
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${positive ? "bg-mint/10 border-mint/30 text-mint" : "bg-coral/10 border-coral/25 text-coral"}`}>
        <Icon size={16} />
      </span>
      <div className="grow min-w-0">
        <div className="text-[13.5px] font-bold truncate">{meta.label}</div>
        <div className="text-[11.5px] text-dim truncate">{tx.note || "—"}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[13.5px] font-extrabold tnum ${positive ? "text-mint" : "text-coral"}`}>{positive ? "+" : ""}{fmt(tx.amount)}</div>
        <div className="text-[10.5px] text-dim tnum">{showBalance ? `bal ${fmt(tx.balance_after)}` : timeAgo(tx.created_at)}</div>
      </div>
    </div>
  );
}

export default function Wallet() {
  const { wallet, settings, api } = useApp();
  const { t: tr } = useLang();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [wds, setWds] = useState<Withdrawal[]>([]);
  const [deps, setDeps] = useState<Deposit[]>([]);
  const [filter, setFilter] = useState("all");
  const [sheet, setSheet] = useState<null | "withdraw" | "deposit">(null);

  const load = () => {
    api.listTransactions(80).then(setTxs).catch(() => {});
    api.listMyWithdrawals().then(setWds).catch(() => {});
    api.listMyDeposits().then(setDeps).catch(() => {});
  };
  useEffect(load, [api, wallet?.balance]);

  if (!wallet || !settings) {
    return <div className="px-4 pt-4"><div className="skeleton h-[120px] rounded-2xl" /><div className="skeleton h-[140px] mt-4 rounded-2xl" /><div className="skeleton h-[180px] mt-4 rounded-2xl" /></div>;
  }

  const min = settings.min_withdrawal;
  const filtered = txs.filter((t) =>
    filter === "all" ? true
      : filter === "earned" ? t.amount > 0
        : filter === "spent" ? t.amount < 0
          : t.type === "bid_payment" || t.type === "bid_winnings"
  );

  const open = (s: "withdraw" | "deposit") => { haptic("medium"); setSheet(s); };

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="font-display text-[19px] font-bold anim-rise">{tr("w.title")}</h1>

      {/* balance */}
      <div className="card sheen mt-4 p-5 anim-rise" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-gold/14 border border-gold/35 text-gold flex items-center justify-center"><IcoWallet size={24} /></span>
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-mut">{tr("w.balance")}</div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[30px] font-bold glow-gold"><CountUp value={wallet.balance} /></span>
              <span className="text-[14px] font-bold text-mut">{tr("c.coins")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3.5 flex-wrap">
          <Chip tone="mint"><IcoCoin size={12} /> {tr("w.withdrawable", { n: fmt(wallet.withdrawable) })}</Chip>
          {wallet.balance - wallet.withdrawable > 0 && (
            <Chip tone="gold">{tr("w.deposited", { n: fmt(wallet.balance - wallet.withdrawable) })}</Chip>
          )}
        </div>
        <div className="text-[12px] text-dim mt-3 leading-relaxed">
          {tr("w.rateNote", { r: settings.coin_usdt_rate, m: fmt(min), u: usdtOf(min, settings.coin_usdt_rate) })}
        </div>
        <div className="text-[11px] text-dim mt-1.5 leading-relaxed">
          {tr("w.earnOnly")}
        </div>
      </div>

      {/* actions — two doors, no forms until you pick one */}
      <div className="mt-4 space-y-2.5">
        <ActionRow tone="mint" icon={<IcoUpR size={20} />} title={tr("w.withdraw")} delay="90ms"
          sub={tr("w.withdrawSub")}
          onClick={() => open("withdraw")} />
        <ActionRow tone="gold" icon={<IcoDownL size={20} />} title={tr("w.deposit")} delay="140ms"
          sub={tr("w.depositSub")}
          onClick={() => open("deposit")} />
      </div>

      {/* withdrawal history */}
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut mt-6 mb-2.5">{tr("w.wds")}</h2>
      {wds.length === 0 ? (
        <Empty icon={<IcoUpR size={20} />} title={tr("w.noWds")} sub={tr("w.noWdsSub")} />
      ) : (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {wds.map((w) => (
            <div key={w.id} className="px-3.5 py-3">
              <div className="flex items-center gap-2">
                <div className="grow text-[13.5px] font-extrabold tnum">{fmt(w.coins)} {tr("c.coins")} <span className="text-mut font-semibold">→ {parseFloat(String(w.usdt))} USDT</span></div>
                <Pill status={w.status} />
              </div>
              <div className="text-[11.5px] text-dim mt-1 tnum">{w.network} · ••••{w.address.slice(-6)} · {timeAgo(w.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {/* deposit history */}
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut mt-6 mb-2.5">{tr("w.deps")}</h2>
      {deps.length === 0 ? (
        <Empty icon={<IcoDownL size={20} />} title={tr("w.noDeps")} sub={tr("w.noDepsSub")} />
      ) : (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {deps.map((dp) => (
            <div key={dp.id} className="px-3.5 py-3">
              <div className="flex items-center gap-2">
                <div className="grow text-[13.5px] font-extrabold tnum">
                  +{fmt(dp.coins)} {tr("c.coins")}
                  <span className="text-mut font-semibold"> · {dp.method === "Telebirr" ? `${dp.amount_birr ?? "—"} Birr` : `${dp.amount_usdt ?? "—"} USDT`}</span>
                </div>
                {(dp.bonus_coins ?? 0) > 0 && <Chip tone="mint" className="shrink-0">+{fmt(dp.bonus_coins)}</Chip>}
                <Chip tone={dp.method === "Telebirr" ? "sky" : "mint"} className="shrink-0">{dp.method}</Chip>
                <Pill status={dp.status} />
              </div>
              <div className="text-[11.5px] text-dim mt-1 tnum truncate">{tr("w.proofLbl", { x: dp.proof })} · {timeAgo(dp.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ledger */}
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut mt-6 mb-2.5">{tr("w.history")}</h2>
      <Seg value={filter} onChange={setFilter} options={[
        { v: "all", label: tr("w.all") }, { v: "earned", label: tr("w.earned") }, { v: "spent", label: tr("w.spent") }, { v: "bids", label: tr("w.bids") },
      ]} />
      <div className="card divide-y divide-line/60 overflow-hidden mt-3">
        {filtered.map((t) => <TxRow key={t.id} tx={t} showBalance />)}
        {filtered.length === 0 && <div className="p-6 text-center text-[13px] text-dim flex items-center justify-center gap-2"><IcoCoin size={16} /> {tr("w.empty")}</div>}
      </div>

      {sheet === "withdraw" && (
        <Modal open onClose={() => setSheet(null)} tall title={tr("w.wdTitle")}>
          <WithdrawForm onClose={() => setSheet(null)} onDone={load} />
        </Modal>
      )}
      {sheet === "deposit" && (
        <Modal open onClose={() => setSheet(null)} tall title={tr("w.depTitle")}>
          <DepositForm onClose={() => setSheet(null)} onDone={load} />
        </Modal>
      )}
    </div>
  );
}

/* ── action row — the two doors on the wallet hub ─────────────────────────── */
function ActionRow({ icon, title, sub, tone, delay, onClick }: {
  icon: React.ReactNode; title: string; sub: string; tone: "mint" | "gold"; delay?: string; onClick: () => void;
}) {
  const t = tone === "mint"
    ? { tile: "bg-mint/12 border-mint/30 text-mint", hover: "hover:border-mint/45 hover:shadow-[0_10px_30px_-14px_rgba(64,224,160,0.55)]", chev: "group-hover:text-mint" }
    : { tile: "bg-gold/12 border-gold/35 text-gold", hover: "hover:border-gold/50 hover:shadow-[0_10px_30px_-14px_rgba(255,194,75,0.55)]", chev: "group-hover:text-gold" };
  return (
    <button onClick={onClick}
      className={`tap group anim-rise card w-full flex items-center gap-3.5 p-4 text-left transition-all duration-300 hover:-translate-y-[2px] active:scale-[0.985] ${t.hover}`}
      style={{ animationDelay: delay }}>
      <span className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 ${t.tile}`}>
        {icon}
      </span>
      <span className="grow min-w-0">
        <span className="block font-display text-[16px] font-bold leading-tight">{title}</span>
        <span className="block text-[12px] text-dim font-semibold mt-0.5 truncate">{sub}</span>
      </span>
      <span className={`text-dim transition-all duration-300 group-hover:translate-x-1 shrink-0 ${t.chev}`}>
        <IcoChev size={19} />
      </span>
    </button>
  );
}

/* ── withdraw form (opens in a sheet) ─────────────────────────────────────── */
function WithdrawForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { wallet, settings, api, toast, refreshCore, setWalletBalance } = useApp();
  const { t: tr } = useLang();
  const [coins, setCoins] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<DepositMethod>("BEP20");
  const [busy, setBusy] = useState(false);
  if (!wallet || !settings) return null;

  const coinsNum = Math.max(0, Math.floor(Number(coins) || 0));
  const usdt = usdtOf(coinsNum, settings.coin_usdt_rate);
  const min = settings.min_withdrawal;
  const addrOk = network === "Telebirr"
    ? /^09\d{8}$/.test(address.trim())
    : /^0x[a-fA-F0-9]{40}$/.test(address.trim());

  const submit = async () => {
    if (coinsNum < min) { toast(tr("w.minWd", { n: fmt(min) }), "err"); haptic("error"); return; }
    if (coinsNum > wallet.withdrawable) { toast(tr("w.overEarned"), "err"); haptic("error"); return; }
    if (network === "Telebirr" && !/^09\d{8}$/.test(address.trim())) {
      toast(tr("w.badTb"), "err"); haptic("error"); return;
    }
    if (network === "BEP20" && !/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      toast(tr("w.badBep"), "err"); haptic("error"); return;
    }
    setBusy(true);
    const res: ActionResult = await api.requestWithdrawal(coinsNum, address.trim(), network).catch((e): ActionResult => ({ ok: false, error: String(e) }));
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Withdrawal failed", "err"); haptic("error"); return; }
    haptic("success");
    toast(tr("w.wdToast", { n: fmt(coinsNum), m: network === "Telebirr" ? "Telebirr" : "BEP20" }), "ok");
    if (res.balance !== undefined) setWalletBalance(res.balance);
    setCoins(""); setAddress("");
    onClose();
    refreshCore(); onDone();
  };

  return (
    <div className="pb-4">
      {/* payout method */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => { setNetwork("BEP20"); setAddress(""); haptic("light"); }}
          className={`tap flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${network === "BEP20" ? "border-mint/50 bg-mint/10 shadow-[0_0_16px_-6px_rgba(64,224,160,0.45)]" : "border-line bg-panel hover:border-mut/40"}`}>
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[13px] shrink-0 ${network === "BEP20" ? "bg-mint text-[#04241a]" : "bg-panel2 text-mut"}`}>₮</span>
          <span className="min-w-0">
            <span className={`block text-[13px] font-extrabold leading-tight ${network === "BEP20" ? "text-mint" : "text-ink"}`}>USDT</span>
            <span className="block text-[10.5px] text-dim font-semibold truncate">{tr("w.usdtSub")}</span>
          </span>
        </button>
        <button onClick={() => { setNetwork("Telebirr"); setAddress(""); haptic("light"); }}
          className={`tap flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${network === "Telebirr" ? "border-sky/50 bg-sky/10 shadow-[0_0_16px_-6px_rgba(78,178,255,0.45)]" : "border-line bg-panel hover:border-mut/40"}`}>
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${network === "Telebirr" ? "bg-sky text-[#04182a]" : "bg-panel2 text-mut"}`}>
            <PhoneGlyph />
          </span>
          <span className="min-w-0">
            <span className={`block text-[13px] font-extrabold leading-tight ${network === "Telebirr" ? "text-sky" : "text-ink"}`}>Telebirr</span>
            <span className="block text-[10.5px] text-dim font-semibold truncate">{tr("w.tbSub")}</span>
          </span>
        </button>
      </div>

      {/* amount */}
      <div className="mt-3">
        <div className="relative">
          <input inputMode="numeric" value={coins} onChange={(e) => setCoins(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={`${fmt(min)}+`} className="input !pr-16 tnum" />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-extrabold text-dim">{tr("c.coins")}</span>
        </div>
        <div className="flex gap-2 mt-2">
          {[min, 500, 1000].map((v, i) => (
            <button key={`${v}-${i}`} onClick={() => setCoins(String(Math.min(v, wallet.withdrawable)))} className="tap chip-q">{fmt(v)}</button>
          ))}
          <button onClick={() => setCoins(String(wallet.withdrawable))} className="tap chip-q">{tr("c.max")}</button>
        </div>
      </div>

      {/* you receive */}
      <div className="card bg-panel/70 p-3.5 mt-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-dim">{tr("w.receive")}</div>
          {network === "Telebirr" ? (
            <div className="font-display text-[20px] font-bold text-sky tnum">{coinsNum > 0 ? birrOf(coinsNum) : "0.0"} <span className="text-[13px] text-mut">Birr</span></div>
          ) : (
            <div className="font-display text-[20px] font-bold text-mint tnum">{coinsNum > 0 ? usdt : "0.00"} <span className="text-[13px] text-mut">USDT</span></div>
          )}
        </div>
        <Chip tone={coinsNum >= min && coinsNum <= wallet.withdrawable && coinsNum > 0 ? "mint" : "dim"}>
          {coinsNum > 0 ? (coinsNum < min ? tr("w.min", { n: fmt(min) }) : coinsNum > wallet.withdrawable ? tr("w.earnedOnly") : tr("w.valid")) : tr("w.minCoins", { n: fmt(min) })}
        </Chip>
      </div>

      {network === "Telebirr" && (
        <div className="text-[11.5px] text-sky/90 font-semibold mt-2.5 text-center">
          {tr("w.birrNote", { r: BIRR_PER_COIN })}
        </div>
      )}

      {/* address */}
      <div className="mt-3">
        <div className="text-[12.5px] font-bold uppercase tracking-wider text-mut mb-1.5">
          {network === "Telebirr" ? tr("w.addrTb") : tr("w.addrUsdt")}
        </div>
        {network === "Telebirr" ? (
          <input inputMode="numeric" value={address}
            onChange={(e) => setAddress(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="09xxxxxxxx" className="input tnum" />
        ) : (
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" className="input tnum" />
        )}
        {network === "Telebirr" ? (
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11.5px] text-dim leading-relaxed">
              {tr("w.tbFormat")}
            </span>
            {address.length > 0 && (
              <Chip tone={addrOk ? "mint" : "coral"}>{addrOk ? tr("w.validNum") : tr("w.digits", { n: 10 - address.length })}</Chip>
            )}
          </div>
        ) : (
          <div className="text-[11.5px] text-dim mt-1.5 leading-relaxed">
            {tr("w.addrNote")}
          </div>
        )}
      </div>

      <Button full size="lg" className="mt-4" loading={busy} onClick={submit} disabled={coinsNum <= 0}>
        <IcoUpR size={18} /> {tr("w.wdBtn", { x: coinsNum > 0 ? `${fmt(coinsNum)} ${tr("c.coins")} · ${network === "Telebirr" ? "Telebirr" : "BEP20"}` : "" })}
      </Button>
      <div className="text-[11px] text-dim mt-2.5 leading-relaxed text-center">
        {tr("w.wdFoot", { n: fmt(wallet.withdrawable) })}
      </div>
    </div>
  );
}

/* ── deposit form (opens in a sheet) ──────────────────────────────────────── */
function DepositForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { settings, api, toast, refreshCore } = useApp();
  const { t: tr } = useLang();
  const [dMethod, setDMethod] = useState<DepositMethod>("BEP20");
  const [dCoins, setDCoins] = useState("");
  const [dProof, setDProof] = useState("");
  const [dBusy, setDBusy] = useState(false);
  if (!settings) return null;

  const dCoinsNum = Math.max(0, Math.floor(Number(dCoins) || 0));
  const minDep = settings.min_deposit ?? 100;
  const dBonusPct = settings.deposit_bonus_pct ?? 0;
  const dBonus = Math.round(dCoinsNum * dBonusPct / 100);
  const depAddress = (dMethod === "Telebirr" ? settings.deposit_telebirr_number : settings.deposit_bep20_address) ?? "";
  const depConfigured = depAddress.trim().length > 0;
  const dProofOk = dProof.trim().length >= (dMethod === "BEP20" ? 10 : 6);
  const depValid = dCoinsNum >= minDep && depConfigured && dProofOk;

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); haptic("light"); toast(tr("c.copied"), "ok"); }
    catch { toast(tr("c.copy"), "err"); }
  };

  const submitDeposit = async () => {
    if (!depValid) return;
    setDBusy(true);
    const res: ActionResult = await api.requestDeposit(dMethod, dCoinsNum, dProof.trim())
      .catch((e): ActionResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    setDBusy(false);
    if (!res.ok) { toast(res.error ?? "Deposit request failed", "err"); haptic("error"); return; }
    haptic("success");
    toast(tr("w.depToast", { n: fmt(dCoinsNum) }), "ok");
    setDCoins(""); setDProof("");
    onClose();
    refreshCore(); onDone();
  };

  return (
    <div className="pb-4">
      <p className="text-[11.5px] text-dim leading-relaxed">
        {tr("w.depIntro")}
      </p>

      {/* method */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={() => { setDMethod("BEP20"); setDProof(""); haptic("light"); }}
          className={`tap flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${dMethod === "BEP20" ? "border-mint/50 bg-mint/10 shadow-[0_0_16px_-6px_rgba(64,224,160,0.45)]" : "border-line bg-panel hover:border-mut/40"}`}>
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[13px] shrink-0 ${dMethod === "BEP20" ? "bg-mint text-[#04241a]" : "bg-panel2 text-mut"}`}>₮</span>
          <span className="min-w-0">
            <span className={`block text-[13px] font-extrabold leading-tight ${dMethod === "BEP20" ? "text-mint" : "text-ink"}`}>USDT</span>
            <span className="block text-[10.5px] text-dim font-semibold truncate">{tr("w.usdtNet")}</span>
          </span>
        </button>
        <button onClick={() => { setDMethod("Telebirr"); setDProof(""); haptic("light"); }}
          className={`tap flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${dMethod === "Telebirr" ? "border-sky/50 bg-sky/10 shadow-[0_0_16px_-6px_rgba(78,178,255,0.45)]" : "border-line bg-panel hover:border-mut/40"}`}>
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${dMethod === "Telebirr" ? "bg-sky text-[#04182a]" : "bg-panel2 text-mut"}`}>
            <PhoneGlyph />
          </span>
          <span className="min-w-0">
            <span className={`block text-[13px] font-extrabold leading-tight ${dMethod === "Telebirr" ? "text-sky" : "text-ink"}`}>Telebirr</span>
            <span className="block text-[10.5px] text-dim font-semibold truncate">{tr("w.tbSub")}</span>
          </span>
        </button>
      </div>

      {/* amount */}
      <div className="mt-3">
        <div className="relative">
          <input inputMode="numeric" value={dCoins} onChange={(e) => setDCoins(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={`${fmt(minDep)}+`} className="input !pr-16 tnum" />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-extrabold text-dim">{tr("c.coins")}</span>
        </div>
        <div className="flex gap-2 mt-2">
          {[500, 1000, 5000].map((v) => (
            <button key={v} onClick={() => setDCoins(String(v))} className="tap chip-q">{fmt(v)}</button>
          ))}
        </div>
      </div>

      {/* you send / you get */}
      <div className="card bg-panel/70 p-3.5 mt-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-dim">{tr("w.send")}</div>
            {dMethod === "Telebirr" ? (
              <div className="font-display text-[20px] font-bold text-sky tnum">{dCoinsNum > 0 ? birrOf(dCoinsNum) : "0.0"} <span className="text-[13px] text-mut">Birr</span></div>
            ) : (
              <div className="font-display text-[20px] font-bold text-mint tnum">{dCoinsNum > 0 ? usdtOf(dCoinsNum, settings.coin_usdt_rate) : "0.00"} <span className="text-[13px] text-mut">USDT</span></div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-dim">{tr("w.get")}</div>
            <div className="font-display text-[17px] font-bold gold-text tnum">
              {dCoinsNum > 0 ? fmt(dCoinsNum) : "0"}
              {dBonus > 0 && <span className="text-mint"> +{fmt(dBonus)}</span>}
              {" "}<span className="text-[12px] text-mut font-body font-bold">{tr("c.coins")}</span>
            </div>
          </div>
        </div>
        <div className="text-[10.5px] text-dim mt-1.5">
          {dMethod === "Telebirr" ? tr("w.rates2", { r: BIRR_PER_COIN }) : tr("w.rates1", { r: settings.coin_usdt_rate })}
        </div>
      </div>

      {dBonusPct > 0 && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-mint/30 bg-mint/8 px-3 py-2.5">
          <span className="text-mint"><IcoCoin size={15} /></span>
          <span className="text-[11.5px] font-bold text-mint leading-snug">
            {tr("w.bonusNote", { p: dBonusPct })}
          </span>
        </div>
      )}

      {/* pay to */}
      <div className="card bg-panel/70 p-3.5 mt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-dim">
            {dMethod === "Telebirr" ? tr("w.payTb") : tr("w.payUsdt")}
          </div>
          {depConfigured ? (
            <button onClick={() => copy(depAddress.trim())} className="tap flex items-center gap-1.5 rounded-lg border border-line bg-deep px-2.5 py-1.5 text-[11px] font-extrabold text-gold hover:border-gold/50 transition-colors">
              <IcoCopy size={13} /> {tr("w.copyBtn")}
            </button>
          ) : (
            <Chip tone="coral">{tr("w.notSet")}</Chip>
          )}
        </div>
        {depConfigured ? (
          <div className="text-[13px] font-extrabold tnum mt-2 break-all leading-relaxed">{depAddress.trim()}</div>
        ) : (
          <div className="text-[12.5px] text-coral/90 font-semibold mt-2">{tr("w.notSetSub")}</div>
        )}
        {dMethod === "BEP20" && depConfigured && (
          <div className="text-[10.5px] text-dim mt-1.5 leading-relaxed">{tr("w.bep20Note")}</div>
        )}
      </div>

      {/* proof */}
      <div className="mt-3">
        <div className="text-[12.5px] font-bold uppercase tracking-wider text-mut mb-1.5">
          {dMethod === "Telebirr" ? tr("w.proofTb") : tr("w.proofTx")}
        </div>
        <input value={dProof} onChange={(e) => setDProof(e.target.value)}
          placeholder={dMethod === "Telebirr" ? "e.g. TB-88412096 or 0912…" : "0x…"} className="input tnum" />
        <div className="text-[11.5px] text-dim mt-1.5 leading-relaxed">
          {tr("w.proofOne")}
        </div>
      </div>

      <Button full size="lg" className="mt-4" loading={dBusy} onClick={submitDeposit} disabled={!depValid}>
        <IcoDownL size={18} /> {tr("w.depBtn")}
      </Button>
    </div>
  );
}
