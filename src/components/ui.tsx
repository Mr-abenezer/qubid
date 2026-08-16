import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmt } from "../lib/types";

/* ─────────────────────────── icons (hand-drawn) ─────────────────────────── */
type IP = { size?: number; className?: string };
const Svg = ({ size = 20, className, children, fill = false }: IP & { children: ReactNode; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}
    fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"}
    strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const IcoCoin = (p: IP) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.6" /><path d="M10 10l4 4M14 10l-4 4" /></Svg>
);
export const IcoBolt = (p: IP) => <Svg {...p}><path d="M13 2 4.7 13.4h5.8L10 22l8.3-11.4h-5.8L13 2z" /></Svg>;
export const IcoCheck = (p: IP) => <Svg {...p}><path d="M4.5 12.6l5 5L19.5 7" /></Svg>;
export const IcoGavel = (p: IP) => (
  <Svg {...p}><path d="M13.2 3.2l7.6 7.6M11 5.4l7.6 7.6M14.3 2.1l7.6 7.6M12.1 4.3l-2.2 2.2 7.6 7.6 2.2-2.2zM9.9 6.5 2.5 13.9a1.6 1.6 0 0 0 0 2.3l3.3 3.3a1.6 1.6 0 0 0 2.3 0l7.4-7.4M2.5 21.5h9" /></Svg>
);
export const IcoWallet = (p: IP) => (
  <Svg {...p}><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11.5A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19H6a2.5 2.5 0 0 1-2.5-2.5v-9z" /><path d="M3.5 9.5h17M15.5 14h2" /></Svg>
);
export const IcoMega = (p: IP) => (
  <Svg {...p}><path d="M3 10.5v3.2l3.6.9L19 19.5a.8.8 0 0 0 1.5-.6V5.1a.8.8 0 0 0-1.5-.6L6.6 9.6 3 10.5z" /><path d="M7.5 15.5v3.2a1.3 1.3 0 0 0 2.6 0v-2.5" /></Svg>
);
export const IcoClock = (p: IP) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IcoUsers = (p: IP) => (
  <Svg {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15.5 5.7a3.2 3.2 0 0 1 0 5.6M17.5 14.9c1.6.7 2.7 2.3 3 4.6" /></Svg>
);
export const IcoGear = (p: IP) => (
  <Svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8" /></Svg>
);
export const IcoUpR = (p: IP) => <Svg {...p}><path d="M7 17 17 7M9.5 7H17v7.5" /></Svg>;
export const IcoDownL = (p: IP) => <Svg {...p}><path d="M17 7 7 17M14.5 17H7V9.5" /></Svg>;
export const IcoBell = (p: IP) => (
  <Svg {...p}><path d="M12 3.5a6 6 0 0 1 6 6c0 3.5.9 5 1.8 5.9H4.2C5.1 14.5 6 13 6 9.5a6 6 0 0 1 6-6z" /><path d="M9.8 18.5a2.3 2.3 0 0 0 4.4 0" /></Svg>
);
export const IcoSearch = (p: IP) => <Svg {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="M15.2 15.2 20.5 20.5" /></Svg>;
export const IcoX = (p: IP) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IcoPlus = (p: IP) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IcoMinus = (p: IP) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const IcoChev = (p: IP) => <Svg {...p}><path d="M9.5 6l6 6-6 6" /></Svg>;
export const IcoPlane = (p: IP) => (
  <Svg {...p}><path d="M21.3 3.3 2.9 10.4c-.9.35-.85 1.6.05 1.9l4.7 1.55 1.8 5.5c.3.85 1.4.95 1.85.2l2.3-3.2 4.7 3.4c.7.5 1.65.1 1.85-.75l2.6-13.5c.2-.95-.7-1.7-1.55-1.35z" /><path d="M9.5 13.8 21 3.6" /></Svg>
);
export const IcoShield = (p: IP) => (
  <Svg {...p}><path d="M12 2.8 19 5.6v5.1c0 4.6-3 8.3-7 10.5-4-2.2-7-5.9-7-10.5V5.6l7-2.8z" /><path d="M9 11.8l2.1 2.1L15.3 9.7" /></Svg>
);
export const IcoTrophy = (p: IP) => (
  <Svg {...p}><path d="M7 4h10v5.5a5 5 0 0 1-10 0V4z" /><path d="M7 5.5H4.2a0 0 0 0 0 0 0c0 3 1.2 4.8 2.8 5.2M17 5.5h2.8c0 3-1.2 4.8-2.8 5.2M12 14.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z" /></Svg>
);
export const IcoLink = (p: IP) => (
  <Svg {...p}><path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.24 4.24 0 0 0-6-6l-1.2 1.2M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.24 4.24 0 0 0 6 6l1.2-1.2" /></Svg>
);
export const IcoBan = (p: IP) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></Svg>;
export const IcoPlay = (p: IP) => <Svg {...p} fill><path d="M8 5.5v13c0 .8.9 1.3 1.6.9l10-6.5c.6-.4.6-1.4 0-1.8l-10-6.5c-.7-.4-1.6.1-1.6.9z" /></Svg>;
export const IcoRefresh = (p: IP) => <Svg {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5" /></Svg>;
export const IcoEye = (p: IP) => (
  <Svg {...p}><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></Svg>
);
export const IcoPause = (p: IP) => <Svg {...p}><path d="M9 6v12M15 6v12" /></Svg>;
export const IcoFlame = (p: IP) => (
  <Svg {...p}><path d="M12 2.5c.6 3-1.5 4.6-2.9 6.3C7.6 10.6 7 12 7 13.7A5.2 5.2 0 0 0 12.2 19a5.3 5.3 0 0 0 5.3-5.4c0-2.4-1.3-4-2.4-5.6-.9-1.3-1.9-2.9-1.6-5.5z" /><path d="M12 21.5v-3" /></Svg>
);
export const IcoDoc = (p: IP) => (
  <Svg {...p}><path d="M6 3.5h8l4 4V20a.9.9 0 0 1-1 .9H6a.9.9 0 0 1-1-.9V4.4a.9.9 0 0 1 1-.9z" /><path d="M14 3.5V8h4M8.5 12h7M8.5 15.5h7" /></Svg>
);
export const IcoSend = (p: IP) => <Svg {...p}><path d="M21 3.5 3 10.8l6.5 2.7L12.2 20 21 3.5z" /><path d="M9.5 13.5 21 3.5" /></Svg>;
export const IcoHome = (p: IP) => (
  <Svg {...p}><path d="M3.5 11 12 3.8 20.5 11M5.5 9.5v10h13v-10M10 19.5v-5h4v5" /></Svg>
);
export const IcoStack = (p: IP) => (
  <Svg {...p}><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" /></Svg>
);
export const IcoStop = (p: IP) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M9 9h6v6H9z" /></Svg>;
export const IcoSpark = (p: IP) => (
  <Svg {...p} fill><path d="M12 2.5c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7zM19 15.5c.35 2.3 1.2 3.15 3.5 3.5-2.3.35-3.15 1.2-3.5 3.5-.35-2.3-1.2-3.15-3.5-3.5 2.3-.35 3.15-1.2 3.5-3.5z" /></Svg>
);
export const IcoInfo = (p: IP) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.8v.4" /></Svg>;
export const IcoGift = (p: IP) => (
  <Svg {...p}><path d="M4.5 11.5h15V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-7.5z" /><path d="M3.5 7.5h17v4h-17zM12 7.5V21M12 7.5C12 5 10.8 3.2 8.9 3.2a2.1 2.1 0 0 0 0 4.2M12 7.5c0-2.5 1.2-4.3 3.1-4.3a2.1 2.1 0 0 1 0 4.2" /></Svg>
);
export const IcoCopy = (p: IP) => (
  <Svg {...p}><rect x="8.5" y="8.5" width="12" height="12" rx="2.2" /><path d="M15.5 5.3v-.5a2.3 2.3 0 0 0-2.3-2.3H5.8a2.3 2.3 0 0 0-2.3 2.3v7.4a2.3 2.3 0 0 0 2.3 2.3h.5" /></Svg>
);
export const IcoShare = (p: IP) => (
  <Svg {...p}><circle cx="6" cy="12" r="2.6" /><circle cx="17.5" cy="5.5" r="2.6" /><circle cx="17.5" cy="18.5" r="2.6" /><path d="M8.4 10.8l6.8-4M8.4 13.2l6.8 4" /></Svg>
);

/* ─────────────────────────── primitives ─────────────────────────── */

export function Spinner({ size = 18, className = "" }: IP) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`animate-spin ${className}`} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const BTN: Record<string, string> = {
  gold: "bg-gradient-to-b from-gold to-gold2 text-[#241a05] font-extrabold shadow-[0_6px_20px_-6px_rgba(255,194,75,0.5)] hover:brightness-105",
  dark: "bg-panel2 border border-line text-ink font-bold hover:border-line2",
  ghost: "bg-transparent border border-line text-mut font-semibold hover:text-ink hover:border-line2",
  mint: "bg-mint text-[#04241a] font-extrabold shadow-[0_6px_20px_-8px_rgba(61,220,151,0.6)]",
  danger: "bg-coral/12 border border-coral/40 text-coral font-bold",
  sky: "bg-sky/12 border border-sky/40 text-sky font-bold",
};
const SZ: Record<string, string> = {
  sm: "px-3 py-1.5 text-[13px] rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-[14px] rounded-xl gap-2",
  lg: "px-5 py-3.5 text-[15px] rounded-xl gap-2",
};

export function Button({ variant = "gold", size = "md", full, loading, disabled, onClick, children, className = "" }: {
  variant?: keyof typeof BTN; size?: keyof typeof SZ; full?: boolean; loading?: boolean; disabled?: boolean;
  onClick?: () => void; children: ReactNode; className?: string;
}) {
  return (
    <button
      onClick={() => { if (!disabled && !loading) onClick?.(); }}
      className={`tap inline-flex items-center justify-center select-none transition-all duration-150 ${BTN[variant]} ${SZ[size]} ${full ? "w-full" : ""} ${(disabled || loading) ? "opacity-45 pointer-events-none" : ""} ${className}`}
    >
      {loading ? <Spinner size={16} /> : null}
      {children}
    </button>
  );
}

export const Chip = ({ tone = "dim", children, className = "" }: { tone?: "gold" | "mint" | "coral" | "sky" | "dim" | "tg"; children: ReactNode; className?: string }) => {
  const t = {
    gold: "bg-gold/12 text-gold border-gold/30",
    mint: "bg-mint/10 text-mint border-mint/30",
    coral: "bg-coral/10 text-coral border-coral/30",
    sky: "bg-sky/10 text-sky border-sky/30",
    tg: "bg-tg/12 text-tg border-tg/30",
    dim: "bg-panel2 text-mut border-line",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold ${t} ${className}`}>{children}</span>;
};

export function Pill({ status }: { status: string }) {
  const map: Record<string, { tone: "gold" | "mint" | "coral" | "sky" | "dim"; label: string }> = {
    pending: { tone: "gold", label: "Pending" }, approved: { tone: "mint", label: "Approved" },
    active: { tone: "mint", label: "Active" }, completed: { tone: "mint", label: "Completed" },
    processing: { tone: "sky", label: "Processing" }, rejected: { tone: "coral", label: "Rejected" },
    cancelled: { tone: "coral", label: "Cancelled" }, banned: { tone: "coral", label: "Banned" },
    suspended: { tone: "gold", label: "Suspended" }, paused: { tone: "dim", label: "Paused" },
    refunded: { tone: "sky", label: "Refunded" }, running: { tone: "gold", label: "Running" },
    deleted: { tone: "coral", label: "Deleted" },
  };
  const m = map[status] ?? { tone: "dim" as const, label: status };
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

export function Avatar({ name, photo, size = 40, hue }: { name: string; photo?: string | null; size?: number; hue?: number }) {
  const h = hue ?? ((name.charCodeAt(0) || 65) * 7 + (name.charCodeAt(1) || 0) * 13) % 360;
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  if (photo) return <img src={photo} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover border border-line2" />;
  return (
    <div style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(140deg, hsl(${h} 60% 42%), hsl(${(h + 50) % 360} 65% 30%))` }}
      className="rounded-full flex items-center justify-center font-extrabold text-white/90 border border-white/15 shrink-0">
      {initials}
    </div>
  );
}

