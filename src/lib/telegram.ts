// Thin wrapper around the Telegram WebApp SDK.
// The Mini App is only functional inside Telegram; identity always comes
// from the signed initData payload and is re-validated server-side.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Telegram?: { WebApp?: any };
  }
}

export const tg = (): any =>
  typeof window !== "undefined" ? window.Telegram?.WebApp ?? null : null;

export const isTelegram = (): boolean => {
  const w = tg();
  return !!(w && w.initData && w.initDataUnsafe?.user);
};

export const tgUser = (): any => tg()?.initDataUnsafe?.user ?? null;

export const initData = (): string => tg()?.initData ?? "";

export function bootTelegram() {
  try {
    const w = tg();
    if (!w) return;
    w.ready();
    w.expand();
    w.setHeaderColor?.("#07111d");
    w.setBackgroundColor?.("#07111d");
    w.disableVerticalSwipes?.();
  } catch {
    /* non-fatal */
  }
}

export function haptic(kind: "light" | "medium" | "heavy" | "success" | "error" = "light") {
  try {
    const w = tg();
    const hf = w?.HapticFeedback;
    if (!hf) return;
    if (kind === "success" || kind === "error") hf.notificationOccurred(kind);
    else hf.impactOccurred(kind);
  } catch {
    /* non-fatal */
  }
}

export function openLink(url: string) {
  try {
    const w = tg();
    if (w?.openLink) w.openLink(url, { try_instant_view: false });
    else window.open(url, "_blank", "noopener");
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
