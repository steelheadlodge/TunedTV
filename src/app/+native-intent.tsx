// Incoming links are for the web app, not for native routes. "Ask TunedTV" and remote links
// (tunedtv://assistant, tunedtv://remote, https://tunedtv.com/assistant) stay on the WebView
// screen, which reads the URL itself (src/app/index.tsx) and forwards it to the web app. On a TV,
// tunedtv://tv-screen?s=… from the phone is read the same way (src/components/TvScreenApp.tsx).
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return /(^|\/)(assistant|remote|tv-screen)(\/|\?|$)/i.test(path) ? '/' : path;
}