export function Modal({ open, onClose, title, children, tall, center }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; tall?: boolean; center?: boolean }) {
  if (!open) return null;
  const head = (
    <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line/60">
      <div className="font-display text-[15px] font-semibold tracking-wide">{title}</div>
      <button onClick={onClose} className="tap p-2 -mr-2 rounded-lg text-mut hover:text-ink"><IcoX size={18} /></button>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] anim-fade" onClick={onClose} />
      {center ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md max-h-[86vh] overflow-hidden rounded-[22px] border border-line bg-deep shadow-[0_30px_80px_rgba(0,0,0,0.7)] anim-pop flex flex-col">
            {head}
            <div className="overflow-y-auto hide-scroll px-5 py-5">{children}</div>
          </div>
        </div>
      ) : (
        <div className={`absolute bottom-0 inset-x-0 mx-auto max-w-md ${tall ? "h-[88vh]" : "max-h-[86vh]"} overflow-hidden rounded-t-[22px] border border-line bg-deep shadow-[0_-20px_60px_rgba(0,0,0,0.6)] anim-rise flex flex-col`}>
          {head}
          <div className="overflow-y-auto hide-scroll px-5 py-4 safe-b grow">{children}</div>
        </div>
      )}
    </div>
  );
}

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="block mb-3.5">
    <div className="flex items-baseline justify-between mb-1.5">
      <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-mut">{label}</span>
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </div>
    {children}
  </label>
);

