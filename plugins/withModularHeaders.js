const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Google Sign-In's Firebase deps (AppCheckCore → GoogleUtilities, RecaptchaInterop) are Swift
// pods that don't define modules, so the default static build fails `pod install` without
// modular headers. We add `use_modular_headers!` right after `use_expo_modules!`. The ios/
// dir is gitignored and EAS regenerates the Podfile on every build via prebuild, so this must
// be applied as a config plugin rather than a manual Podfile edit (which would be lost).
const MODULAR_HEADERS = 'use_modular_headers!';
const ANCHOR = 'use_expo_modules!';

function patchPodfile(projectRoot) {
  const podfilePath = path.join(projectRoot, 'ios', 'Podfile');
  if (!fs.existsSync(podfilePath)) {
    return;
  }

  let contents = fs.readFileSync(podfilePath, 'utf8');
  if (contents.includes(MODULAR_HEADERS)) {
    return;
  }
  if (!contents.includes(ANCHOR)) {
    return;
  }

  contents = contents.replace(ANCHOR, `${ANCHOR}\n  ${MODULAR_HEADERS}`);
  fs.writeFileSync(podfilePath, contents);
}

function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      patchPodfile(config.modRequest.projectRoot);
      return config;
    },
  ]);
}

module.exports = withModularHeaders;
