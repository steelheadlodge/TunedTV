import { WebView } from 'react-native-webview';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import { configureNativeAuth, signInNatively } from '@/lib/nativeAuth';
import {
  buildAuthCancelledScript,
  buildSignInWithIdTokenScript,
  IOS_WEBVIEW_INJECT,
  parseWebAuthRequest,
  parseWebAuthResult,
} from '@/lib/nativeAuthBridge';
import {
  buildDeepLinkScript,
  buildPushTokenBridgeScript,
  extractDeepLink,
  getPushTokenIfGranted,
  requestPushToken,
  type DeepLinkNav,
  type PushRegistration,
} from '@/lib/pushNotifications';
import { handleNativeExtrasMessage, NATIVE_CAPS_SCRIPT } from '@/lib/nativeExtras';
import { handleNetMessage, resetNet } from '@/lib/netBridge';

WebBrowser.maybeCompleteAuthSession();

// Dev builds can load a local copy of the web app (EXPO_PUBLIC_WEB_ORIGIN=http://localhost:5199).
const DEV_WEB_ORIGIN = __DEV__ ? process.env.EXPO_PUBLIC_WEB_ORIGIN : undefined;
const APP_WEB_ORIGIN = DEV_WEB_ORIGIN || 'https://tunedtv.com';
const APP_OAUTH_REDIRECT = 'tunedtv://auth/callback';
const SUPABASE_REDIRECT = 'https://tunedtv.com/~oauth/callback';
/** Max wait for web bridge after native Apple/Google returns a token. */
const AUTH_BRIDGE_TIMEOUT_MS = 20_000;
/** Max wait for the full native sign-in flow (Face ID, account picker, etc.). */
const AUTH_FLOW_TIMEOUT_MS = 120_000;

// The published edge serves index.html as `no-cache` WITHOUT ETag/Last-Modified, which lets
// iOS WKWebView reuse a stale document from NSURLCache that points at JS chunk hashes a later
// deploy has already purged → ChunkLoadError → crash. A unique `?v` per load is a guaranteed
// NSURLCache miss, forcing a fresh document fetch, while hashed `/assets/*` stay cached. Cookies
// and localStorage are keyed by origin (not URL) so sign-in and prefs are untouched. Only the
// root document is cache-busted — never auth/OAuth callback URLs.
function buildFreshRootUrl() {
  const devPath = DEV_WEB_ORIGIN ? process.env.EXPO_PUBLIC_WEB_START_PATH : undefined;
  if (devPath) return `${APP_WEB_ORIGIN}${devPath}${devPath.includes('?') ? '&' : '?'}v=${Date.now()}`;
  return `${APP_WEB_ORIGIN}/?v=${Date.now()}`;
}

function isSupabaseOAuthStart(url: string) {
  return url.includes('supabase.co/auth/v1/authorize');
}

function isLovableOAuthUrl(url: string) {
  return url.includes('oauth.lovable.app');
}

function isSocialOAuthUrl(url: string) {
  return (
    isSupabaseOAuthStart(url) ||
    isLovableOAuthUrl(url) ||
    url.includes('accounts.google.com') ||
    url.includes('appleid.apple.com')
  );
}

function isOAuthCallback(url: string) {
  return (
    url.includes('tunedtv.com') &&
    (url.includes('code=') || url.includes('access_token=') || url.includes('error='))
  );
}

function isAllowedInWebView(url: string) {
  if (DEV_WEB_ORIGIN && url.startsWith(DEV_WEB_ORIGIN)) return true;
  return url.includes('tunedtv.com') && !isOAuthCallback(url);
}

function getSocialProviderFromUrl(url: string): 'apple' | 'google' | null {
  try {
    const provider = new URL(url).searchParams.get('provider');
    if (provider === 'apple' || provider === 'google') {
      return provider;
    }
  } catch {
    // ignore
  }
  if (url.includes('appleid.apple.com') || url.includes('provider=apple')) {
    return 'apple';
  }
  if (url.includes('accounts.google.com') || url.includes('provider=google')) {
    return 'google';
  }
  return null;
}

