// ─── AdsGram rewarded ads ───────────────────────────────────────────────────
// SDK (sad.min.js) is loaded in index.html. Docs:
// https://docs.adsgram.ai/publisher/reward-interstitial-integration
// The promise resolves ONLY when the user watched the ad to the end — that is
// the single moment the server-side reward is allowed to fire.

export interface AdsgramShowResult {
  done: boolean;
  error: boolean;
  state: string; // 'load' | 'render' | 'playing' | 'destroy'
  description?: string;
}

interface AdsgramController {
  show(): Promise<AdsgramShowResult>;
  preload?(): void;
  destroy?(): void;
}

declare global {
  interface Window {
    Adsgram?: { init(cfg: { blockId: string }): AdsgramController };
  }
}

// Env var wins; the fallback keeps the integration alive without extra setup.
const env = ((import.meta as unknown as { env?: Record<string, string> }).env ?? {});
const BLOCK_ID: string = env.VITE_ADSGRAM_BLOCK_ID ?? "43828";

let controller: AdsgramController | null = null;

export function adsgramReady(): boolean {
  return typeof window !== "undefined" && Boolean(window.Adsgram) && BLOCK_ID.length > 0;
}

function getController(): AdsgramController | null {
  if (controller) return controller;
  if (!window.Adsgram) return null;
  controller = window.Adsgram.init({ blockId: BLOCK_ID });
  return controller;
}

/**
 * Show a rewarded ad. Resolves when watched to the end; rejects with the
 * AdsGram result when the user skips early or the ad fails.
 */
export function showAd(): Promise<AdsgramShowResult> {
  return new Promise((resolve, reject) => {
    const attempt = (n: number) => {
      const c = getController();
      if (!c) {
        // SDK script may still be loading on slow connections
        if (n < 6) { setTimeout(() => attempt(n + 1), 400); return; }
        reject({ done: false, error: true, state: "load", description: "AdsGram SDK unavailable" });
        return;
      }
      c.show().then(resolve).catch(reject);
    };
    attempt(0);
  });
}
