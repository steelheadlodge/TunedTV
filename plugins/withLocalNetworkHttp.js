const { withAndroidManifest } = require('expo/config-plugins');

/**
 * DIRECTV receivers and Rokus only speak plain http on the home network, which Android blocks
 * by default. Android's network security config can't scope this to private IP ranges, so it is
 * enabled app-wide; the shell only sends commands to private addresses (src/lib/tvControl.ts).
 */
module.exports = function withLocalNetworkHttp(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });
};
