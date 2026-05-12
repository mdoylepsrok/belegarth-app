import { useState, useEffect } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import { useInstallPrompt } from '../lib/pwa';

const DISMISS_KEY = 'thepark_install_dismissed_v1';
const DISMISS_DAYS = 14;

export default function InstallPrompt() {
  const { canInstall, install, isIOS, alreadyInstalled } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  // Honor prior dismissal for DISMISS_DAYS days
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = JSON.parse(raw);
        if (Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
          setDismissed(true);
        }
      }
    } catch {}
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(Date.now())); } catch {}
    setDismissed(true);
    setShowIosHelp(false);
  }

  if (alreadyInstalled || dismissed) return null;
  // Show iOS help banner OR Chrome install banner. Skip both if neither applies.
  if (!canInstall && !isIOS) return null;

  if (showIosHelp) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 pointer-events-none">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-grass-200 p-4 pointer-events-auto">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-display text-lg">Install on iPhone</h3>
            <button onClick={() => setShowIosHelp(false)} className="p-1 hover:bg-cream-100 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-2 items-center">
              <span className="font-display bg-grass-100 text-grass-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">1</span>
              <span>Tap the <Share className="w-4 h-4 inline text-sky-600" /> <strong>Share</strong> button in Safari</span>
            </li>
            <li className="flex gap-2 items-center">
              <span className="font-display bg-grass-100 text-grass-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">2</span>
              <span>Scroll down, tap <strong>Add to Home Screen</strong> <Plus className="w-4 h-4 inline" /></span>
            </li>
            <li className="flex gap-2 items-center">
              <span className="font-display bg-grass-100 text-grass-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">3</span>
              <span>Tap <strong>Add</strong></span>
            </li>
          </ol>
          <p className="text-xs text-ink-700/50 mt-3">
            The app will appear on your home screen and open fullscreen, no browser bar.
          </p>
          <button onClick={dismiss} className="text-xs text-ink-700/50 hover:text-ink-900 underline mt-3">
            Don't show this again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 pointer-events-none">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-grass-200 p-3 flex items-center gap-3 pointer-events-auto">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-grass-500 to-grass-700 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-cream-50" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Install The Park</div>
          <div className="text-xs text-ink-700/60">Get it as an app — opens fullscreen, faster to load.</div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {isIOS ? (
            <button onClick={() => setShowIosHelp(true)} className="btn-primary text-sm">
              How
            </button>
          ) : (
            <button onClick={install} className="btn-primary text-sm">
              Install
            </button>
          )}
          <button onClick={dismiss} className="p-2 hover:bg-cream-100 rounded text-ink-700/50">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
