import { Linking, Platform, Share } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { handleTvRequest, type TvRequest, type TvResult } from '@/lib/tvControl';

/**
 * Native features the web app can ask for over postMessage. The web only uses a feature once it
 * sees it listed in `window.__tunedtvNativeCaps`, so older shells (which never inject this) keep
 * their existing web fallbacks.
 */
export const NATIVE_CAPS = ['share', 'review', 'openApp', 'tv'] as const;

export const NATIVE_CAPS_SCRIPT = `
  (function () {
    try {
      window.__tunedtvNativeCaps = ${JSON.stringify(NATIVE_CAPS)};
      window.dispatchEvent(new CustomEvent('tunedtv:native-caps'));
    } catch (e) {}
  })();
  true;
`;

type ShareMessage = { type: 'tunedtv:share'; title?: string; text?: string; url: string };
type ReviewMessage = { type: 'tunedtv:review:request' };

function isTunedTvUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'tunedtv.com' || u.hostname === 'www.tunedtv.com');
  } catch {
    return false;
  }
}

async function nativeShare(msg: ShareMessage): Promise<void> {
  const text = typeof msg.text === 'string' ? msg.text.slice(0, 300) : '';
  try {
    // iOS shows `url` as a rich link; Android only reads `message`, so the link goes in there too.
    await Share.share(
      { title: msg.title?.slice(0, 120), message: text ? `${text} ${msg.url}` : msg.url, url: msg.url },
      { subject: msg.title?.slice(0, 120) },
    );
  } catch {
    // User dismissed or the sheet failed — nothing to recover.
  }
}

// Apple/Google already rate-limit the prompt (3 per year on iOS); this only stops one session from
// spending more than a single request.
let reviewRequested = false;

async function requestReview(): Promise<void> {
  if (reviewRequested) return;
  reviewRequested = true;
  try {
    if ((await StoreReview.isAvailableAsync()) && (await StoreReview.hasAction())) {
      await StoreReview.requestReview();
    }
  } catch {
    // Never surface review-prompt failures to the user.
  }
}

type OpenAppMessage = {
  type: 'tunedtv:openApp';
  iosSchemes?: unknown;
  appStoreId?: unknown;
  androidPackage?: unknown;
  url?: unknown;
};

const SCHEME_RE = /^[a-z][a-z0-9+.-]{1,30}:\/\/$/i;
const PACKAGE_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens another app for the web's "Open Fios TV" / "Watch in ESPN app" buttons. A web address is
 * used as-is (the web only sends ones the app claims, so iOS/Android open the app). Otherwise:
 * iOS tries each custom scheme (not published by the apps, so several candidates) and falls back
 * to the App Store page, which shows "Open" when installed; Android goes through the Play Store's
 * launch handler, which opens an installed app by package name or shows its store page.
 */
async function openApp(msg: OpenAppMessage): Promise<void> {
  if (typeof msg.url === 'string' && msg.url.startsWith('https://')) {
    await tryOpen(msg.url);
    return;
  }
  if (Platform.OS === 'ios') {
    const schemes = Array.isArray(msg.iosSchemes) ? msg.iosSchemes.slice(0, 4) : [];
    for (const s of schemes) {
      if (typeof s === 'string' && SCHEME_RE.test(s) && (await tryOpen(s))) return;
    }
    if (typeof msg.appStoreId === 'string' && /^\d{5,12}$/.test(msg.appStoreId)) {
      await tryOpen(`itms-apps://apps.apple.com/app/id${msg.appStoreId}`);
    }
    return;
  }
  const pkg = typeof msg.androidPackage === 'string' && PACKAGE_RE.test(msg.androidPackage) ? msg.androidPackage : null;
  if (!pkg) return;
  if (await tryOpen(`market://launch?id=${pkg}`)) return;
  await tryOpen(`https://play.google.com/store/apps/details?id=${pkg}`);
}

/** Answers a web request by firing `tunedtv:tv-reply` with the request's id. */
function tvReplyScript(id: string, result: TvResult): string {
  const detail = JSON.stringify({ id, ...result });
  return `(function(){try{window.dispatchEvent(new CustomEvent('tunedtv:tv-reply',{detail:${detail}}));}catch(e){}})();true;`;
}

/**
 * Handles a parsed web message if it's one of ours. Returns true when consumed. `inject` runs a
 * script in the page, for messages that answer back.
 */
export function handleNativeExtrasMessage(message: unknown, inject?: (script: string) => void): boolean {
  if (!message || typeof message !== 'object') return false;
  const m = message as { type?: unknown; url?: unknown; id?: unknown };
  if (m.type === 'tunedtv:tv') {
    const id = typeof m.id === 'string' && /^[\w-]{1,40}$/.test(m.id) ? m.id : null;
    if (id && inject) {
      void handleTvRequest(message as TvRequest)
        .catch((): TvResult => ({ ok: false, error: 'unreachable' }))
        .then((result) => inject(tvReplyScript(id, result)));
    }
    return true;
  }
  if (m.type === 'tunedtv:share') {
    if (isTunedTvUrl(m.url)) void nativeShare(message as ShareMessage);
    return true;
  }
  if (m.type === 'tunedtv:review:request') {
    void requestReview();
    return true;
  }
  if (m.type === 'tunedtv:openApp') {
    void openApp(message as OpenAppMessage);
    return true;
  }
  return false;
}

export type { ReviewMessage, ShareMessage };
