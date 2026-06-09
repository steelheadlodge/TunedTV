import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Show match-reminder alerts even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushRegistration = { token: string; platform: 'ios' | 'android' };

async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Match reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

async function fetchToken(): Promise<PushRegistration | null> {
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    // @ts-expect-error easConfig is present in EAS builds
    Constants?.easConfig?.projectId;
  const res = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = res?.data;
  if (!token) {
    return null;
  }
  return { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
}

/**
 * Return a push token ONLY if permission is already granted — never prompts. Call on launch
 * so a previously opted-in user silently re-registers their token, without nagging everyone
 * else with a cold permission prompt. Returns null on simulators / when not granted / on error.
 */
export async function getPushTokenIfGranted(): Promise<PushRegistration | null> {
  try {
    if (!Device.isDevice) {
      return null;
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    await ensureAndroidChannel();
    return await fetchToken();
  } catch {
    return null;
  }
}

/**
 * Prompt for notification permission (the one-shot iOS prompt) and return a token if granted.
 * Call this ONLY in response to a user action — the worldCupPushOptIn toggle — never cold on
 * launch, so we don't burn the single permission prompt. Returns null if denied / on error.
 */
export async function requestPushToken(): Promise<PushRegistration | null> {
  try {
    if (!Device.isDevice) {
      return null;
    }
    await ensureAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      return null;
    }
    return await fetchToken();
  } catch {
    return null;
  }
}

/**
 * Hand the push token to the web app (Lovable's PushTokenBridge) so it can POST it to the
 * existing /api/public/hooks/register-push-token endpoint against the signed-in Supabase user.
 * Sets a global (read on load) and dispatches an event (for an already-attached listener).
 */
export function buildPushTokenBridgeScript(reg: PushRegistration): string {
  const payload = JSON.stringify(reg);
  return `
    (function () {
      try {
        var reg = ${payload};
        window.__tunedtvPushToken = reg;
        window.dispatchEvent(new CustomEvent('tunedtv:push:token', { detail: reg }));
      } catch (e) {}
    })();
    true;
  `;
}

/**
 * Deep-link target carried in a notification's `data` payload (set by the Lovable sender).
 * `path` is the canonical route the web app should navigate to (e.g. "/worldcup"); the rest
 * are passed through for context. The native shell is route-agnostic — it just forwards this.
 */
export type DeepLinkNav = {
  path?: string;
  matchId?: string;
  league?: string;
  alertType?: string;
  [key: string]: unknown;
};

// A cold-start response from getLastNotificationResponseAsync can be STALE (it returns the last
// response the user interacted with, even on a normal icon launch). Match reminders are
// time-bound, so only honor a cold-start deep link delivered within this window; older = ignore,
// to avoid yanking the user to a finished game when they just tapped the app icon. Warm taps
// (via the response listener) bypass this — those are unambiguous, fresh interactions.
const COLD_START_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/**
 * Pull a deep-link target out of a notification response, or null if there isn't one / it's a
 * non-tap action / (when checkRecency) it's a stale cold-start response. Date units are
 * normalized since expo can report seconds or ms depending on platform/version.
 */
export function extractDeepLink(
  response: Notifications.NotificationResponse | null | undefined,
  opts?: { checkRecency?: boolean }
): DeepLinkNav | null {
  if (!response) {
    return null;
  }
  // Only a plain tap on the notification (not a custom action button) should navigate.
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return null;
  }
  const data = response.notification?.request?.content?.data as DeepLinkNav | undefined;
  if (!data || (!data.path && !data.matchId)) {
    return null;
  }
  if (opts?.checkRecency) {
    const delivered = response.notification?.date;
    if (typeof delivered === 'number') {
      const deliveredMs = delivered < 1e12 ? delivered * 1000 : delivered;
      if (Date.now() - deliveredMs > COLD_START_MAX_AGE_MS) {
        return null;
      }
    }
  }
  return data;
}

/**
 * Tell the web app to navigate to the deep-link target. Sets a global (read on mount for the
 * cold-start case where the page isn't ready yet) and dispatches an event (for the warm case
 * where a listener is already attached). The web side (Lovable) routes via the SPA router.
 */
export function buildDeepLinkScript(nav: DeepLinkNav): string {
  const payload = JSON.stringify(nav);
  return `
    (function () {
      try {
        var nav = ${payload};
        window.__tunedtvPendingNavigation = nav;
        window.dispatchEvent(new CustomEvent('tunedtv:navigate', { detail: nav }));
      } catch (e) {}
    })();
    true;
  `;
}
