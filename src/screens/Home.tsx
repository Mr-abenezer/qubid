import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { fmt, timeAgo, timeLeft, type Ad, type ActionResult, type LeaderboardRow, type Task } from "../lib/types";
import { haptic, openLink } from "../lib/telegram";
import { LANGS, useLang } from "../lib/i18n";
import { showMonetagAd, isMonetagReady } from "../lib/monetag";
import { initAdsgram, showAdsgramAd, isAdsgramReady } from "../lib/adsgram";
import { Avatar, Button, Chip, CountUp, IcoCheck, IcoClock, IcoCoin, IcoEye, IcoGlobe, IcoLink, IcoMega, IcoMoon, IcoPlane, IcoPlay, IcoShield, IcoSpark, IcoSun, IcoTrophy, IcoUpR, Modal, Ring, SectionH, Spinner } from "../components/ui";

export default function Home() {
  const { user, wallet, settings, tasks, ads, api, theme, setTheme, openProfile, setTab, toast, refreshTasks, refreshAds, refreshCore, setWalletBalance } = useApp();
  const { t: tr, lang, setLang } = useLang();
  const [langOpen, setLangOpen] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [ad, setAd] = useState<Ad | null>(null);
  const [watchingAd1, setWatchingAd1] = useState(false);
  const [watchingAd2, setWatchingAd2] = useState(false);
  const [monetagReady, setMonetagReady] = useState(false);
  const [monetagLoading, setMonetagLoading] = useState(true);
  const [adsgramReady, setAdsgramReady] = useState(false);
  const [adsgramLoading, setAdsgramLoading] = useState(true);

  // Wait for Monetag SDK to load (with 10 second timeout)
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total (20 * 500ms)
    
    const checkSdk = () => {
      if (isMonetagReady()) {
        setMonetagReady(true);
        setMonetagLoading(false);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkSdk, 500);
      } else {
        setMonetagLoading(false);
      }
    };
    checkSdk();
  }, []);

  // Initialize Adsgram SDK
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkAdsgram = () => {
      if (typeof window !== "undefined" && window.Adsgram) {
        const initialized = initAdsgram();
        if (initialized) {
          setAdsgramReady(true);
        }
        setAdsgramLoading(false);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkAdsgram, 500);
      } else {
        setAdsgramLoading(false);
      }
    };
    checkAdsgram();
  }, []);

  // top-10 board — refresh every minute while the leaderboard is open
  useEffect(() => {
    api.leaderboard().then(setBoard).catch(() => {});
    const iv = setInterval(() => api.leaderboard().then(setBoard).catch(() => {}), 60_000);
    return () => clearInterval(iv);
  }, [api, wallet?.balance]);

  useEffect(() => { refreshTasks(); }, [refreshTasks]);
  useEffect(() => { refreshAds(); }, [refreshAds, wallet?.balance]);

  if (!user || !wallet || !settings) return <HomeSkeleton />;

  const availTasks = tasks.filter((t) => !t.my_status || t.my_status === "rejected");
  const adReward = settings.ad_reward ?? 5;
  // ads disappear from the feed the moment a user completes them
  const liveAds = ads.filter((a) => a.my_completions < a.per_user_limit);
  const onReward = () => { refreshTasks(); refreshAds(); refreshCore(); };
  const myRank = board.find((r) => r.me)?.rank ?? 0;

  const handleWatchAd1 = async () => {
    if (watchingAd1) return;
    if (monetagLoading) {
      toast(tr("h.adLoading"), "info");
      return;
    }
    if (!monetagReady) {
      toast(tr("h.adNotReady"), "err");
      return;
    }
    setWatchingAd1(true);
    haptic("medium");
    try {
      await showMonetagAd();
      // User watched the ad to completion - credit the reward
      const res = await api.completeRewardAd();
      if (res.ok) {
        if (res.balance !== undefined) {
          setWalletBalance(res.balance);
        }
        toast(tr("h.rewardCredited", { n: adReward }), "ok");
        haptic("success");
        onReward();
      } else {
        toast(res.error || tr("h.rewardFailed"), "err");
        haptic("error");
      }
    } catch (error) {
      // User skipped or error occurred
      toast(tr("h.adSkipped"), "info");
      haptic("light");
    } finally {
      setWatchingAd1(false);
    }
  };

  const handleWatchAd2 = async () => {
    if (watchingAd2) return;
    if (adsgramLoading) {
      toast(tr("h.adLoading"), "info");
      return;
    }
    if (!adsgramReady) {
      toast(tr("h.adNotReady"), "err");
      return;
    }
    setWatchingAd2(true);
    haptic("medium");
    try {
      const completed = await showAdsgramAd();
      if (completed) {
        // User watched the ad to completion - credit the reward
        const res = await api.completeRewardAd();
        if (res.ok) {
          if (res.balance !== undefined) {
            setWalletBalance(res.balance);
          }
          toast(tr("h.rewardCredited", { n: adReward }), "ok");
          haptic("success");
          onReward();
        } else {
          toast(res.error || tr("h.rewardFailed"), "err");
          haptic("error");
        }
      } else {
        toast(tr("h.adSkipped"), "info");
        haptic("light");
      }
    } catch (error) {
      toast(tr("h.adSkipped"), "info");
      haptic("light");
    } finally {
      setWatchingAd2(false);
    }
  };

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
        <button onClick={() => { haptic("light"); setLangOpen(true); }} aria-label={tr("pr.language")}
          className="tap relative p-2.5 rounded-xl border border-line bg-panel text-mut hover:text-sky transition-colors">
          <IcoGlobe size={19} />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-md bg-sky text-[#04182a] text-[7.5px] font-black uppercase px-1 leading-[11px] shadow-[0_2px_8px_rgba(78,178,255,0.5)]">{lang}</span>
        </button>
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle light/dark mode"
          className="tap p-2.5 rounded-xl border border-line bg-panel text-mut hover:text-gold transition-colors">
          {theme === "dark" ? <IcoSun size={19} /> : <IcoMoon size={18} />}
        </button>
        <button onClick={() => { haptic("light"); setLbOpen(true); }} aria-label={tr("h.leaderboard")} className="tap relative p-2.5 rounded-xl border border-line bg-panel text-mut hover:text-gold transition-colors">
          <IcoTrophy size={19} />
          {myRank > 0 && myRank <= 10 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-gold text-[#241a05] text-[9px] font-black flex items-center justify-center leading-none shadow-[0_2px_8px_rgba(255,194,75,0.55)] tnum">
              {myRank}
            </span>
          )}
        </button>
      </div>

      {/* coin balance */}
      <div className="card sheen mt-4 p-5 anim-rise" style={{ animationDelay: "60ms" }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-mut">{tr("h.coinBal")}</div>
            <div className="flex items-center gap-2.5 mt-2">
              <span className="text-gold"><IcoCoin size={30} /></span>
              <span className="font-display text-[34px] leading-none font-bold glow-gold"><CountUp value={wallet.balance} /></span>
            </div>
          </div>
          <button onClick={() => setTab("wallet")} className="tap mt-1 px-3.5 py-2 rounded-xl bg-gold text-[#241a05] text-[13px] font-extrabold shadow-[0_6px_18px_-6px_rgba(255,194,75,0.55)]">
            {tr("w.withdraw")}
          </button>
        </div>
        <div className="flex gap-2 mt-4">
          <Chip tone="mint">{tr("h.today", { n: fmt(wallet.today_earned) })}</Chip>
          <Chip tone="gold">{tr("h.total", { n: fmt(wallet.total_earned) })}</Chip>
        </div>
      </div>

      {/* watch ad — two ad buttons side by side */}
      <div className="mt-4 anim-rise" style={{ animationDelay: "120ms" }}>
        <div className="grid grid-cols-2 gap-3">
          {/* Ad 1 - Monetag */}
          <button
            onClick={handleWatchAd1}
            disabled={watchingAd1 || monetagLoading}
            className="tap flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold to-gold2 text-[#241a05] font-extrabold text-[14px] px-3 py-4 shadow-[0_8px_24px_-8px_rgba(255,194,75,0.6)] hover:brightness-105 transition-[filter] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {watchingAd1 ? (
              <Spinner size={20} className="text-[#241a05]" />
            ) : monetagLoading ? (
              <Spinner size={20} className="text-[#241a05]" />
            ) : (
              <>
                <IcoPlay size={20} />
                <span>Ad 1</span>
                <span className="flex items-center gap-1 rounded-full bg-[#241a05]/15 px-2 py-0.5 text-[12px] tnum">
                  <IcoCoin size={12} /> +{adReward}
                </span>
              </>
            )}
          </button>

          {/* Ad 2 - Adsgram */}
          <button
            onClick={handleWatchAd2}
            disabled={watchingAd2 || adsgramLoading}
            className="tap flex flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-sky to-sky/80 text-[#04182a] font-extrabold text-[14px] px-3 py-4 shadow-[0_8px_24px_-8px_rgba(78,178,255,0.6)] hover:brightness-105 transition-[filter] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {watchingAd2 ? (
              <Spinner size={20} className="text-[#04182a]" />
            ) : adsgramLoading ? (
              <Spinner size={20} className="text-[#04182a]" />
            ) : (
              <>
                <IcoPlay size={20} />
                <span>Ad 2</span>
                <span className="flex items-center gap-1 rounded-full bg-[#04182a]/15 px-2 py-0.5 text-[12px] tnum">
                  <IcoCoin size={12} /> +{adReward}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* live ads — campaigns published in Promote appear here instantly */}
      <SectionH title={tr("h.liveAds", { n: liveAds.length })} />
      <div className="space-y-3">
        {liveAds.map((a, i) => (
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
                      {a.source === "campaign" ? <><IcoMega size={12} /> {tr("h.community")}</> : <><IcoSpark size={12} /> {tr("h.sponsored")}</>}
                    </Chip>
                    {a.ends_at && <Chip tone="dim"><IcoClock size={12} /> {timeLeft(a.ends_at)}</Chip>}
                    <div className="grow" />
                    <Button size="sm" onClick={() => { haptic("medium"); setAd(a); }}><IcoUpR size={14} /> {tr("c.open")}</Button>
                  </div>
                </div>
              </div>
            </div>
        ))}
        {liveAds.length === 0 && (
          <div className="card p-6 text-center">
            <div className="text-[13.5px] font-bold text-mut">{tr("h.noAds")}</div>
            <div className="text-[12.5px] text-dim mt-1">{tr("h.noAdsSub")}</div>
          </div>
        )}
      </div>

      {/* available tasks */}
      <SectionH title={tr("h.tasks", { n: availTasks.length })} />
      <div className="space-y-3">
        {availTasks.map((t, i) => (
          <div key={t.id} className="stagger card p-3.5" style={{ "--i": i } as React.CSSProperties}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-extrabold text-[14.5px] leading-tight">{t.title}</div>
              <Chip tone="gold"><IcoCoin size={12} /> +{t.reward}</Chip>
            </div>
            <p className="text-[12.5px] text-mut leading-snug mt-1 line-clamp-2">{t.description}</p>
            <div className="flex items-center gap-2 mt-3">
              <Chip tone="tg"><IcoMega size={12} /> {tr("h.community")}</Chip>
              <div className="grow" />
              {t.my_status === "pending"
                ? <Chip tone="gold">{tr("h.inReview")}</Chip>
                : <Button size="sm" onClick={() => { haptic("medium"); setTask(t); }}>{tr("h.start")}</Button>}
            </div>
          </div>
        ))}
        {availTasks.length === 0 && (
          <div className="card p-6 text-center">
            <div className="text-[13.5px] font-bold text-mut">{tr("h.noTasks")}</div>
            <div className="text-[12.5px] text-dim mt-1">{tr("h.noTasksSub")}</div>
          </div>
        )}
      </div>

      <Modal open={langOpen} onClose={() => setLangOpen(false)} title={tr("pr.language")} center>
        <div className="grid grid-cols-2 gap-2">
          {LANGS.map((l) => {
            const on = lang === l.code;
            return (
              <button key={l.code} onClick={() => { setLang(l.code); haptic("light"); setLangOpen(false); }}
                className={`tap flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${on ? "border-sky/55 bg-sky/10 shadow-[0_0_16px_-6px_rgba(78,178,255,0.5)]" : "border-line bg-panel hover:border-mut/40 active:scale-[0.97]"}`}>
                <span className="min-w-0">
                  <span className={`block text-[13.5px] font-extrabold leading-tight ${on ? "text-sky" : "text-ink"}`} dir={l.code === "ar" ? "rtl" : "ltr"}>{l.native}</span>
                  {l.code !== "en" && <span className="block text-[10px] text-dim font-semibold">{l.english}</span>}
                </span>
                {on && <span className="text-sky shrink-0"><IcoCheck size={15} /></span>}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-dim text-center mt-3">{tr("pr.choose")}</p>
      </Modal>

      {task && <TaskModal task={task} onClose={() => setTask(null)} onDone={onReward} />}
      {ad && <AdModal ad={ad} onClose={() => setAd(null)} onDone={onReward} />}

      <LeaderboardModal open={lbOpen} rows={board} onClose={() => setLbOpen(false)} />
    </div>
  );
}

/* ── Live ad flow (campaigns published in Promote — instant payout) ────────── */

/* ── Live ad flow (campaigns published in Promote — instant payout) ────────── */
function AdModal({ ad: a, onClose, onDone }: { ad: Ad; onClose: () => void; onDone: () => void }) {
  const { api, toast, setWalletBalance } = useApp();
  const { t: tr } = useLang();
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
    toast(tr("h.verified", { n: res.reward ?? a.reward }), "ok");
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
          <div className="text-[13px] text-mut mt-1">{tr("h.verifiedNote")}</div>
        </div>
      ) : phase === "crediting" ? (
        <div className="flex flex-col items-center py-9">
          <Spinner size={26} className="text-gold" />
          <div className="text-[13.5px] font-bold mt-3">{tr("h.addingCoins")}</div>
        </div>
      ) : (
        <>
          <div className="flex justify-center">
            <Ring deadline={deadline} totalSec={totalSec} size={150} onExpire={() => { haptic("medium"); settle(); }} />
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Chip tone="mint"><IcoCoin size={12} /> +{a.reward}</Chip>
            <Chip tone="dim"><IcoEye size={12} /> {tr("h.verifying")}</Chip>
          </div>
          <p className="text-[12.5px] text-dim text-center mt-2.5 leading-relaxed">
            {tr("h.autoClaim")}
          </p>
          <button onClick={() => { haptic("light"); openLink(a.url); }} className="tap mx-auto mt-3.5 flex items-center gap-1.5 text-[12.5px] font-bold text-sky hover:text-ink transition-colors">
            <IcoUpR size={14} /> {tr("h.reopen")}
          </button>
        </>
      )}
    </Modal>
  );
}

