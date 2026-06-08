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
