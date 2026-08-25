// src/utils/passkeyStorage.js
//
// User-Controlled Master Node Passkey Backup & Recovery — the OS-keychain
// half of it (SOW section 1, "Local Secure Storage: Android → Android
// Keystore-backed secure storage, protected by biometric/PIN where
// available"). The actual backup-file encryption/decryption is
// custody-sdk's createPasskeyBackup()/restorePasskeyBackup()
// (@inaya-network/custody-sdk) — this file only stores/retrieves the
// plaintext passkey locally so the user doesn't have to re-type it every
// session, exactly the same split of responsibility as inaya-desktop's
// Tauri keyring commands.
//
// Same expo-secure-store + Platform.OS==='web' AsyncStorage-fallback
// pattern as orgApi.js's session token (SecureStore has no web
// implementation, and this app's occasional Expo-web-preview testing
// needs somewhere to write that isn't a hard crash). Reading the stored
// passkey back out is gated behind biometric.js's promptBiometricUnlock()
// — writing isn't, mirroring that file's own documented principle: "the
// thing actually being protected is [the secret], which already lives in
// the OS keychain," biometrics just gate app-level access to it.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { isBiometricAvailable, promptBiometricUnlock } from './biometric';

const PASSKEY_KEY = 'inaya_master_node_passkey';

async function readRaw() {
  if (Platform.OS === 'web') return AsyncStorage.getItem(PASSKEY_KEY);
  return SecureStore.getItemAsync(PASSKEY_KEY);
}

/** Writes (or clears, with a falsy value) the passkey to OS-backed secure
 *  storage. No biometric gate on writes — see this file's header comment
 *  for why. */
export async function setStoredPasskey(passkey) {
  if (Platform.OS === 'web') {
    if (passkey) await AsyncStorage.setItem(PASSKEY_KEY, passkey);
    else await AsyncStorage.removeItem(PASSKEY_KEY);
    return;
  }
  if (passkey) await SecureStore.setItemAsync(PASSKEY_KEY, passkey);
  else await SecureStore.deleteItemAsync(PASSKEY_KEY);
}

/** True if a passkey is currently stored, without needing biometric
 *  unlock or returning the value itself — safe to call for UI state
 *  (e.g. "show Clear button" vs "show Store button") without prompting. */
export async function hasStoredPasskey() {
  return !!(await readRaw());
}

/** Removes any stored passkey. No biometric gate — clearing a secret is
 *  never the sensitive direction. */
export async function clearStoredPasskey() {
  await setStoredPasskey(null);
}

/**
 * Reads the stored passkey back out, gated behind Face ID/fingerprint (or
 * device passcode fallback) when biometric hardware is available and
 * enrolled — same isBiometricAvailable()/promptBiometricUnlock() calls
 * SettingsScreen's existing biometric toggle already uses. Falls straight
 * through with no prompt when biometrics aren't available on this device,
 * consistent with promptBiometricUnlock() never being the only gate on
 * anything (the OS keychain itself is the real protection).
 *
 * Returns null if nothing is stored, or if the biometric prompt is
 * cancelled/fails — never throws.
 */
export async function getStoredPasskey() {
  const stored = await readRaw();
  if (!stored) return null;

  if (await isBiometricAvailable()) {
    const unlocked = await promptBiometricUnlock();
    if (!unlocked) return null;
  }

  return stored;
}