/* ── Community task flow (ads published in Promote) ───────────────────────── */
function TaskModal({ task: t, onClose, onDone }: { task: Task; onClose: () => void; onDone: () => void }) {
  const { api, toast } = useApp();
  const { t: tr } = useLang();
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
    toast(tr("h.taskVerified", { n: res.reward ?? t.reward }), "ok");
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
        <Chip tone="tg"><IcoMega size={12} /> {tr("h.userPub")}</Chip>
        {t.my_status === "pending" && <Chip tone="gold">{tr("h.inReview")}</Chip>}
        {t.deadline && <Chip tone="dim"><IcoClock size={12} /> {timeAgo(t.deadline).replace("ago", "left")}</Chip>}
      </div>
      {sent ? (
        <div className="text-center py-5 anim-pop">
          <span className="inline-flex w-14 h-14 rounded-full bg-mint/12 border border-mint/35 text-mint items-center justify-center"><IcoCheck size={26} /></span>
          <div className="font-extrabold mt-3">{tr("h.almost")}</div>
          <p className="text-[13px] text-mut mt-1.5">{tr("h.almostSub")}</p>
          <ClaimButton busy={busy} reward={t.reward} onClick={claim} />
        </div>
      ) : (
        <Button variant="sky" full size="lg" className="mt-4" onClick={openTaskLink}>
          {t.link ? <><IcoLink size={17} /> {tr("h.openTask")}</> : tr("h.startTask")}
        </Button>
      )}
    </Modal>
  );
}