export const Seg = ({ options, value, onChange }: { options: { v: string; label: string }[]; value: string; onChange: (v: string) => void }) => (
  <div className="flex rounded-xl border border-line bg-panel p-1 gap-1">
    {options.map((o) => (
      <button key={o.v} onClick={() => onChange(o.v)}
        className={`tap flex-1 rounded-lg px-3 py-2 text-[13.5px] font-bold transition-all duration-200 ${value === o.v ? "bg-gold/15 text-gold shadow-[inset_0_0_0_1px_rgba(255,194,75,0.35)]" : "text-mut hover:text-ink"}`}>
        {o.label}
      </button>
    ))}
  </div>
);

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`tap relative w-11 h-6.5 rounded-full transition-colors duration-200 ${on ? "bg-mint" : "bg-line"}`} style={{ height: 26 }}>
      <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-[22px]" : "left-[3px]"}`} />
    </button>
  );
}

export function CopyBtn({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      ta.remove();
    }
    setOk(true);
    setTimeout(() => setOk(false), 1400);
  };
  return (
    <button onClick={copy}
      className={`tap shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-extrabold transition-all duration-200 ${ok ? "border-mint/50 bg-mint/12 text-mint" : "border-line bg-panel2/70 text-mut hover:text-gold hover:border-gold/45"} ${className}`}>
      {ok ? <IcoCheck size={13} /> : <IcoCopy size={13} />}
      {ok ? "Copied" : label}
    </button>
  );
}

