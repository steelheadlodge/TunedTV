const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withMainActivity } = require('expo/config-plugins');

/**
 * The same app on Android TV / Google TV boxes (Verizon Fios, DIRECTV Gemini, Chromecast with
 * Google TV, Sony/TCL/Hisense sets), where it opens TunedTV's TV page full screen.
 *
 * Play only offers an app on TVs when nothing it declares needs hardware a TV lacks: the mic
 * (voice ask), a touchscreen, and portrait (implied by app.json's portrait lock). The lock stays
 * on phones from MainActivity instead.
 */
const OPTIONAL = [
  'android.software.leanback',
  'android.hardware.touchscreen',
  'android.hardware.faketouch',
  'android.hardware.microphone',
  'android.hardware.screen.portrait',
  'android.hardware.wifi',
];

const name = (n) => ({ $: { 'android:name': n } });

function withTvManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = (manifest['uses-feature'] ?? []).filter((f) => !OPTIONAL.includes(f.$['android:name']));
    for (const n of OPTIONAL) manifest['uses-feature'].push({ $: { 'android:name': n, 'android:required': 'false' } });

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:banner'] = '@drawable/tv_banner';

    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity.$['android:screenOrientation'] = 'unspecified';
    const filters = activity['intent-filter'] ?? (activity['intent-filter'] = []);
    const launcher = filters.find((f) => f.action?.some((a) => a.$['android:name'] === 'android.intent.action.MAIN'));
    if (launcher && !launcher.category.some((c) => c.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'))
      launcher.category.push(name('android.intent.category.LEANBACK_LAUNCHER'));
    // The phone opens the TV page in this app with tunedtv://tv-screen?s=… (app.json's scheme);
    // Verizon's box only passes web links into apps, so the page's own URL opens it too.
    if (!filters.some((f) => f.data?.some((d) => d.$['android:pathPrefix'] === '/tv-screen')))
      filters.push({
        action: [name('android.intent.action.VIEW')],
        category: [name('android.intent.category.DEFAULT'), name('android.intent.category.BROWSABLE')],
        data: [{ $: { 'android:scheme': 'https', 'android:host': 'tunedtv.com', 'android:pathPrefix': '/tv-screen' } }],
      });
    return cfg;
  });
}

function withPhonePortrait(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('FEATURE_LEANBACK')) return cfg;
    if (cfg.modResults.language !== 'kt') throw new Error('withAndroidTv: MainActivity is not Kotlin');
    src = src.replace(/^package .*$/m, (p) => `${p}\n\nimport android.content.pm.ActivityInfo\nimport android.content.pm.PackageManager`);
    src = src.replace(
      /super\.onCreate\(([^)]*)\)/,
      (call) =>
        `${call}\n    if (!packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)) {\n      requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT\n    }`,
    );
    if (!src.includes('FEATURE_LEANBACK')) throw new Error('withAndroidTv: no super.onCreate in MainActivity');
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withBanner(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/drawable-xhdpi');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(cfg.modRequest.projectRoot, 'assets/tv/tv-banner.png'), path.join(dir, 'tv_banner.png'));
      return cfg;
    },
  ]);
}

module.exports = function withAndroidTv(config) {
  return withBanner(withPhonePortrait(withTvManifest(config)));
};
