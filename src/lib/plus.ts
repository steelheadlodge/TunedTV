import { Platform } from 'react-native';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

/**
 * TunedTV Plus through RevenueCat (App Store / Google Play subscriptions). The page asks with
 * `tunedtv:plus:status|buy|restore`; every answer is a `tunedtv:plus` event with the state, or with
 * `cancelled` / `error` and no state change. Public SDK keys only (appl_… / goog_…); with no key the
 * `iap` cap stays off and the page never offers a purchase.
 */
const API_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const ENTITLEMENT = 'plus';

export const PLUS_AVAILABLE = !!API_KEY;

let configured = false;
function ensureConfigured(): boolean {
  if (!configured && API_KEY) {
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
  }
  return configured;
}

type PlusDetail = {
  active: boolean;
  plan?: 'monthly' | 'annual';
  expiresAt?: number | null;
  trial?: boolean;
  cancelled?: boolean;
  error?: string;
  restored?: boolean;
};

function stateOf(info: CustomerInfo): PlusDetail {
  const e = info.entitlements.active[ENTITLEMENT];
  if (!e) return { active: false };
  return {
    active: true,
    plan: /annual|year/i.test(e.productIdentifier) ? 'annual' : 'monthly',
    expiresAt: e.expirationDate ? Date.parse(e.expirationDate) : null,
    trial: e.periodType === 'TRIAL',
  };
}

const eventScript = (d: PlusDetail) =>
  `window.dispatchEvent(new CustomEvent('tunedtv:plus', { detail: ${JSON.stringify(d)} })); true;`;

async function answer(m: { type: string; product?: unknown }): Promise<PlusDetail> {
  if (m.type === 'tunedtv:plus:status') return stateOf(await Purchases.getCustomerInfo());
  if (m.type === 'tunedtv:plus:restore') return { ...stateOf(await Purchases.restorePurchases()), restored: true };
  if (typeof m.product !== 'string') return { active: false, error: 'no product' };
  const [product] = await Purchases.getProducts([m.product]);
  if (!product) return { active: false, error: "the plan isn't available in this store yet" };
  const { customerInfo } = await Purchases.purchaseStoreProduct(product);
  return stateOf(customerInfo);
}

/** Handles the page's Plus messages; false for anything else. */
export function handlePlusMessage(message: unknown, inject: (script: string) => void): boolean {
  const m = message as { type?: unknown; product?: unknown } | null;
  if (!m || typeof m.type !== 'string' || !m.type.startsWith('tunedtv:plus:')) return false;
  if (!ensureConfigured()) return true;
  answer(m as { type: string; product?: unknown })
    .then((d) => inject(eventScript(d)))
    .catch((e: { userCancelled?: boolean; message?: string }) =>
      inject(eventScript(e?.userCancelled ? { active: false, cancelled: true } : { active: false, error: e?.message ?? 'unknown error' })),
    );
  return true;
}
