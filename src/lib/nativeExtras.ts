import { Share } from 'react-native';
import * as StoreReview from 'expo-store-review';

/**
 * Native features the web app can ask for over postMessage. The web only uses a feature once it
 * sees it listed in `window.__tunedtvNativeCaps`, so older shells (which never inject this) keep
 * their existing web fallbacks.
 */
export const NATIVE_CAPS = ['share', 'review'] as const;

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

/** Handles a parsed web message if it's one of ours. Returns true when consumed. */
export function handleNativeExtrasMessage(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;
  const m = message as { type?: unknown; url?: unknown };
  if (m.type === 'tunedtv:share') {
    if (isTunedTvUrl(m.url)) void nativeShare(message as ShareMessage);
    return true;
  }
  if (m.type === 'tunedtv:review:request') {
    void requestReview();
    return true;
  }
  return false;
}

export type { ReviewMessage, ShareMessage };
