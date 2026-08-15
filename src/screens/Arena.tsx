import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, type ActionResult } from "../lib/types";
import { haptic } from "../lib/telegram";
import { Avatar, Button, Chip, CountUp, IcoCoin, IcoFlame, IcoGavel, IcoInfo, IcoMinus, IcoPlus, IcoTrophy, Modal, Pill, Ring } from "../components/ui";

export default function Arena() {
  const { round, user, wallet, api, toast, setWalletBalance, refreshRound, refreshCore } = useApp();
  const [bidding, setBidding] = useState(false);
  const [amt, setAmt] = useState("");
  const [win, setWin] = useState<{ payout: number; pool: number; number: number } | null>(null);
  const prevStatus = useRef<string | null>(null);
  const prevLeader = useRef<string | null>(null);

  // winner + outbid detection (server state is the source of truth)
  useEffect(() => {
    if (!round || !user) return;
    const r = round.round;
    if (prevStatus.current === "running" && r.status === "completed" && r.winner === user.id && r.payout) {
      setWin({ payout: r.payout, pool: r.pool, number: r.number });
      haptic("success");
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ["#ffc24b", "#3ddc97", "#54c8ff", "#ff6b7a"] });
      refreshCore();
    }
    const leader = round.last_bid?.user.id ?? null;
    if (prevLeader.current === user.id && leader && leader !== user.id) {
      toast("You've been outbid — strike back!", "err");
      haptic("heavy");
    }
    prevStatus.current = r.status;
    prevLeader.current = leader;
  }, [round, user, toast, refreshCore]);

  const leader = round?.last_bid ?? null;
  // each bid must beat the previous one by at least 1 — a new round resets to the starting bid
  const minBid = leader ? leader.amount + 1 : round?.round.bid_amount ?? 10;

  // keep the input pinned to the minimum whenever the ladder moves
  useEffect(() => { setAmt(String(minBid)); }, [minBid]);

  if (!round || !wallet || !user) {
    return (
      <div className="px-4 pt-4">
        <div className="skeleton h-7 w-40 rounded-lg" />
        <div className="skeleton h-[240px] mt-4 rounded-2xl" />
        <div className="skeleton h-[90px] mt-4 rounded-2xl" />
        <div className="skeleton h-[200px] mt-4 rounded-2xl" />
      </div>
    );
  }

  const r = round.round;
  const running = r.status === "running" && (!r.ends_at || new Date(r.ends_at).getTime() > Date.now());
  const amount = Math.floor(Number(amt) || 0);
  const tooLow = amount < minBid;
  const tooHigh = amount > wallet.balance;
  const canBid = running && !tooLow && !tooHigh && amount > 0;

  const bid = async () => {
    if (!canBid || bidding) return;
    setBidding(true);
    haptic("medium");
    const res: ActionResult = await api.placeBid(amount).catch((e): ActionResult => ({ ok: false, error: String(e) }));
    setBidding(false);
    if (!res.ok) { toast(res.error ?? "Bid rejected", "err"); haptic("error"); refreshRound(); return; }
    haptic("success");
    if (res.balance !== undefined) setWalletBalance(res.balance);
    refreshRound();
  };

  const nudge = (d: number) => setAmt(String(Math.max(minBid, amount + d)));
  const quick = [minBid, minBid + 5, minBid + 10];

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between anim-rise">
        <div>
          <h1 className="font-display text-[19px] font-bold flex items-center gap-2">Bid &amp; Win <IcoGavel size={19} className="text-gold" /></h1>
          <p className="text-[13px] text-mut mt-1">Every bid must beat the last one by at least 1. Last bidder standing takes the pot.</p>
        </div>
        <Chip tone={running ? "mint" : "dim"}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" style={{ animation: "pulsedot 1.4s infinite" }} />
          {running ? "Live" : "Closed"}
        </Chip>
      </div>

      {/* arena card */}
      <div className="card mt-4 p-5 anim-rise" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center justify-between gap-4">
          <Ring deadline={r.ends_at} totalSec={r.timer_sec} onExpire={() => { api.tryFinalize().catch(() => {}); setTimeout(refreshRound, 700); }} />
          <div className="text-right grow">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-mut">Prize pool</div>
            <div className="font-display text-[30px] font-bold gold-text glow-gold leading-tight"><CountUp value={r.pool} /></div>
            <div className="text-[12px] text-mut">Coins · round #{r.number}</div>
            <div className="flex gap-1.5 justify-end mt-2.5">
              <Chip tone="gold"><IcoCoin size={12} /> min bid {fmt(minBid)}</Chip>
              <Chip tone="dim">{r.bid_count} bids</Chip>
            </div>
          </div>
        </div>

        {/* split bar */}
        <div className="mt-4">
          <div className="flex h-2.5 rounded-full overflow-hidden border border-line/60">
            <div className="bg-gradient-to-r from-gold to-gold2" style={{ width: `${r.winner_pct}%` }} />
            <div className="bg-sky/60" style={{ width: `${r.platform_pct}%` }} />
          </div>
          <div className="flex justify-between text-[11.5px] font-bold mt-1.5">
            <span className="text-gold">Winner {r.winner_pct}%{r.pool > 0 && <span className="tnum"> · {fmt(Math.floor((r.pool * r.winner_pct) / 100))}</span>}</span>
            <span className="text-sky">Platform {r.platform_pct}%</span>
          </div>
        </div>
      </div>

      {/* leader */}
      <div className={`card mt-3 p-4 flex items-center gap-3 anim-rise ${leader && !leader.is_me ? "border-coral/40" : ""} ${leader?.is_me ? "border-gold/50" : ""}`} style={{ animationDelay: "120ms" }}>
        {leader ? (
          <>
            <Avatar name={leader.user.username} photo={leader.user.photo_url} size={42} />
            <div className="grow min-w-0">
              <div className="font-extrabold text-[14.5px] truncate">
                {leader.is_me ? "You" : leader.user.first_name} <span className="text-mut font-semibold">@{leader.user.username}</span>
              </div>
              <div className="text-[12.5px] text-mut tnum">bid {fmt(leader.amount)} Coins · {timeAgo(leader.placed_at)}</div>
            </div>
            {leader.is_me
              ? <Chip tone="gold"><IcoTrophy size={12} /> You're leading</Chip>
              : <Chip tone="coral"><IcoFlame size={12} /> Leading · {fmt(leader.amount)}</Chip>}
          </>
        ) : (
          <>
            <span className="w-10 h-10 rounded-full border border-dashed border-line2 flex items-center justify-center text-dim"><IcoGavel size={18} /></span>
            <div className="grow">
              <div className="font-extrabold text-[14.5px]">No bids yet</div>
              <div className="text-[12.5px] text-mut tnum">Open the ladder at {fmt(minBid)} Coins — the clock starts with you.</div>
            </div>
          </>
        )}
      </div>

      {/* bid amount picker */}
      <div className="card mt-3 p-4 anim-rise" style={{ animationDelay: "160ms" }}>
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-extrabold uppercase tracking-wider text-mut">Your bid</div>
          <div className={`text-[11.5px] font-bold tnum ${tooHigh ? "text-coral" : "text-dim"}`}>
            {tooHigh ? "over your balance" : `balance ${fmt(wallet.balance)}`}
          </div>
        </div>
        <div className="flex items-center gap-2.5 mt-3">
          <button onClick={() => nudge(-1)} disabled={amount <= minBid} className="tap w-11 h-11 rounded-xl border border-line bg-panel2/70 text-mut flex items-center justify-center disabled:opacity-35 hover:text-ink shrink-0">
            <IcoMinus size={17} />
          </button>
          <div className="relative grow">
            <input inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ""))} className="input !text-center font-display !text-[22px] !font-bold tnum" />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-extrabold text-dim">Coins</span>
          </div>
          <button onClick={() => nudge(1)} className="tap w-11 h-11 rounded-xl border border-gold/45 bg-gold/12 text-gold flex items-center justify-center hover:brightness-110 shrink-0">
            <IcoPlus size={17} />
          </button>
        </div>
        <div className="flex gap-2 mt-2.5">
          {quick.map((v, i) => (
            <button key={`${v}-${i}`} onClick={() => setAmt(String(Math.min(v, wallet.balance) < minBid ? minBid : v))}
              className={`tap chip-q flex-1 text-center ${amount === v ? "!text-gold !border-gold/50" : ""}`}>
              {i === 0 ? `Min ${fmt(v)}` : fmt(v)}
            </button>
          ))}
          <button onClick={() => setAmt(String(wallet.balance))} className={`tap chip-q flex-1 text-center ${amount === wallet.balance ? "!text-gold !border-gold/50" : ""}`}>Max</button>
        </div>
        {tooLow && <div className="text-[12px] text-coral font-bold mt-2.5">A bid must be at least <span className="tnum">{fmt(minBid)}</span> — 1 above the last bidder{leader ? ` (@${leader.user.username} bid ${fmt(leader.amount)})` : ""}.</div>}
      </div>

      {/* bid button */}
      <Button full size="lg" className="mt-3 !py-4 text-[16px]" disabled={!canBid} loading={bidding} onClick={bid}>
        <IcoGavel size={19} /> {running ? (amount > 0 && !tooLow ? `Bid ${fmt(amount)} Coins` : `Bid min ${fmt(minBid)} Coins`) : r.status === "completed" ? "Round over" : "Waiting…"}
      </Button>
      {running && wallet.balance < minBid && (
        <div className="text-center text-[12px] text-coral font-bold mt-2 tnum">Not enough Coins — you need at least {fmt(minBid)} to bid.</div>
      )}

      {/* live feed */}
      <div className="flex items-center justify-between mt-6 mb-2.5">
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut">Live bids</h2>
        <span className="text-[11.5px] text-dim tnum">{r.bid_count} total</span>
      </div>
      <div className="card divide-y divide-line/60 overflow-hidden">
        {round.bids.length === 0 && <div className="p-5 text-center text-[13px] text-dim">The first bid starts the {r.timer_sec}s countdown.</div>}
        {round.bids.map((b, i) => (
          <div key={b.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${i === 0 ? "anim-slide bg-gold/6" : "anim-fade"}`}>
            <Avatar name={b.user.username} photo={b.user.photo_url} size={30} />
            <div className="grow min-w-0 text-[13.5px]">
              <b className={b.is_me ? "text-gold" : ""}>{b.is_me ? "You" : b.user.first_name}</b>
              <span className="text-mut"> @{b.user.username}</span>
            </div>
            {i === 0 && <Chip tone="gold">latest</Chip>}
            <span className="text-[13px] font-bold text-coral tnum">−{fmt(b.amount)}</span>
            <span className="text-[11px] text-dim w-12 text-right tnum">{timeAgo(b.placed_at)}</span>
          </div>
        ))}
      </div>

      {/* recent winners */}
      <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut mt-6 mb-2.5">Recent winners</h2>
      <div className="flex gap-3 overflow-x-auto hide-scroll -mx-4 px-4 pb-1">
        {round.winners.slice(0, 6).map((w, i) => (
          <div key={`${w.round}-${i}`} className="stagger shrink-0 w-[150px] card p-3.5 border-mint/25" style={{ "--i": i } as React.CSSProperties}>
            <div className="flex items-center gap-2">
              <span className="text-gold"><IcoTrophy size={16} /></span>
              <div className="text-[13px] font-extrabold truncate">{w.user.username}</div>
            </div>
            <div className="font-display text-[17px] font-bold text-mint mt-2 tnum">+{fmt(w.payout)}</div>
            <div className="text-[11px] text-dim mt-0.5">round #{w.round} · pool {fmt(w.pool)}</div>
          </div>
        ))}
        {round.winners.length === 0 && <div className="text-[13px] text-dim py-4">No rounds settled yet.</div>}
      </div>

      {/* rules */}
      <div className="card p-4 mt-5">
        <div className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-mut"><IcoInfo size={15} /> How it works</div>
        <ul className="mt-2.5 space-y-1.5 text-[13px] text-mut leading-relaxed">
          <li>· Bidding starts at <b className="text-ink">{r.bid_amount} Coins</b>. Every next bid must be <b className="text-ink">at least 1 Coin above</b> the previous one.</li>
          <li>· Each bid resets the timer to <b className="text-ink">{r.timer_sec}s</b>. At zero, the last bidder wins <b className="text-ink">{r.winner_pct}%</b> of the pool.</li>
          <li>· When a round settles, the ladder <b className="text-ink">resets back to {r.bid_amount}</b> for the next round. The platform keeps {r.platform_pct}%.</li>
          <li>· Timer, ladder and winner are enforced <b className="text-ink">server-side</b> — never by your device.</li>
        </ul>
      </div>

      {/* win modal */}
      <Modal open={!!win} onClose={() => setWin(null)} title="Round settled">
        {win && (
          <div className="text-center py-4 anim-pop">
            <span className="inline-flex w-16 h-16 rounded-full bg-gold/15 border border-gold/40 text-gold items-center justify-center anim-float"><IcoTrophy size={30} /></span>
            <div className="font-display text-[20px] font-bold mt-4">You won round #{win.number}!</div>
            <div className="font-display text-[34px] font-bold gold-text glow-gold mt-2 tnum">+{fmt(win.payout)}</div>
            <div className="text-[13px] text-mut mt-1">Coins · {Math.round((win.payout / Math.max(1, win.pool)) * 100)}% of the {fmt(win.pool)} pool</div>
            <div className="mt-3"><Pill status="completed" /></div>
            <Button full className="mt-5" onClick={() => setWin(null)}>Collect & continue</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