export const SectionH = ({ title, right }: { title: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center justify-between mt-6 mb-3">
    <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-mut">{title}</h2>
    {right}
  </div>
);

export function Bar({ pct, tone = "gold" }: { pct: number; tone?: "gold" | "mint" | "coral" | "sky" }) {
  const c = { gold: "bg-gold", mint: "bg-mint", coral: "bg-coral", sky: "bg-sky" }[tone];
  return (
    <div className="h-1.5 w-full rounded-full bg-line/70 overflow-hidden">
      <div className={`h-full rounded-full ${c} transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function Empty({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="card flex flex-col items-center text-center py-10 px-6 anim-fade">
      <div className="w-12 h-12 rounded-full bg-panel2 border border-line flex items-center justify-center text-dim mb-3">{icon}</div>
      <div className="font-bold text-[15px]">{title}</div>
      {sub && <div className="text-[13px] text-mut mt-1 leading-relaxed">{sub}</div>}
    </div>
  );
}

/* Count-up number */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const [disp, setDisp] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    const t0 = performance.now();
    const dur = 620;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setDisp(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`tnum ${className}`}>{fmt(disp)}</span>;
}

/* Server-synced countdown ring */
export function Ring({ deadline, totalSec, size = 168, onExpire }: { deadline: string | null; totalSec: number; size?: number; onExpire?: () => void }) {
  const [, force] = useState(0);
  const fired = useRef(false);
  useEffect(() => {
    const iv = setInterval(() => force((x) => x + 1), 200);
    return () => clearInterval(iv);
  }, []);
  const total = totalSec * 1000;
  const remaining = deadline ? Math.max(0, new Date(deadline).getTime() - Date.now()) : null;
  const frac = remaining === null ? 0 : remaining / total;
  const secs = remaining === null ? null : Math.ceil(remaining / 1000);
  const R = 52, C = 2 * Math.PI * R;
  const urgent = remaining !== null && remaining <= 10_500;
  useEffect(() => {
    if (remaining === 0 && !fired.current) { fired.current = true; onExpire?.(); }
    if (remaining !== 0) fired.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);
  return (
    <div className={`relative ${urgent ? "anim-urgent" : ""}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} className="-rotate-90">
        <circle cx="60" cy="60" r={R} stroke="#1e3a56" strokeWidth="7" fill="none" />
        {remaining !== null && (
          <circle cx="60" cy="60" r={R} stroke={urgent ? "#ff6b7a" : "#ffc24b"} strokeWidth="7" fill="none"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
            style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.4s", filter: `drop-shadow(0 0 8px ${urgent ? "rgba(255,107,122,0.55)" : "rgba(255,194,75,0.4)"})` }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {secs === null ? (
          <>
            <span className="font-display text-[22px] font-bold text-mut">—</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-dim mt-1">awaiting bid</span>
          </>
        ) : (
          <>
            <span className={`font-display text-[38px] font-bold leading-none ${urgent ? "text-coral" : "text-ink"}`}>{secs}</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-mut mt-1.5">sec left</span>
          </>
        )}
      </div>
    </div>
  );
}

/* Deterministic gradient artwork for ads / campaigns */
export function AdArt({ hue, title, className = "" }: { hue: number; title: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/10 shrink-0 ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 62% 34%), hsl(${(hue + 60) % 360} 58% 20%))` }}>
      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs><pattern id={`p${hue}`} width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="white" /></pattern></defs>
        <rect width="100" height="100" fill={`url(#p${hue})`} />
        <circle cx="78" cy="24" r="26" fill="white" opacity="0.10" />
        <circle cx="18" cy="82" r="20" fill="white" opacity="0.08" />
      </svg>
      <span className="absolute bottom-1.5 left-2.5 font-display text-[26px] font-bold text-white/85 leading-none drop-shadow">
        {title.replace(/[^A-Za-z]/g, "").slice(0, 1) || "B"}
      </span>
    </div>
  );
}
