/**
 * Control Center / Lock Screen / Action button controls (iOS 18+): "Ask TunedTV" and "TV Remote".
 * Both just open a tunedtv:// link that the shell forwards to the web app (src/app/index.tsx).
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'widget',
  name: 'TunedTVControls',
  displayName: 'TunedTV',
  bundleIdentifier: '.controls',
  deploymentTarget: '18.0',
  colors: {
    $accent: '#3b82f6',
    $widgetBackground: '#1d2025',
  },
});
