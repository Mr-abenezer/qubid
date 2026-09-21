import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Ad, Backend, Bootstrap, Broadcast, RoundState, Settings, Task, UserProfile, Wallet } from "../lib/types";
import { fmt } from "../lib/types";
import { haptic, setChromeColor, THEME_KEY } from "../lib/telegram";
import { sanitizeHtml } from "../lib/sanitize";
import { Chip, IcoBell, IcoTrophy, IcoX } from "../components/ui";

export type Tab = "home" | "promote" | "arena" | "invite" | "wallet";
export type Theme = "dark" | "light";
export interface Toast { id: number; msg: string; kind: "ok" | "err" | "info" }
export interface WinnerPop { username: string; payout: number; round: number; isMe: boolean }

const BC_DISMISSED_KEY = "bidx_bc_dismissed";

interface Ctx {
  api: Backend;
  user: UserProfile | null;
  settings: Settings | null;
  wallet: Wallet | null;
  ads: Ad[];
  tasks: Task[];
  round: RoundState | null;
  bootError: string | null;
  retryBoot: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  openProfile: () => void;
  openAdmin: () => void;
  toasts: Toast[];
  toast: (msg: string, kind?: Toast["kind"]) => void;
  setWalletBalance: (n: number) => void;
  broadcast: Broadcast | null;
  dismissBroadcast: () => void;
  refreshCore: () => Promise<void>;
  refreshAds: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshRound: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("AppContext missing");
  return c;
};

let toastSeq = 1;

