import { useEffect, useMemo, useState } from "react";
import { AppProvider, useApp, type Tab } from "./state/AppContext";
import { bootTelegram, haptic, initData, isTelegram, openLink } from "./lib/telegram";
import { createMockBackend, resetMock } from "./lib/mock";
import { createSupabaseBackend, hasSupabase } from "./lib/supabaseBackend";
import type { Backend } from "./lib/types";
import { fmt, timeAgo } from "./lib/types";
import { Avatar, Button, Chip, IcoClock, IcoCoin, IcoFlame, IcoGavel, IcoGift, IcoHome, IcoInfo, IcoMega, IcoPlane, IcoRefresh, IcoShield, IcoWallet, IcoX, Modal, Spinner } from "./components/ui";
import Home from "./screens/Home";
import Promote from "./screens/Promote";
import Arena from "./screens/Arena";
import Invite from "./screens/Invite";
import Wallet from "./screens/Wallet";
import Admin from "./screens/Admin";

const APP_URL = ((import.meta as unknown as { env?: Record<string, string> }).env ?? {}).VITE_APP_URL ?? "https://t.me/BidX_SmartEarningsbot/Earn";
const previewFlag = () => new URLSearchParams(location.search).has("preview") || localStorage.getItem("bidx_preview") === "1";
const enablePreview = () => { localStorage.setItem("bidx_preview", "1"); location.reload(); };

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "text-[26px]" : size === "sm" ? "text-[15px]" : "text-[19px]";
  return (
    <span className={`font-display font-bold tracking-[0.06em] ${s}`}>
      BID&nbsp;<span className="text-gold glow-gold">X</span>
    </span>
  );
}

export default function App() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [noConfig, setNoConfig] = useState(false);

  useEffect(() => {
    bootTelegram();
    if (previewFlag()) { setBackend(createMockBackend()); return; }
    if (isTelegram()) {
      if (!hasSupabase()) { setNoConfig(true); return; }
      setBackend(createSupabaseBackend(initData()));
    }
    // otherwise: stay on the gate
  }, []);

  if (backend) {
    return (
      <AppProvider backend={backend} onProfile={() => (profileHack.open = true)} onAdmin={() => (adminHack.open = true)}>
        <Shell backend={backend} />
      </AppProvider>
    );
  }
  return <Gate noConfig={noConfig} />;
}

/* tiny bridge so the provider can open overlays without prop drilling */
const profileHack = { open: false };
const adminHack = { open: false };

