// Adsgram SDK wrapper
// Docs: https://docs.adsgram.ai/publisher/reward-interstitial-integration

declare global {
  interface Window {
    Adsgram?: {
      init: (config: { blockId: string; debug?: boolean }) => AdController;
    };
  }
}

interface ShowPromiseResult {
  done: boolean;
  description: string;
  state: "load" | "render" | "playing" | "destroy";
  error: boolean;
}

interface AdController {
  show: () => Promise<ShowPromiseResult>;
}

let adController: AdController | null = null;
const ADSGRAM_BLOCK_ID = "49922";

export function initAdsgram(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (window.Adsgram && typeof window.Adsgram.init === "function") {
      adController = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
      return true;
    }
    return false;
  } catch (e) {
    console.error("Adsgram init failed:", e);
    return false;
  }
}

export async function showAdsgramAd(): Promise<boolean> {
  // Try to initialize if not already done
  if (!adController) {
    const initialized = initAdsgram();
    if (!initialized) {
      throw new Error("Adsgram not initialized");
    }
  }

  const result = await adController!.show();
  return result.done;
}

export function isAdsgramReady(): boolean {
  if (adController) return true;
  // Check if the SDK script has loaded
  return !!(window.Adsgram && typeof window.Adsgram.init === "function");
}
