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

/**
 * Register the device for push and return an Expo push token. Returns null on
 * simulators, when permission is denied, or on any error — push must NEVER block
 * or crash app startup, so everything here is best-effort and swallowed.
 */
export async function registerForPushTokenAsync(): Promise<PushRegistration | null> {
  try {
    // Physical device required: simulators/emulators are not issued push tokens.
    if (!Device.isDevice) {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Match reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      // @ts-expect-error easConfig is present in EAS builds
      Constants?.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResponse?.data;
    if (!token) {
      return null;
    }

    return { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
  } catch {
    return null;
  }
}

/**
 * Hand the push token to the web app (Lovable) so it can associate the token with
 * the signed-in Supabase user and upsert it into the `push_tokens` table. The web
 * app should listen for the `tunedtv:push:token` event and also read the global
 * `window.__tunedtvPushToken` (in case the event fired before its listener attached).
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
