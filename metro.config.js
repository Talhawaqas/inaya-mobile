// metro.config.js
// Metro cannot resolve Node.js built-in modules that @metamask/connect-multichain
// depends on — this maps them to React Native-compatible shims or an empty stub.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const emptyModule = path.resolve(__dirname, 'src/empty-module.js');

// @inaya-network/custody-sdk is linked in via a local "file:" dependency
// (sibling repo, not published to npm) — Metro doesn't follow symlinks or
// watch outside the project root by default, so both need enabling.
const custodySdkPath = path.resolve(__dirname, '../inaya-network-dapp/custody-sdk');
config.resolver.unstable_enableSymlinks = true;
config.watchFolders = [...(config.watchFolders || []), custodySdkPath];

config.resolver.extraNodeModules = {
  stream: require.resolve('readable-stream'),
  crypto: emptyModule,
  http: emptyModule,
  https: emptyModule,
  net: emptyModule,
  tls: emptyModule,
  zlib: emptyModule,
  os: emptyModule,
  dns: emptyModule,
  assert: emptyModule,
  url: emptyModule,
  path: emptyModule,
  fs: emptyModule,
};

module.exports = config;