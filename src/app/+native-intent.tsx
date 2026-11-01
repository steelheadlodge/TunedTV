// Incoming links are for the web app, not for native routes. "Ask TunedTV" links
// (tunedtv://assistant, https://tunedtv.com/assistant) stay on the WebView screen, which reads the
// URL itself (src/app/index.tsx) and forwards it to the web /assistant page.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return /(^|\/)assistant(\/|\?|$)/i.test(path) ? '/' : path;
}