function ClaimButton({ busy, reward, onClick }: { busy: boolean; reward: number; onClick: () => void }) {
  const { t: tr } = useLang();
  return (
    <Button size="lg" full className="mt-4" loading={busy} onClick={onClick}>
      {busy ? <Spinner size={16} /> : <IcoCoin size={18} />} {tr("h.claim", { n: reward })}
    </Button>
  );
}

/* ── top-10 leaderboard — first names only, your row flagged server-side ──── */
function LeaderboardModal({ open, rows, onClose }: { open: boolean; rows: LeaderboardRow[]; onClose: () => void }) {
  const { t } = useLang();
  const medal = (rank: number) =>
    rank === 1 ? { c: "#ffc24b", glow: "shadow-[0_0_24px_-6px_rgba(255,194,75,0.55)]", ring: "border-gold/50" }
    : rank === 2 ? { c: "#c9d6e3", glow: "", ring: "border-line2" }
    : rank === 3 ? { c: "#d9975f", glow: "", ring: "border-[#d9975f]/40" }
    : { c: "", glow: "", ring: "border-line" };
  return (
    <Modal open={open} onClose={onClose} title={t("h.leaderboard")} tall>
      {/* banner */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/35 bg-gradient-to-br from-gold/15 via-panel to-panel p-4">
        <span className="absolute -top-6 -right-4 text-gold/25"><IcoTrophy size={96} /></span>
        <div className="relative flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-gold/20 border border-gold/45 text-gold flex items-center justify-center shrink-0 anim-coinbob"><IcoTrophy size={22} /></span>
          <div>
            <div className="font-display text-[17px] font-bold gold-text">{t("h.leaderboard")}</div>
            <div className="text-[12px] text-mut leading-snug mt-0.5">{t("h.lbSub")}</div>
          </div>
        </div>
      </div>

      {/* rows */}
      <div className="space-y-2 mt-3.5">
        {rows.map((r) => {
          const m = medal(r.rank);
          const podium = r.rank <= 3;
          return (
            <div key={r.rank}
              className={`flex items-center gap-3 rounded-xl border bg-panel px-3 py-2.5 anim-fade ${m.ring} ${m.glow} ${r.me ? "!border-gold/60 !bg-gold/8" : ""} ${podium ? "py-3" : ""}`}
              style={{ animationDelay: `${Math.min(r.rank, 10) * 45}ms` }}>
              {/* rank badge */}
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[13px] shrink-0 tnum ${podium ? "text-[#241a05]" : "text-dim border border-line"}`}
                style={podium ? { background: m.c, boxShadow: `0 4px 14px -4px ${m.c}` } : undefined}>
                {r.rank}
              </span>
              <Avatar name={r.name} size={podium ? 40 : 34} hue={(r.rank * 67) % 360} />
              <div className="grow min-w-0">
                <div className="text-[13.5px] font-extrabold truncate flex items-center gap-1.5">
                  <span className="truncate">{r.name}</span>
                  {r.me && <Chip tone="gold" className="!px-1.5 !py-0 !text-[9.5px]">{t("h.lbYou")}</Chip>}
                </div>
                {podium && <div className="text-[10.5px] text-dim font-bold uppercase tracking-wider">#{r.rank}</div>}
              </div>
              <div className={`font-display font-bold tnum shrink-0 flex items-center gap-1.5 ${r.rank === 1 ? "text-[19px] gold-text" : r.rank <= 3 ? "text-[16px]" : "text-[15px] text-ink"}`}>
                <IcoCoin size={r.rank === 1 ? 17 : 14} className={r.rank === 1 ? "text-gold" : "text-mut"} />
                {fmt(r.coins)}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="card p-7 text-center">
            <span className="inline-flex w-14 h-14 rounded-full bg-panel2 border border-line text-dim items-center justify-center mb-3"><IcoTrophy size={24} /></span>
            <div className="text-[13px] text-mut leading-relaxed max-w-[260px] mx-auto">{t("h.lbEmpty")}</div>
          </div>
        )}
      </div>
    </Modal>
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
