import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Browser } from '@capacitor/browser';

if (Capacitor.getPlatform() === 'ios') {
  const modes = new Set(['landscape', 'portrait', 'auto']);
  const read = () => {
    try { const value = localStorage.getItem('thornhaven_orientation'); return modes.has(value) ? value : 'landscape'; }
    catch { return 'landscape'; }
  };
  const apply = mode => mode === 'auto' ? ScreenOrientation.unlock() : ScreenOrientation.lock({ orientation: mode });
  const report = message => { if (document.readyState !== 'loading') window.alert(message); };
  window.ThornhavenDevice = {
    getOrientationPreference: read,
    setOrientationPreference(mode) {
      if (!modes.has(mode)) return;
      try { localStorage.setItem('thornhaven_orientation', mode); } catch {}
      apply(mode).catch(() => report('Unable to change screen orientation. Try rotating your device.'));
    },
    openForumShop() {
      Browser.open({ url: 'https://thornhaven-community.blushbeech32.chatgpt.site/shop' })
        .catch(() => report('Unable to open the forum shop. Please try again.'));
    }
  };
  document.addEventListener('DOMContentLoaded', () => { apply(read()).catch(() => {}); }, { once: true });
}
