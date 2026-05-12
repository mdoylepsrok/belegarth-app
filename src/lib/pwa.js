/**
 * PWA helpers — registers the service worker and tracks the "Add to Home Screen" prompt.
 *
 * Usage in App:
 *   import { registerServiceWorker, useInstallPrompt } from './lib/pwa';
 *   useEffect(() => { registerServiceWorker(); }, []);
 *   const { canInstall, install } = useInstallPrompt();
 */

import { useState, useEffect } from 'react';

let deferredPrompt = null;

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return; // skip in dev mode to avoid caching headaches

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => {
        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available; skip waiting so user gets it on next nav
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => console.warn('Service worker registration failed:', err));
  });

  // Capture the beforeinstallprompt event (Chrome/Android only)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new Event('thepark-installable'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event('thepark-installed'));
  });
}

/**
 * Hook for components: returns { canInstall, install, isIOS, alreadyInstalled }
 */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [installed, setInstalled] = useState(false);
  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !window.MSStream;
  const alreadyInstalled = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
     window.navigator.standalone === true);

  useEffect(() => {
    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => { setCanInstall(false); setInstalled(true); };
    window.addEventListener('thepark-installable', onInstallable);
    window.addEventListener('thepark-installed', onInstalled);
    return () => {
      window.removeEventListener('thepark-installable', onInstallable);
      window.removeEventListener('thepark-installed', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    return outcome === 'accepted';
  }

  return { canInstall, install, isIOS, alreadyInstalled, installed };
}
