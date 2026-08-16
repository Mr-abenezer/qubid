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
  const [network, setNetwork] = useState<"BEP20" | "Telebirr">("BEP20");
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

  const addrOk = network === "Telebirr"
    ? /^09\d{8}$/.test(address.trim())
    : /^0x[a-fA-F0-9]{40}$/.test(address.trim());

  const submit = async () => {
    if (coinsNum < min) { toast(`Minimum withdrawal is ${fmt(min)} Coins`, "err"); haptic("error"); return; }
    if (coinsNum > wallet.balance) { toast("That's more than your balance", "err"); haptic("error"); return; }
    if (network === "Telebirr" && !/^09\d{8}$/.test(address.trim())) {
      toast("Enter a valid Telebirr number — 09 followed by 8 digits", "err"); haptic("error"); return;
    }
    if (network === "BEP20" && !/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      toast("Enter a valid BEP20 address (starts with 0x, 42 characters)", "err"); haptic("error"); return;
    }
    setBusy(true);
    const res: ActionResult = await api.requestWithdrawal(coinsNum, address.trim(), network).catch((e): ActionResult => ({ ok: false, error: String(e) }));
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Withdrawal failed", "err"); haptic("error"); return; }
    haptic("success");
    toast(`Withdrawal of ${fmt(coinsNum)} Coins submitted via ${network === "Telebirr" ? "Telebirr" : "BEP20"}`, "ok");
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
          1 Coin = {settings.coin_usdt_rate} USDT. Coins convert <b className="text-mut">only when you withdraw</b> — to USDT (BEP20) or Ethiopian Birr (Telebirr). Minimum {fmt(min)} Coins ({usdtOf(min, settings.coin_usdt_rate)} USDT).
        </div>
      </div>

      {/* withdraw */}
      <div className="card mt-4 p-4 anim-rise" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-extrabold uppercase tracking-wider text-mut">Withdraw</div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/35 bg-mint/10 text-mint px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider">
            <span className="w-3.5 h-3.5 rounded-full bg-mint text-[#04241a] flex items-center justify-center text-[8px] font-black">₮</span>
            USDT · Birr
          </span>
        </div>

        {/* payout method */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={() => { setNetwork("BEP20"); setAddress(""); haptic("light"); }}
            className={`tap flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${network === "BEP20" ? "border-mint/50 bg-mint/10 shadow-[0_0_16px_-6px_rgba(64,224,160,0.45)]" : "border-line bg-panel hover:border-mut/40"}`}
          >
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[13px] shrink-0 ${network === "BEP20" ? "bg-mint text-[#04241a]" : "bg-panel2 text-mut"}`}>₮</span>
            <span className="min-w-0">
              <span className={`block text-[13px] font-extrabold leading-tight ${network === "BEP20" ? "text-mint" : "text-ink"}`}>USDT</span>
              <span className="block text-[10.5px] text-dim font-semibold truncate">BEP20 wallet</span>
            </span>
          </button>
          <button
            onClick={() => { setNetwork("Telebirr"); setAddress(""); haptic("light"); }}
            className={`tap flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${network === "Telebirr" ? "border-sky/50 bg-sky/10 shadow-[0_0_16px_-6px_rgba(78,178,255,0.45)]" : "border-line bg-panel hover:border-mut/40"}`}
          >
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${network === "Telebirr" ? "bg-sky text-[#04182a]" : "bg-panel2 text-mut"}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            </span>
            <span className="min-w-0">
              <span className={`block text-[13px] font-extrabold leading-tight ${network === "Telebirr" ? "text-sky" : "text-ink"}`}>Telebirr</span>
              <span className="block text-[10.5px] text-dim font-semibold truncate">Ethiopia · 09…</span>
            </span>
          </button>
        </div>
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

        {network === "Telebirr" && (
          <div className="text-[11.5px] text-sky/90 font-semibold mt-2.5 text-center">
            Telebirr payouts are sent in Ethiopian Birr at the current exchange rate.
          </div>
        )}

        <div className="mt-3">
          <div className="text-[12.5px] font-bold uppercase tracking-wider text-mut mb-1.5">
            {network === "Telebirr" ? "Telebirr phone number · Ethiopia" : "USDT address · BEP20 (BNB Smart Chain)"}
          </div>
          {network === "Telebirr" ? (
            <input
              inputMode="numeric"
              value={address}
              onChange={(e) => setAddress(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="09xxxxxxxx"
              className="input tnum"
            />
          ) : (
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" className="input tnum" />
          )}
          {network === "Telebirr" ? (
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11.5px] text-dim leading-relaxed">
                Format <b className="text-mut tnum">09xxxxxxxx</b> — 10 digits, starting with 09.
              </span>
              {address.length > 0 && (
                <Chip tone={addrOk ? "mint" : "coral"}>{addrOk ? "valid number" : `${10 - address.length} digits left`}</Chip>
              )}
            </div>
          ) : (
            <div className="text-[11.5px] text-dim mt-1.5 leading-relaxed">
              Payouts are sent in <b className="text-mut">USDT on BEP20</b> only. Double-check your address — other networks are not supported and funds sent there cannot be recovered.
            </div>
          )}
        </div>
        <Button full size="lg" className="mt-4" loading={busy} onClick={submit} disabled={coinsNum <= 0}>
          <IcoUpR size={18} /> Withdraw {coinsNum > 0 ? `${fmt(coinsNum)} Coins · ${network === "Telebirr" ? "Telebirr" : "BEP20"}` : ""}
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
