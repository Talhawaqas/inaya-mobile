// src/utils/appLockSuspend.js
//
// A brief, deliberate hand-off to a system UI — Chrome Custom Tabs /
// ASWebAuthenticationSession for Google sign-in, currently the only case —
// triggers the exact same AppState background->foreground transition that
// "the user actually left the app" would. Left unhandled, that makes
// App.js's AppLockGate re-lock the whole app mid-flow: it unmounts
// everything (including the screen waiting on the OAuth result and its
// in-progress state) and only remounts from scratch on the drawer's
// default screen once re-unlocked — dropping the user back on Home,
// having forgotten they were signing in.
//
// A flow like that calls suspendAppLock() right before opening the system
// browser and resumeAppLock() once it's actually done with the result, so
// AppLockGate's re-lock check can skip itself for that window. The bounded
// auto-resume is a safety net: an abandoned/failed flow that never calls
// resumeAppLock() itself shouldn't leave the app permanently unlockable.

let suspended = false;
let safetyTimer = null;

const MAX_SUSPEND_MS = 2 * 60 * 1000;

export function suspendAppLock() {
  suspended = true;
  if (safetyTimer) clearTimeout(safetyTimer);
  safetyTimer = setTimeout(resumeAppLock, MAX_SUSPEND_MS);
}

export function resumeAppLock() {
  suspended = false;
  if (safetyTimer) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
}

export function isAppLockSuspended() {
  return suspended;
}
