// Monetag rewarded interstitial integration
// The show_11853266() function is provided by Monetag's SDK

declare global {
  interface Window {
    show_11853266?: () => Promise<void>;
  }
}

export async function showMonetagAd(): Promise<void> {
  if (!window.show_11853266) {
    throw new Error('Monetag SDK not loaded');
  }
  
  try {
    await window.show_11853266();
    // Promise resolved = user watched the ad to completion
  } catch (error) {
    // Promise rejected = user skipped or error occurred
    throw error;
  }
}

export function isMonetagReady(): boolean {
  return typeof window.show_11853266 === 'function';
}
