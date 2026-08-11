// src/utils/biometric.js
//
// Shared helpers for the Business Workspace biometric app-unlock feature —
// a LOCAL device gate on top of an already-established session (the
// SecureStore-held Bearer token in orgApi.js), not a replacement for
// signing in. There's no registered credential to check biometrics
// against otherwise, so this is the only design that makes sense here.
//
// The enabled/disabled preference is a plain non-sensitive flag (fine in
// AsyncStorage) — the thing actually being protected is the session token,
// which already lives in the OS keychain via expo-secure-store.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const BIOMETRIC_ENABLED_KEY = 'inaya_biometric_enabled';

/** Hardware present AND at least one biometric enrolled — never show/apply
 *  the gate to a user who has no Face ID/fingerprint set up on their device.
 *  Wrapped defensively: an unsupported platform (e.g. Expo web preview,
 *  which this app does get tested through occasionally) should just mean
 *  "no biometrics available," not an unhandled rejection that leaves the
 *  workspace stuck on its loading state — same failure shape the
 *  SecureStore web gap had in orgApi.js. */
export async function isBiometricAvailable() {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function getBiometricEnabled() {
  return (await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)) === "true";
}

export async function setBiometricEnabled(enabled) {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
}

/** Returns true on success, false on cancel/failure — never throws, so
 *  callers can treat any non-true result as "stay locked". */
export async function promptBiometricUnlock() {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Business Workspace",
      disableDeviceFallback: false, // allow device passcode as a fallback — standard practice
    });
    return !!result.success;
  } catch {
    return false;
  }
}
