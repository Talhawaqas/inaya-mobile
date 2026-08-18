// plugins/withGradleJvmArgs.js
//
// Raises the Gradle daemon's JVM heap/metaspace for Android release builds.
// `android/` is regenerated fresh by `expo prebuild` on every CI run (see
// .github/workflows/build-apk.yml) and is gitignored, so a manual edit to
// android/gradle.properties would just get wiped -- this config plugin
// re-applies the override every time prebuild runs, via
// @expo/config-plugins' withGradleProperties mod.
//
// Root cause it fixes: AGP's default -XX:MaxMetaspaceSize=512m was enough
// until expo-updates added its own Gradle/Kotlin plugin + lint model on top
// of an already-large app (WalletConnect, Reanimated, Worklets, 20+
// modules) -- CI then failed with
// ":expo-constants:lintVitalAnalyzeRelease"/":expo:lintVitalAnalyzeRelease"
// both dying from JVM Metaspace exhaustion (confirmed from the actual
// Gradle daemon warning in the CI log, not guessed).

const { withGradleProperties } = require("@expo/config-plugins");

const JVM_ARGS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError";

module.exports = function withGradleJvmArgs(config) {
  return withGradleProperties(config, (config) => {
    const existing = config.modResults.find((item) => item.type === "property" && item.key === "org.gradle.jvmargs");
    if (existing) {
      existing.value = JVM_ARGS;
    } else {
      config.modResults.push({ type: "property", key: "org.gradle.jvmargs", value: JVM_ARGS });
    }
    return config;
  });
};
