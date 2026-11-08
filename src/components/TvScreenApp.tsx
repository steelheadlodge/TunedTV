import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const ORIGIN = 'https://tunedtv.com';
const RETRY_MS = 10_000;

/** The link code from tunedtv://tv-screen?s=… or https://tunedtv.com/tv-screen?s=… (the phone). */
function codeFrom(url: string | null): string | null {
  return url?.match(/[?&]s=([0-9a-f]{24})(?![0-9a-f])/)?.[1] ?? null;
}

const pageUrl = (code: string | null) => `${ORIGIN}/tv-screen${code ? `?s=${code}` : ''}`;

/**
 * On a TV (Android TV / Google TV) the app is the TV page: the phone browses, this shows it.
 * Without a code the page says to tap Browse on TV on the phone, which then opens it here.
 */
export function TvScreenApp() {
  const [uri, setUri] = useState<string | null>(null);
  // Bumped to reload after a dead renderer or a failed load: there's no Retry to tap with a remote.
  const [load, setLoad] = useState(0);
  // The page lets the TV sleep after 45 min without the phone (tv-screen.tsx).
  const [awake, setAwake] = useState(true);

  useEffect(() => {
    let live = true;
    void Linking.getInitialURL().then((u) => live && setUri(pageUrl(codeFrom(u))));
    const sub = Linking.addEventListener('url', ({ url }) => {
      const code = codeFrom(url);
      if (code) setUri(pageUrl(code));
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!awake) return;
    void activateKeepAwakeAsync('tv-page').catch(() => {});
    return () => void deactivateKeepAwake('tv-page');
  }, [awake]);

  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => {
      setFailed(false);
      setLoad((n) => n + 1);
    }, RETRY_MS);
    return () => clearTimeout(t);
  }, [failed]);

  if (!uri) return <View style={styles.bg} />;
  return (
    <WebView
      key={load}
      source={{ uri }}
      style={styles.bg}
      applicationNameForUserAgent="TunedTV-AndroidTV/1.0"
      mediaPlaybackRequiresUserAction={false}
      setSupportMultipleWindows={false}
      onRenderProcessGone={() => setLoad((n) => n + 1)}
      onError={() => setFailed(true)}
      onHttpError={(e) => e.nativeEvent.statusCode >= 500 && setFailed(true)}
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data);
          if (m?.type === 'tunedtv:tv:awake') setAwake(Boolean(m.on));
        } catch {
          // not ours
        }
      }}
      onShouldStartLoadWithRequest={(r) => r.isTopFrame === false || r.url.startsWith(ORIGIN)}
    />
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#07080c' },
});