export function AppProvider({ backend, onProfile, onAdmin, children }: {
  backend: Backend;
  onProfile: () => void;
  onAdmin: () => void;
  children: ReactNode;
}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [round, setRound] = useState<RoundState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [tab, setTabRaw] = useState<Tab>("home");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark") return t;
      return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch { return "dark"; }
  });
  const busy = useRef(false);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode */ }
    haptic("light");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    setChromeColor(theme === "light");
  }, [theme]);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "info") => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const setTab = useCallback((t: Tab) => {
    setTabRaw(t);
    haptic("light");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const refreshRound = useCallback(async () => {
    try { setRound(await backend.getRound()); } catch { /* keep last */ }
  }, [backend]);

  const refreshAds = useCallback(async () => {
    try { setAds(await backend.listAds()); } catch { /* keep last */ }
  }, [backend]);

  const refreshTasks = useCallback(async () => {
    try { setTasks(await backend.listTasks()); } catch { /* keep last */ }
  }, [backend]);

  const refreshCore = useCallback(async () => {
    try {
      const b: Bootstrap = await backend.bootstrap();
      setUser(b.user); setSettings(b.settings); setWallet(b.wallet);
    } catch (e) {
      setBootError(e instanceof Error ? e.message : "Connection failed");
    }
  }, [backend]);

  useEffect(() => {
    if (busy.current) return;
    busy.current = true;
    (async () => {
      // Transient hiccups (JWT clock-skew races, cold Edge Function starts)
      // must never greet a first-time visitor — retry silently twice first.
      for (let i = 0; ; i++) {
        try {
          const b = await backend.bootstrap();
          setUser(b.user); setSettings(b.settings); setWallet(b.wallet);
          setBootError(null);
          refreshAds(); refreshTasks(); refreshRound();
          break;
        } catch (e) {
          if (i >= 2) {
            setBootError(e instanceof Error ? e.message : "Could not reach the Bid X server");
            break;
          }
          await new Promise((r) => setTimeout(r, i === 0 ? 1500 : 4000));
        }
      }
    })();
  }, [backend, refreshAds, refreshTasks, refreshRound]);

  useEffect(() => {
    const unsub = backend.subscribeRound(() => refreshRound());
    return unsub;
  }, [backend, refreshRound]);

  // ── winner announcement: a fresh name at the top of the winners list ──────
  const [winnerPop, setWinnerPop] = useState<WinnerPop | null>(null);
  const lastWinnerKey = useRef<string | null>(null);
  useEffect(() => {
    const w = round?.winners?.[0];
    if (!w) return;
    const key = `${w.round}:${w.at}`;
    if (lastWinnerKey.current === null) { lastWinnerKey.current = key; return; } // don't announce history on boot
    if (key === lastWinnerKey.current) return;
    lastWinnerKey.current = key;
    setWinnerPop({ username: w.user.username, payout: w.payout, round: w.round, isMe: w.user.id === user?.id });
    haptic("success");
  }, [round, user?.id]);
  useEffect(() => {
    if (!winnerPop) return;
    const t = setTimeout(() => setWinnerPop(null), 3000); // auto-vanish
    return () => clearTimeout(t);
  }, [winnerPop]);

  // ── admin broadcast popup: poll every minute, remember dismissals ─────────
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [bcDismissed, setBcDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(BC_DISMISSED_KEY) ?? "[]") as string[]; } catch { return []; }
  });
  const refreshBroadcast = useCallback(async () => {
    try { setBroadcast(await backend.getBroadcast()); } catch { /* keep last */ }
  }, [backend]);
  useEffect(() => {
    refreshBroadcast();
    const iv = setInterval(refreshBroadcast, 60_000);
    return () => clearInterval(iv);
  }, [refreshBroadcast]);
  const dismissBroadcast = useCallback(() => {
    setBroadcast((b) => {
      if (b) {
        setBcDismissed((prev) => {
          const next = [...prev, b.id].slice(-10);
          try { localStorage.setItem(BC_DISMISSED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
          return next;
        });
      }
      return null;
    });
    haptic("light");
  }, []);
  const visibleBroadcast = broadcast && !bcDismissed.includes(broadcast.id) ? broadcast : null;

  return (
    <AppCtx.Provider value={{
      api: backend, user, settings, wallet, ads, tasks, round,
      bootError, retryBoot: () => { setBootError(null); busy.current = false; refreshCore(); },
      tab, setTab, theme, setTheme, openProfile: onProfile, openAdmin: onAdmin,
      toasts, toast,
      setWalletBalance: (n) => setWallet((w) => (w ? { ...w, balance: n } : w)),
      broadcast: visibleBroadcast, dismissBroadcast,
      refreshCore, refreshAds, refreshTasks, refreshRound,
    }}>
      {children}

      {/* centered popups: broadcast banner + winner announcement */}
      {(visibleBroadcast || winnerPop) && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center px-4 pointer-events-none">
          <div className="w-full max-w-md flex flex-col gap-2.5">
            {visibleBroadcast && (
              <div className="pointer-events-auto anim-pop card border-gold/45 bg-deep/95 backdrop-blur-md p-3.5 flex items-start gap-3 shadow-[0_18px_60px_-12px_rgba(255,194,75,0.45)]">
                <span className="relative shrink-0 mt-0.5">
                  <span className="w-8 h-8 rounded-lg bg-gold/15 border border-gold/40 text-gold flex items-center justify-center"><IcoBell size={16} /></span>
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gold animate-pulse" />
                </span>
                <div
                  className="grow min-w-0 text-[13px] leading-relaxed break-words [&_a]:text-sky [&_a]:font-bold [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(visibleBroadcast.body) }}
                />
                <button onClick={dismissBroadcast} aria-label="Dismiss announcement"
                  className="tap shrink-0 p-1.5 -mr-1 -mt-1 rounded-lg text-mut hover:text-ink transition-colors"><IcoX size={16} /></button>
              </div>
            )}
            {winnerPop && (
              <div className="pointer-events-auto anim-pop card border-gold/55 bg-deep/95 backdrop-blur-md p-3.5 flex items-center gap-3 shadow-[0_12px_50px_-8px_rgba(255,194,75,0.55)]">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/35 to-gold/10 border border-gold/55 text-gold flex items-center justify-center anim-float shrink-0"><IcoTrophy size={20} /></span>
                <div className="grow min-w-0">
                  <div className="text-[13.5px] font-extrabold truncate">
                    {winnerPop.isMe ? <>You won round #{winnerPop.round}!</> : <>@{winnerPop.username} won round #{winnerPop.round}</>}
                  </div>
                  <div className="text-[12.5px] font-bold text-mint tnum">+{fmt(winnerPop.payout)} Coins paid out</div>
                </div>
                <Chip tone="gold" className="shrink-0">Bid &amp; Win</Chip>
              </div>
            )}
          </div>
        </div>
      )}
    </AppCtx.Provider>
  );
}
