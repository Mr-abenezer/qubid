// Adsgram SDK wrapper
// Placeholder - will be configured with actual block ID later

declare global {
  interface Window {
    Adsgram?: {
      init: (config: { blockId: string }) => {
        show: () => Promise<{ done: boolean }>;
      };
    };
    show_PLACEHOLDER?: () => Promise<{ done: boolean }>;
  }
}

let adsgramController: any = null;
const ADSGRAM_BLOCK_ID = "49922";

export function initAdsgram() {
  if (typeof window === "undefined") return false;
  
  try {
    // Adsgram SDK creates a global function show_XXX() where XXX is the block ID
    const showFunction = (window as any)[`show_${ADSGRAM_BLOCK_ID}`];
    if (showFunction) {
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
  if (!adsgramController) {
    throw new Error("Adsgram not initialized");
  }

  const result = await adsgramController.show();
  return result.done;
}

export function isAdsgramReady(): boolean {
  return adsgramController !== null;
}