function Shell({ backend }: { backend: Backend }) {
  const { user, settings, bootError, retryBoot, tab, setTab, toasts } = useApp();
  const [profile, setProfile] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      if (profileHack.open) { profileHack.open = false; setProfile(true); }
      if (adminHack.open) { adminHack.open = false; setAdmin(true); }
    }, 120);
    return () => clearInterval(iv);
  }, []);

  // wire the real openers into the context-provided callbacks
  useEffect(() => {
    profileHack.open = false; adminHack.open = false;
  }, []);

  if (bootError) return <BootError msg={bootError} retry={retryBoot} />;
  if (!user || !settings) return <Splash />;

  return (
    <div className="max-w-md mx-auto min-h-screen relative">
      <div className="dotgrid fixed inset-x-0 top-0 h-[420px] pointer-events-none max-w-md mx-auto" />

      <main className="pb-[104px] relative">
        {tab === "home" && <Home />}
        {tab === "promote" && <Promote />}
        {tab === "arena" && <Arena />}
        {tab === "invite" && <Invite />}
        {tab === "wallet" && <Wallet />}
      </main>

      <TabBar tab={tab} setTab={setTab} />

      {/* toasts */}
      <div className="fixed top-3 inset-x-0 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`anim-toast max-w-md w-auto px-4 py-2.5 rounded-xl border text-[13px] font-bold flex items-center gap-2 shadow-xl backdrop-blur
            ${t.kind === "ok" ? "bg-mint/15 border-mint/40 text-mint" : t.kind === "err" ? "bg-coral/15 border-coral/40 text-coral" : "bg-sky/15 border-sky/40 text-sky"}`}>
            {t.kind === "ok" ? <IcoCoin size={15} /> : t.kind === "err" ? <IcoX size={15} /> : <IcoInfo size={15} />}
            {t.msg}
          </div>
        ))}
      </div>

      {settings.maintenance_mode && !user.is_admin && (
        <div className="fixed inset-0 z-[65] bg-abyss/90 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="card p-6 text-center max-w-[320px] anim-pop">
            <span className="inline-flex w-14 h-14 rounded-full bg-gold/12 border border-gold/35 text-gold items-center justify-center"><IcoClock size={26} /></span>
            <div className="font-display text-[17px] font-bold mt-3">Maintenance mode</div>
            <p className="text-[13px] text-mut mt-2 leading-relaxed">Earning is briefly paused by the admin. Your Coins and positions are safe.</p>
          </div>
        </div>
      )}

      <ProfileSheet open={profile} onClose={() => setProfile(false)} mode={backend.mode} />
      {admin && user.is_admin && <Admin onClose={() => setAdmin(false)} />}
    </div>
  );

  function ProfileSheet({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: "mock" | "live" }) {
    const { user, wallet, settings } = useApp();
    if (!user || !wallet || !settings) return null;
    return (
      <Modal open={open} onClose={onClose} title="Profile">
        <div className="flex items-center gap-4">
          <Avatar name={`${user.first_name} ${user.last_name ?? ""}`} photo={user.photo_url} size={64} />
          <div className="min-w-0">
            <div className="font-display text-[17px] font-bold truncate">{user.first_name} {user.last_name}</div>
            <div className="text-[13px] text-mut">@{user.username}</div>
            {user.is_admin && <Chip tone="gold" className="mt-1.5"><IcoShield size={12} /> Admin</Chip>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mt-4">
          <div className="card p-3 text-center"><div className="font-display text-[16px] font-bold gold-text tnum">{fmt(wallet.balance)}</div><div className="text-[10px] uppercase tracking-wider text-dim font-bold mt-1">Balance</div></div>
          <div className="card p-3 text-center"><div className="font-display text-[16px] font-bold text-mint tnum">{fmt(wallet.total_earned)}</div><div className="text-[10px] uppercase tracking-wider text-dim font-bold mt-1">Earned</div></div>
          <div className="card p-3 text-center"><div className="font-display text-[16px] font-bold tnum">+{fmt(wallet.today_earned)}</div><div className="text-[10px] uppercase tracking-wider text-dim font-bold mt-1">Today</div></div>
        </div>

        <div className="card divide-y divide-line/60 mt-4 overflow-hidden">
          <KV k="Telegram ID" v={user.telegram_id ?? "—"} mono />
          <KV k="Language" v={(user.language ?? "en").toUpperCase()} />
          <KV k="Member since" v={timeAgo(user.created_at).replace("ago", "ago")} />
          <KV k="Coin rate" v={`1 Coin = ${settings.coin_usdt_rate} USDT`} />
          <KV k="Session" v={mode === "mock" ? "Developer preview (simulated)" : "Telegram initData · verified"} />
        </div>

        {user.is_admin && (
          <Button full className="mt-4" variant="dark" onClick={() => { onClose(); adminHack.open = true; }}>
            <IcoShield size={17} /> Open Admin Panel
          </Button>
        )}

        {mode === "mock" && (
          <div className="card mt-4 p-4 border-sky/35">
            <div className="text-[12px] font-extrabold uppercase tracking-wider text-sky">Developer preview</div>
            <p className="text-[12.5px] text-mut mt-1.5 leading-relaxed">This session simulates Telegram + Supabase locally. Inside Telegram, identity and every Coin movement are verified server-side.</p>
            <div className="flex gap-2 mt-3">
              <Button variant="ghost" size="sm" className="flex-1" onClick={resetMock}><IcoRefresh size={14} /> Reset data</Button>
              <Button variant="sky" size="sm" className="flex-1" onClick={() => { localStorage.removeItem("bidx_preview"); location.href = location.pathname; }}><IcoX size={14} /> Exit preview</Button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-dim text-center mt-4 mb-1">Bid X · Smart Earnings — balances, bids and payouts are decided by the server, never by this device.</p>
      </Modal>
    );
  }
}

const KV = ({ k, v, mono }: { k: string; v: string; mono?: boolean }) => (
  <div className="flex items-center justify-between px-4 py-2.5">
    <span className="text-[12.5px] text-mut font-semibold">{k}</span>
    <span className={`text-[12.5px] font-bold ${mono ? "tnum" : ""}`}>{v}</span>
  </div>
);

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const left: { v: Tab; label: string; icon: React.ReactNode }[] = [
    { v: "home", label: "Home", icon: <IcoHome size={21} /> },
    { v: "promote", label: "Promote", icon: <IcoMega size={21} /> },
  ];
  const right: { v: Tab; label: string; icon: React.ReactNode }[] = [
    { v: "invite", label: "Invite", icon: <IcoGift size={21} /> },
    { v: "wallet", label: "Wallet", icon: <IcoWallet size={21} /> },
  ];
  const arenaActive = tab === "arena";

  const side = (it: { v: Tab; label: string; icon: React.ReactNode }) => {
    const active = tab === it.v;
    return (
      <button key={it.v} onClick={() => setTab(it.v)} className="tap relative flex flex-col items-center gap-1 pt-2.5 pb-2">
        <span className={`absolute top-0 h-[2.5px] w-8 rounded-full transition-all duration-300 ${active ? "bg-gold shadow-[0_0_10px_rgba(255,194,75,0.7)]" : "bg-transparent"}`} />
        <span className={`transition-colors duration-200 ${active ? "text-gold" : "text-dim"}`}>{it.icon}</span>
        <span className={`text-[10px] font-bold tracking-wide transition-colors duration-200 ${active ? "text-gold" : "text-dim"}`}>{it.label}</span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      <div className="max-w-md mx-auto border-t border-line bg-deep/95 backdrop-blur-md safe-b">
        <div className="grid grid-cols-5 items-end">
          {left.map(side)}

          {/* Bid & Win — compact, colorful, live, sized to fit the bar */}
          <button onClick={() => setTab("arena")} className="tap relative flex flex-col items-center pt-1 pb-1.5 group" aria-label="Bid & Win">
            <span
              className={`relative w-10 h-10 rounded-full flex items-center justify-center text-[#331303] border-2 border-abyss transition-all duration-200 group-active:scale-95
                ${arenaActive ? "scale-[1.07]" : ""}`}
              style={{
                background: "linear-gradient(140deg,#ffd76a 0%,#ffab4a 40%,#ff6b7a 78%,#ff4d5e 100%)",
                boxShadow: arenaActive
                  ? "0 8px 20px -6px rgba(255,107,122,0.8), 0 0 0 3px rgba(255,194,75,0.32)"
                  : "0 8px 18px -8px rgba(255,107,122,0.65)",
              }}
            >
              <IcoGavel size={19} />
              {/* LIVE badge with hot flame */}
              <span className="absolute -top-1 -right-2.5 flex items-center gap-[2.5px] rounded-full bg-abyss border border-coral/70 px-1 py-[2px] text-[6.5px] font-black tracking-[0.08em] text-coral shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                <IcoFlame size={7.5} className="text-gold" />
                LIVE
              </span>
              <span className="absolute inset-0 rounded-full border border-gold/40" style={{ animation: "radar 2.4s ease-out infinite" }} />
            </span>
            <span className={`text-[10px] font-extrabold tracking-wide mt-0.5 transition-colors duration-200 ${arenaActive ? "text-gold" : "text-mut"}`}>Bid &amp; Win</span>
          </button>

          {right.map(side)}
        </div>
      </div>
    </nav>
  );
}

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="relative anim-pop">
        <span className="absolute -inset-6 rounded-full border border-gold/20" style={{ animation: "radar 2s ease-out infinite" }} />
        <span className="absolute -inset-6 rounded-full border border-gold/20" style={{ animation: "radar 2s ease-out infinite", animationDelay: "0.7s" }} />
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gold to-gold2 flex items-center justify-center text-[#241a05] shadow-[0_10px_40px_-8px_rgba(255,194,75,0.6)]">
          <IcoCoin size={40} />
        </div>
      </div>
      <div className="mt-6"><Logo size="lg" /></div>
      <div className="flex items-center gap-2 text-mut text-[13px] font-semibold mt-4">
        <Spinner size={15} className="text-gold" /> Verifying your Telegram account…
      </div>
      <p className="text-[11.5px] text-dim mt-2 text-center max-w-[260px]">Your Bid X account is created automatically from your Telegram ID.</p>
    </div>
  );
}

function BootError({ msg, retry }: { msg: string; retry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card p-6 max-w-[340px] text-center anim-pop">
        <span className="inline-flex w-14 h-14 rounded-full bg-coral/12 border border-coral/35 text-coral items-center justify-center"><IcoX size={26} /></span>
        <div className="font-display text-[17px] font-bold mt-3">Couldn't connect</div>
        <p className="text-[13px] text-coral/90 font-semibold mt-2 break-words">{msg}</p>
        <p className="text-[12.5px] text-mut mt-2 leading-relaxed">
          If you just deployed, make sure the SQL migration has run and the <b>telegram-login</b> Edge Function is live with your bot token.
        </p>
        <Button full className="mt-4" onClick={() => { haptic("light"); retry(); }}><IcoRefresh size={16} /> Try again</Button>
      </div>
    </div>
  );
}

function Gate({ noConfig }: { noConfig: boolean }) {
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="dotgrid absolute inset-0 pointer-events-none" />
      <div className="absolute -top-24 -right-20 w-[340px] h-[340px] rounded-full bg-gold/10 blur-[90px] anim-float pointer-events-none" />
      <div className="absolute -bottom-28 -left-24 w-[360px] h-[360px] rounded-full bg-tg/10 blur-[90px] anim-float pointer-events-none" style={{ animationDelay: "1.4s" }} />

      <div className="relative anim-pop">
        <span className="absolute inset-0 rounded-full border border-tg/25" style={{ animation: "radar 2.4s ease-out infinite" }} />
        <span className="absolute inset-0 rounded-full border border-tg/25" style={{ animation: "radar 2.4s ease-out infinite", animationDelay: "0.9s" }} />
        <div className="absolute inset-0 anim-spin-slow pointer-events-none">
          <span className="absolute left-1/2 -top-1 -translate-x-1/2 text-gold"><IcoCoin size={22} /></span>
        </div>
        <div className="w-28 h-28 rounded-full bg-tg/12 border border-tg/40 flex items-center justify-center text-tg relative anim-float">
          <IcoPlane size={46} />
        </div>
      </div>

      <div className="mt-7 anim-rise" style={{ animationDelay: "120ms" }}><Logo size="lg" /></div>
      <h1 className="font-display text-[21px] font-bold leading-snug mt-4 max-w-[300px] anim-rise" style={{ animationDelay: "180ms" }}>
        Bid X can only be used <span className="text-tg">inside Telegram</span>
      </h1>
      <p className="text-[13.5px] text-mut leading-relaxed mt-3 max-w-[310px] anim-rise" style={{ animationDelay: "240ms" }}>
        {noConfig
          ? "This build is missing its Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild."
          : "Open the Mini App from the official bot. Your account is created automatically from your Telegram ID — no passwords, no sign-up forms."}
      </p>

      {!noConfig && (
        <Button size="lg" className="mt-6 anim-rise" variant="gold" onClick={() => openLink(APP_URL)}>
          <IcoPlane size={18} /> Open @BidX_SmartEarningsbot
        </Button>
      )}

      <div className="flex gap-2 mt-6 flex-wrap justify-center anim-rise" style={{ animationDelay: "320ms" }}>
        <Chip tone="gold"><IcoCoin size={12} /> 1 Coin = 0.0006 USDT</Chip>
        <Chip tone="mint">85% winner pools</Chip>
        <Chip tone="tg">Telegram-signed login</Chip>
      </div>

      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-1.5 anim-rise" style={{ animationDelay: "420ms" }}>
        <span className="text-[11px] text-dim">Building or testing Bid X?</span>
        <button onClick={enablePreview} className="tap text-[12.5px] font-bold text-sky underline decoration-sky/40 underline-offset-4 hover:decoration-sky">
          Launch the developer preview
        </button>
      </div>
    </div>
  );
}
