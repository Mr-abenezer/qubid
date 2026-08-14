import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, usdtOf, TX_META, type ActionResult, type Tx, type Withdrawal } from "../lib/types";
import { haptic } from "../lib/telegram";
import { Button, Chip, CountUp, Empty, IcoCoin, IcoDownL, IcoUpR, IcoWallet, Pill, Seg } from "../components/ui";

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
  const { wallet, settings, api, toast, setWalletBalance, refreshCore } = useApp();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [wds, setWds] = useState<Withdrawal[]>([]);
  const [filter, setFilter] = useState("all");
  const [coins, setCoins] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("TRC20");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.listTransactions(80).then(setTxs).catch(() => {});
    api.listMyWithdrawals().then(setWds).catch(() => {});
  };
  useEffect(load, [api, wallet?.balance]);

  if (!wallet || !settings) {
    return <div className="px-4 pt-4"><div className="skeleton h-[120px] rounded-2xl" /><div className="skeleton h-[220px] mt-4 rounded-2xl" /><div className="skeleton h-[180px] mt-4 rounded-2xl" /></div>;
  }

  const coinsNum = Math.max(0, Math.floor(Number(coins) || 0));
  const usdt = usdtOf(coinsNum, settings.coin_usdt_rate);
  const min = settings.min_withdrawal;

  const filtered = txs.filter((t) =>
    filter === "all" ? true
      : filter === "earned" ? t.amount > 0
        : filter === "spent" ? t.amount < 0
          : t.type === "bid_payment" || t.type === "bid_winnings"
  );

  const submit = async () => {
    if (coinsNum < min) { toast(`Minimum withdrawal is ${fmt(min)} Coins`, "err"); haptic("error"); return; }
    if (coinsNum > wallet.balance) { toast("That's more than your balance", "err"); haptic("error"); return; }
    if (address.trim().length < 8) { toast("Enter a valid withdrawal address", "err"); haptic("error"); return; }
    setBusy(true);
    const res: ActionResult = await api.requestWithdrawal(coinsNum, address.trim(), network).catch((e): ActionResult => ({ ok: false, error: String(e) }));
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Withdrawal failed", "err"); haptic("error"); return; }
    haptic("success");
    toast(`Withdrawal of ${fmt(coinsNum)} Coins submitted`, "ok");
    if (res.balance !== undefined) setWalletBalance(res.balance);
    setCoins(""); setAddress("");
    refreshCore(); load();
  };

  return (
    <div className="px-4 pt-4 pb-2">
      <h1 className="font-display text-[19px] font-bold anim-rise">Wallet</h1>

      {/* balance */}
      <div className="card sheen mt-4 p-5 anim-rise" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-gold/14 border border-gold/35 text-gold flex items-center justify-center"><IcoWallet size={24} /></span>
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-mut">Available balance</div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[30px] font-bold glow-gold"><CountUp value={wallet.balance} /></span>
              <span className="text-[14px] font-bold text-mut">Coins</span>
            </div>
          </div>
        </div>
        <div className="text-[12px] text-dim mt-3 leading-relaxed">
          1 Coin = {settings.coin_usdt_rate} USDT. Coins convert to USDT <b className="text-mut">only when you withdraw</b> — minimum {fmt(min)} Coins ({usdtOf(min, settings.coin_usdt_rate)} USDT).
        </div>
      </div>

      {/* withdraw */}
      <div className="card mt-4 p-4 anim-rise" style={{ animationDelay: "100ms" }}>
        <div className="text-[13px] font-extrabold uppercase tracking-wider text-mut">Withdraw to USDT</div>
        <div className="mt-3">
          <div className="flex gap-2">
            <div className="relative grow">
              <input inputMode="numeric" value={coins} onChange={(e) => setCoins(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={`${fmt(min)}+`} className="input !pr-16 tnum" />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-extrabold text-dim">Coins</span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {[min, 500, 1000].map((v, i) => (
              <button key={`${v}-${i}`} onClick={() => setCoins(String(Math.min(v, wallet.balance)))} className="tap chip-q">{fmt(v)}</button>
            ))}
            <button onClick={() => setCoins(String(wallet.balance))} className="tap chip-q">Max</button>
          </div>
        </div>

        <div className="card bg-panel/70 p-3.5 mt-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-dim">You receive</div>
            <div className="font-display text-[20px] font-bold text-mint tnum">{coinsNum > 0 ? usdt : "0.00"} <span className="text-[13px] text-mut">USDT</span></div>
          </div>
          <Chip tone={coinsNum >= min && coinsNum <= wallet.balance && coinsNum > 0 ? "mint" : "dim"}>
            {coinsNum > 0 ? (coinsNum < min ? `min ${fmt(min)}` : coinsNum > wallet.balance ? "over balance" : "valid") : `min ${fmt(min)} Coins`}
          </Chip>
        </div>

        <div className="mt-3">
          <div className="text-[12.5px] font-bold uppercase tracking-wider text-mut mb-1.5">{network} address</div>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={network === "TRC20" ? "T…" : network === "TON" ? "UQ…" : "0x…"} className="input tnum" />
        </div>
        <div className="mt-3">
          <Seg value={network} onChange={(v) => { setNetwork(v); setAddress(""); }} options={[{ v: "TRC20", label: "TRC20" }, { v: "TON", label: "TON" }, { v: "BEP20", label: "BEP20" }]} />
        </div>
        <Button full size="lg" className="mt-4" loading={busy} onClick={submit} disabled={coinsNum <= 0}>
          <IcoUpR size={18} /> Withdraw {coinsNum > 0 ? `${fmt(coinsNum)} Coins` : ""}
        </Button>
      </div>

      {/* withdrawal history */}
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut mt-6 mb-2.5">Withdrawals</h2>
      {wds.length === 0 ? (
        <Empty icon={<IcoUpR size={20} />} title="No withdrawals yet" sub={`Withdraw at least ${fmt(min)} Coins to receive USDT.`} />
      ) : (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {wds.map((w) => (
            <div key={w.id} className="px-3.5 py-3">
              <div className="flex items-center gap-2">
                <div className="grow text-[13.5px] font-extrabold tnum">{fmt(w.coins)} Coins <span className="text-mut font-semibold">→ {parseFloat(String(w.usdt))} USDT</span></div>
                <Pill status={w.status} />
              </div>
              <div className="text-[11.5px] text-dim mt-1 tnum">{w.network} · ••••{w.address.slice(-6)} · {timeAgo(w.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ledger */}
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut mt-6 mb-2.5">Transaction history</h2>
      <Seg value={filter} onChange={setFilter} options={[
        { v: "all", label: "All" }, { v: "earned", label: "Earned" }, { v: "spent", label: "Spent" }, { v: "bids", label: "Bids" },
      ]} />
      <div className="card divide-y divide-line/60 overflow-hidden mt-3">
        {filtered.map((t) => <TxRow key={t.id} tx={t} showBalance />)}
        {filtered.length === 0 && <div className="p-6 text-center text-[13px] text-dim flex items-center justify-center gap-2"><IcoCoin size={16} /> Nothing here yet.</div>}
      </div>
    </div>
  );
}