function authTailFromNativeUrl(nativeUrl: string) {
  const marker = 'auth/callback';
  const idx = nativeUrl.indexOf(marker);
  if (idx !== -1) {
    return nativeUrl.slice(idx + marker.length);
  }
  const hashIndex = nativeUrl.indexOf('#');
  if (hashIndex !== -1) {
    return nativeUrl.slice(hashIndex);
  }
  const queryIndex = nativeUrl.indexOf('?');
  if (queryIndex !== -1) {
    return nativeUrl.slice(queryIndex);
  }
  return '';
}

function toWebCallbackUrl(nativeUrl: string) {
  return `${SUPABASE_REDIRECT}${authTailFromNativeUrl(nativeUrl)}`;
}

function parseAuthParams(url: string) {
  const tail = authTailFromNativeUrl(url);
  const paramString = tail.startsWith('#')
    ? tail.slice(1)
    : tail.startsWith('?')
      ? tail.slice(1)
      : tail;
  return Object.fromEntries(new URLSearchParams(paramString));
}

function buildSetSessionScript(params: Record<string, string>, resultUrl: string) {
  if (!params.access_token) {
    return null;
  }
  const session = {
    access_token: params.access_token,
    refresh_token: params.refresh_token ?? '',
  };
  const fallback = toWebCallbackUrl(resultUrl);
  return `
    (function () {
      var session = ${JSON.stringify(session)};
      var fallback = ${JSON.stringify(fallback)};
      var attempts = 0;
      function done() { window.location.replace('https://tunedtv.com/'); }
      function tryBridge() {
        var bridge = window.__tunedtvNativeAuth;
        if (bridge && bridge.setSession) {
          bridge.setSession(session).then(done).catch(done);
          return;
        }
        if (attempts++ < 30) { setTimeout(tryBridge, 100); return; }
        window.location.replace(fallback);
      }
      tryBridge();
    })();
    true;
  `;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const nativeAuthInProgress = useRef(false);
  const pendingNativeProvider = useRef<'apple' | 'google' | null>(null);
  const pendingAuthSuccess = useRef(false);
  const authBridgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authFlowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // iOS jettisons the WKWebView content process under memory pressure (even after a SHORT
  // background, not just overnight), leaving a blank/white page with no JS alive to recover.
  // Track that so we can reload on the next foreground if it happened while backgrounded.
  const contentProcessGone = useRef(false);
  // Timestamp of when we last went to the background, so we can force a reload on resume
  // after a long background as a backstop in case the terminate handler didn't fire.
  const backgroundedAt = useRef<number | null>(null);
  // Heartbeat: on resume we ping the web context; if no 'pong' comes back, the WKWebView
  // content process died silently (no terminate callback) and we reload to avoid a white screen.
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Expo push token, once the device is registered. Handed to the web app so it can store
  // the token against the signed-in Supabase user for match-reminder pushes.
  const pushRegRef = useRef<PushRegistration | null>(null);
  // Deep-link target from a tapped notification, held until the web app is ready to receive it
  // (cold start taps arrive before onLoad). Flushed in onLoad, then cleared.
  const pendingDeepLinkRef = useRef<DeepLinkNav | null>(null);
  // Whether the web document has finished loading — gates whether we inject a deep link now or
  // queue it for the next onLoad. Reset on reload so a tap mid-reload still lands.
  const webLoadedRef = useRef(false);
  // Mirrors the WebView's history so Android's back gesture/button steps back a page instead of
  // closing the app; only exits once there's nothing left to go back to.
  const canGoBackRef = useRef(false);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Opaque cover shown only during intentional reloadWebView() calls (resume/stale recovery),
  // NOT on the initial cold-start load — hiding the web skeleton behind a native spinner was
  // worse UX and masked the real double-reload bug (heartbeat firing before first onLoad).
  const [webLoading, setWebLoading] = useState(false);
  const webLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cache-busted on first mount so each cold start fetches a fresh index.html (see
  // buildFreshRootUrl) — this is the core defense against the stale-WebView ChunkLoadError trap.
  const [webUri, setWebUri] = useState(buildFreshRootUrl);

  // Backstop reload after a long background. Lowered from 30m: iOS can silently jettison the
  // content process well before then; the resume heartbeat below is the primary detector.
  const STALE_BACKGROUND_MS = 10 * 60 * 1000;
  // No response to the resume ping within this window ⇒ assume a dead/blank web view, reload.
  const HEARTBEAT_TIMEOUT_MS = 2500;

  const reloadWebView = useCallback(() => {
    contentProcessGone.current = false;
    webLoadedRef.current = false;
    setLoadFailed(false);
    setWebLoading(true);
    // Navigate to a freshly cache-busted root rather than webViewRef.reload(): a plain reload
    // re-requests the SAME URL and can be served the stale document again from NSURLCache (e.g.
    // on resume after a deploy shipped while backgrounded). A new `?v` guarantees a fresh fetch.
    setWebUri(buildFreshRootUrl());
  }, []);

  const checkWebViewAlive = useCallback(() => {
    // iOS-only: detect a silently-killed WKWebView content process. Inject a ping; if no 'pong'
    // message arrives shortly, JS isn't running (blank page), so we hard-reload. The pong is
    // cleared in onMessage. A false positive on a slow device just triggers a cache-busted reload.
    if (Platform.OS !== 'ios') {
      return;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    heartbeatTimeoutRef.current = setTimeout(() => {
      heartbeatTimeoutRef.current = null;
      reloadWebView();
    }, HEARTBEAT_TIMEOUT_MS);
    webViewRef.current?.injectJavaScript(
      "(function(){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('tunedtv:pong');}catch(e){}})();true;",
    );
  }, [reloadWebView]);

  const nudgeWebViewLayout = useCallback(() => {
    // iOS WKWebView can hand back a stale (too-tall) layout viewport on resume after a long
    // background, with no 'resize' event — so position:fixed; bottom:0 elements (the bottom nav)
    // anchor below the visible area and appear to float mid-screen. Dispatching a synthetic
    // resize forces the page to recompute against the real viewport (and triggers the web-side
    // visibility/resize listeners). Fired twice to catch the WKWebView settling after resume.
    if (Platform.OS !== 'ios') {
      return;
    }
    webViewRef.current?.injectJavaScript(
      "(function(){try{window.dispatchEvent(new Event('resize'));if(window.visualViewport){try{window.visualViewport.dispatchEvent(new Event('resize'));}catch(e){}}}catch(e){}})();true;",
    );
  }, []);

  const clearAuthTimeouts = useCallback(() => {
    if (authBridgeTimeoutRef.current) {
      clearTimeout(authBridgeTimeoutRef.current);
      authBridgeTimeoutRef.current = null;
    }
    if (authFlowTimeoutRef.current) {
      clearTimeout(authFlowTimeoutRef.current);
      authFlowTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    configureNativeAuth();
  }, []);

  // On launch, silently fetch the push token ONLY if permission was already granted (no cold
  // prompt) and hand it to the web app so a previously opted-in user re-registers. The first-time
  // permission prompt is triggered later by the worldCupPushOptIn toggle (see handlePushEnable).
  const handlePushRegistration = useCallback((reg: PushRegistration | null) => {
    if (!reg) {
      return;
    }
    pushRegRef.current = reg;
    webViewRef.current?.injectJavaScript(buildPushTokenBridgeScript(reg));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPushTokenIfGranted().then((reg) => {
      if (cancelled) {
        return;
      }
      handlePushRegistration(reg);
    });
    return () => {
      cancelled = true;
    };
  }, [handlePushRegistration]);

  // Web fires this when the user turns the match-reminder opt-in ON — prompt for permission at
  // that moment (protects the one-shot iOS prompt), then hand the token back to the web bridge.
  const handlePushEnable = useCallback(() => {
    requestPushToken().then(handlePushRegistration);
  }, [handlePushRegistration]);

  // Send a notification deep-link to the web app if it's loaded; otherwise queue it for onLoad.
  const routeDeepLink = useCallback((nav: DeepLinkNav | null) => {
    if (!nav) {
      return;
    }
    if (webLoadedRef.current) {
      webViewRef.current?.injectJavaScript(buildDeepLinkScript(nav));
    } else {
      pendingDeepLinkRef.current = nav;
    }
  }, []);

  // Notification deep-linking: tapping a match reminder should open the relevant page, not just
  // the app. Handle both the cold start (app launched by the tap) and warm taps (app already
  // running/backgrounded). The cold-start path guards against a stale last-response.
  useEffect(() => {
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled) {
        return;
      }
      routeDeepLink(extractDeepLink(response, { checkRecency: true }));
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeDeepLink(extractDeepLink(response));
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [routeDeepLink]);

  // Recover from a terminated WebView content process: if iOS killed it while we were
  // backgrounded, reload as soon as the app returns to the foreground so the user never
  // lands on a white screen on reopen.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const wasBackgrounded = backgroundedAt.current != null;
        const wasStale =
          wasBackgrounded &&
          Date.now() - (backgroundedAt.current ?? 0) > STALE_BACKGROUND_MS;
        if (contentProcessGone.current || wasStale) {
          reloadWebView();
        } else if (wasBackgrounded) {
          // Only ping on resume from background — never on cold start. iOS fires 'active' on
          // launch too; pinging before the first onLoad always timed out and forced a reload
          // ~2.5s in (banner flash → black spinner → reload → content).
          checkWebViewAlive();
        }
        // Force a relayout shortly after resume to fix a stale WKWebView viewport (floating
        // bottom nav). Two passes catch the view settling; harmless if a reload is in flight.
        setTimeout(nudgeWebViewLayout, 300);
        setTimeout(nudgeWebViewLayout, 900);
        backgroundedAt.current = null;
      } else if (state === 'background' || state === 'inactive') {
        if (heartbeatTimeoutRef.current) {
          // Don't let a pending heartbeat fire a reload while we're heading to the background.
          clearTimeout(heartbeatTimeoutRef.current);
          heartbeatTimeoutRef.current = null;
        }
        if (backgroundedAt.current == null) {
          backgroundedAt.current = Date.now();
        }
      }
    });
    return () => {
      subscription.remove();
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
    };
  }, [reloadWebView, checkWebViewAlive, nudgeWebViewLayout]);

  const stopWebViewOAuth = useCallback(() => {
    webViewRef.current?.stopLoading();
  }, []);

  const completeOAuthInWebView = useCallback((resultUrl: string) => {
    const params = parseAuthParams(resultUrl);
    const sessionScript = buildSetSessionScript(params, resultUrl);
    if (sessionScript) {
      webViewRef.current?.injectJavaScript(sessionScript);
      return;
    }
    setWebUri(toWebCallbackUrl(resultUrl));
  }, []);

  const finishNativeAuth = useCallback(
    (error?: string) => {
      clearAuthTimeouts();
      nativeAuthInProgress.current = false;
      pendingNativeProvider.current = null;
      pendingAuthSuccess.current = false;
      setAuthInProgress(false);
      if (error) {
        Alert.alert('Sign in failed', error);
      }
    },
    [clearAuthTimeouts]
  );

  const scheduleBridgeTimeout = useCallback(() => {
    if (authBridgeTimeoutRef.current) {
      clearTimeout(authBridgeTimeoutRef.current);
    }
    authBridgeTimeoutRef.current = setTimeout(() => {
      authBridgeTimeoutRef.current = null;
      if (!nativeAuthInProgress.current) {
        return;
      }
      finishNativeAuth(
        'Sign-in timed out waiting for the app to finish. Close the app and try again.'
      );
      webViewRef.current?.injectJavaScript(
        buildAuthCancelledScript('Sign-in timed out. Please try again.')
      );
    }, AUTH_BRIDGE_TIMEOUT_MS);
  }, [finishNativeAuth]);

  const completeNativeAuthInWebView = useCallback(
    (result: NonNullable<Awaited<ReturnType<typeof signInNatively>>>) => {
      pendingAuthSuccess.current = true;
      webViewRef.current?.injectJavaScript(buildSignInWithIdTokenScript(result));
      scheduleBridgeTimeout();
    },
    [scheduleBridgeTimeout]
  );

  const handleNativeAuthRequest = useCallback(
    async (provider: 'google' | 'apple') => {
      if (nativeAuthInProgress.current) {
        return;
      }
      nativeAuthInProgress.current = true;
      pendingNativeProvider.current = provider;
      setAuthInProgress(true);
      stopWebViewOAuth();

      if (authFlowTimeoutRef.current) {
        clearTimeout(authFlowTimeoutRef.current);
      }
      authFlowTimeoutRef.current = setTimeout(() => {
        authFlowTimeoutRef.current = null;
        if (!nativeAuthInProgress.current) {
          return;
        }
        finishNativeAuth('Sign-in timed out. Please try again.');
        webViewRef.current?.injectJavaScript(buildAuthCancelledScript('Sign-in timed out'));
      }, AUTH_FLOW_TIMEOUT_MS);

      try {
        const result = await signInNatively(provider);
        if (result) {
          completeNativeAuthInWebView(result);
          return;
        }
        finishNativeAuth();
        webViewRef.current?.injectJavaScript(buildAuthCancelledScript());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Native sign-in failed';
        finishNativeAuth(message);
        webViewRef.current?.injectJavaScript(buildAuthCancelledScript(message));
      }
    },
    [completeNativeAuthInWebView, finishNativeAuth, stopWebViewOAuth]
  );

  const interceptIosSocialOAuth = useCallback(
    (url: string) => {
      if (Platform.OS !== 'ios' || !isSocialOAuthUrl(url)) {
        return false;
      }
      stopWebViewOAuth();
      const provider = getSocialProviderFromUrl(url) ?? pendingNativeProvider.current;
      if (provider && !nativeAuthInProgress.current) {
        handleNativeAuthRequest(provider);
      }
      return true;
    },
    [handleNativeAuthRequest, stopWebViewOAuth]
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith(APP_OAUTH_REDIRECT)) {
        completeOAuthInWebView(url);
      }
    });
    return () => subscription.remove();
  }, [completeOAuthInWebView]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBackRef.current) {
        return false;
      }
      webViewRef.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Backstop: if onLoad/onError never fire (rare hung load), force the loading cover off after
  // a few seconds so the app can never be left stuck behind the overlay.
  useEffect(() => {
    if (!webLoading) {
      return;
    }
    const id = setTimeout(() => setWebLoading(false), 12000);
    webLoadingTimeoutRef.current = id;
    return () => {
      clearTimeout(id);
      webLoadingTimeoutRef.current = null;
    };
  }, [webLoading]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <WebView
        ref={webViewRef}
        userAgent={Platform.OS === 'ios' ? 'TunedTV-iOS/1.0' : 'TunedTV-Android/1.0'}
        source={{ uri: webUri }}
        style={styles.webview}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        scalesPageToFit={false}
        injectedJavaScriptBeforeContentLoaded={Platform.OS === 'ios' ? IOS_WEBVIEW_INJECT : undefined}
        onContentProcessDidTerminate={() => {
          // WKWebView content process was killed (iOS, typically memory pressure).
          // Reload now if we're in the foreground; otherwise flag it for the next resume.
          if (AppState.currentState === 'active') {
            reloadWebView();
          } else {
            contentProcessGone.current = true;
          }
        }}
        onRenderProcessGone={() => {
          // Android equivalent: the render process was reclaimed; reload to recover.
          reloadWebView();
        }}
        onError={(event) => {
          // Top-frame load failure — surface a retry instead of a bare white screen.
          // Ignore subframe errors so an ad/analytics failure doesn't blank the app.
          if (event.nativeEvent.url?.includes('tunedtv.com') ?? true) {
            setLoadFailed(true);
            // Drop the loading cover so the retry overlay (errorOverlay) is the thing shown.
            setWebLoading(false);
          }
        }}
        onLoadStart={() => resetNet()}
        onLoad={() => {
          setLoadFailed(false);
          webLoadedRef.current = true;
          // Document finished — drop the cover and let the (instant-painted) page show through.
          setWebLoading(false);
          webViewRef.current?.injectJavaScript(NATIVE_CAPS_SCRIPT);
          // Re-hand the push token after each (re)load so it survives reloads/navigation and
          // the case where the token arrived before the page was ready.
          if (pushRegRef.current) {
            webViewRef.current?.injectJavaScript(buildPushTokenBridgeScript(pushRegRef.current));
          }
          // Flush a deep link queued before the page was ready (cold-start notification tap).
          if (pendingDeepLinkRef.current) {
            webViewRef.current?.injectJavaScript(buildDeepLinkScript(pendingDeepLinkRef.current));
            pendingDeepLinkRef.current = null;
          }
        }}
        onMessage={(event) => {
          const raw = event.nativeEvent.data;
          if (raw === 'tunedtv:pong') {
            // Heartbeat reply: web context is alive, cancel the pending reload.
            if (heartbeatTimeoutRef.current) {
              clearTimeout(heartbeatTimeoutRef.current);
              heartbeatTimeoutRef.current = null;
            }
            return;
          }
          // Web asked us to enable push (user turned the match-reminder opt-in on). Handle on
          // both platforms, before the iOS-only auth handling below.
          try {
            const message = JSON.parse(raw);
            if (message && message.type === 'tunedtv:push:enable') {
              handlePushEnable();
              return;
            }
            const inject = (js: string) => webViewRef.current?.injectJavaScript(js);
            if (handleNetMessage(message, event.nativeEvent.url, inject, DEV_WEB_ORIGIN)) {
              return;
            }
            if (handleNativeExtrasMessage(message, inject)) {
              return;
            }
          } catch {
            // not JSON — fall through to the auth handlers
          }
          if (Platform.OS !== 'ios') {
            return;
          }
          const authResult = parseWebAuthResult(raw);
          if (authResult) {
            if (authResult.ok) {
              finishNativeAuth();
              return;
            }
            finishNativeAuth(authResult.error ?? 'Sign-in failed');
            return;
          }
          const request = parseWebAuthRequest(raw);
          if (request) {
            pendingNativeProvider.current = request.provider;
            handleNativeAuthRequest(request.provider);
          }
        }}
        onNavigationStateChange={(navState) => {
          const { url } = navState;
          canGoBackRef.current = navState.canGoBack;
          if (
            nativeAuthInProgress.current &&
            url.includes('tunedtv.com') &&
            !url.includes('/login')
          ) {
            finishNativeAuth();
          } else if (pendingAuthSuccess.current && !url.includes('/login')) {
            finishNativeAuth();
          }
          if (isOAuthCallback(url)) {
            completeOAuthInWebView(url);
            return;
          }
          if (Platform.OS === 'ios') {
            interceptIosSocialOAuth(url);
          }
        }}
        onShouldStartLoadWithRequest={(request) => {
          const { url } = request;
          if (Platform.OS === 'ios' && isSocialOAuthUrl(url)) {
            interceptIosSocialOAuth(url);
            return false;
          }
          if (request.isTopFrame === false) {
            return true;
          }
          if (isAllowedInWebView(url) || isOAuthCallback(url)) {
            return true;
          }
          if (Platform.OS === 'ios' && interceptIosSocialOAuth(url)) {
            return false;
          }
          if (url.startsWith('http')) {
            Linking.openURL(url);
          }
          return false;
        }}
      />
      {webLoading && !loadFailed && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      {authInProgress && (
        <View style={styles.authOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      {loadFailed && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Couldn’t load TunedTV</Text>
          <Text style={styles.errorBody}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={reloadWebView}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    // Dark background matching the web app's theme bg (#1d2025). Without this the
    // WKWebView paints its default WHITE while tunedtv.com is still loading on a
    // cold start, producing a jarring white flash between the black splash and
    // the dark content. Setting it dark makes the load read as black → dark →
    // content with no flash.
    backgroundColor: '#1d2025',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
