import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Ad, Backend, Bootstrap, RoundState, Settings, Task, UserProfile, Wallet } from "../lib/types";
import { haptic, setChromeColor, THEME_KEY } from "../lib/telegram";

export type Tab = "home" | "promote" | "arena" | "invite" | "wallet";
export type Theme = "dark" | "light";
export interface Toast { id: number; msg: string; kind: "ok" | "err" | "info" }

interface Ctx {
  mode: "mock" | "live";
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
      try {
        const b = await backend.bootstrap();
        setUser(b.user); setSettings(b.settings); setWallet(b.wallet);
        setBootError(null);
        refreshAds(); refreshTasks(); refreshRound();
      } catch (e) {
        setBootError(e instanceof Error ? e.message : "Could not reach the Bid X server");
      }
    })();
  }, [backend, refreshAds, refreshTasks, refreshRound]);

  useEffect(() => {
    const unsub = backend.subscribeRound(() => refreshRound());
    return unsub;
  }, [backend, refreshRound]);

  // In the local preview the simulated server keeps moving (bots bid, referred
  // friends complete tasks and earn you commissions) — poll the core state so
  // balance changes surface without a manual refresh.
  useEffect(() => {
    if (backend.mode !== "mock") return;
    const iv = setInterval(() => { refreshCore(); }, 7000);
    return () => clearInterval(iv);
  }, [backend, refreshCore]);

  return (
    <AppCtx.Provider value={{
      mode: backend.mode, api: backend, user, settings, wallet, ads, tasks, round,
      bootError, retryBoot: () => { setBootError(null); busy.current = false; refreshCore(); },
      tab, setTab, theme, setTheme, openProfile: onProfile, openAdmin: onAdmin,
      toasts, toast,
      setWalletBalance: (n) => setWallet((w) => (w ? { ...w, balance: n } : w)),
      refreshCore, refreshAds, refreshTasks, refreshRound,
    }}>
      {children}
    </AppCtx.Provider>
  );
}
