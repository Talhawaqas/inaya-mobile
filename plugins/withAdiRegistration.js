// plugins/withAdiRegistration.js
//
// Google Play package-name registration ("prove you own the signing key"): Play Console gives a one-line snippet that must sit in the APK's assets as
// assets/adi-registration.properties, in an APK signed with the key being registered. If a file named adi-registration.properties exists at the project root, this
// plugin copies it into the Android assets folder during prebuild; with no such file it does nothing, so normal builds are unaffected.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

module.exports = function withAdiRegistration(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, 'adi-registration.properties');
      if (!fs.existsSync(src)) return cfg;
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(src, path.join(dir, 'adi-registration.properties'));
      return cfg;
    },
  ]);
};
