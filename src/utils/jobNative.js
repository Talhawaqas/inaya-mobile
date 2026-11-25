// src/utils/jobNative.js -- camera, QR scanning and location for the technician job screens (Manage Orders SOW §10).
//
// These native modules ship in the 1.3 app build. An over-the-air update can reach an OLDER build that doesn't contain
// them, so every one is checked with requireOptionalNativeModule before its JavaScript is loaded: on an older build the
// screens fall back (photo from files instead of the camera, a typed site code instead of scanning, no location) and
// never crash. Location is read once, at the moment a job is started or finished, never in the background.
//
// The camera, gallery, file picker and Android permission dialogs are separate system screens: opening one sends the
// app to the background, which would trigger the biometric app lock (App.js AppLockGate) and unmount the job screen.
// Each call is wrapped in suspendAppLock()/resumeAppLock() exactly like Google sign-in and wallet hand-offs
// (src/utils/appLockSuspend.js); the resume is delayed briefly so the "back to foreground" event lands while suspended.
import { requireOptionalNativeModule } from 'expo';
import { suspendAppLock, resumeAppLock } from './appLockSuspend';

const has = (name) => { try { return !!requireOptionalNativeModule(name); } catch { return false; } };
export const nativeCaps = () => ({ camera: has('ExponentImagePicker'), scanner: has('ExpoCamera'), location: has('ExpoLocation') });

/** Runs a system-UI hand-off with the app lock paused; resumes ~1.5 s after it returns (or fails). */
export async function withSystemUi(fn) {
  suspendAppLock();
  try { return await fn(); }
  finally { setTimeout(resumeAppLock, 1500); }
}

/** A job photo: the camera when available, otherwise a picked image/PDF file. Returns { uri, name, mimeType } or null. */
export async function takeJobPhoto({ fromLibrary = false } = {}) {
  return withSystemUi(async () => {
    if (has('ExponentImagePicker')) {
      const IP = require('expo-image-picker');
      const perm = fromLibrary ? await IP.requestMediaLibraryPermissionsAsync() : await IP.requestCameraPermissionsAsync();
      if (!perm.granted) throw new Error(fromLibrary ? 'Photo access was not allowed.' : 'Camera access was not allowed. You can still attach a photo from your files.');
      const r = fromLibrary ? await IP.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.4, exif: false }) : await IP.launchCameraAsync({ mediaTypes: ['images'], quality: 0.4, exif: false });
      if (r.canceled || !r.assets?.length) return null;
      const a = r.assets[0];
      return { uri: a.uri, name: a.fileName || `job-photo-${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize || null };
    }
    const DP = require('expo-document-picker');
    const r = await DP.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.length) return null;
    const a = r.assets[0];
    return { uri: a.uri, name: a.name || `job-file-${Date.now()}`, mimeType: a.mimeType || 'application/octet-stream', size: a.size || null };
  });
}

/** One-time location fix (only when the company switched location capture on). Null when unavailable or refused. */
export async function currentLocationOnce() {
  if (!has('ExpoLocation')) return null;
  try {
    const L = require('expo-location');
    const p = await withSystemUi(() => L.requestForegroundPermissionsAsync()); if (!p.granted) return null;
    const pos = await L.getCurrentPositionAsync({ accuracy: L.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy || 0) };
  } catch { return null; }
}

/** The camera scanner component, or null on builds without it (the screen then shows a text box). */
export function scannerComponent() {
  if (!has('ExpoCamera')) return null;
  try { return require('expo-camera'); } catch { return null; }
}
