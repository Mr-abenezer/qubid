// Adsgram SDK wrapper

declare global {
  interface Window {
    show_49922?: () => Promise<{ done: boolean }>;
  }
}

let adsgramController: any = null;
const ADSGRAM_BLOCK_ID = "49922";

export function initAdsgram(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    // Adsgram SDK creates a global function show_XXX() where XXX is the block ID
    const showFunction = (window as any)[`show_${ADSGRAM_BLOCK_ID}`];
    if (typeof showFunction === "function") {
      adsgramController = { show: showFunction };
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
  if (!adsgramController) {
    const initialized = initAdsgram();
    if (!initialized) {
      throw new Error("Adsgram not initialized");
    }
  }

  const result = await adsgramController.show();
  return result.done;
}

export function isAdsgramReady(): boolean {
  if (adsgramController) return true;
  // Try one more time to initialize
  return initAdsgram();
}
