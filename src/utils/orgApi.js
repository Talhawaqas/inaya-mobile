// src/utils/orgApi.js
//
// Shared client for the Business Workspace backend (inaya-network-dapp's
// /api/orgs/* routes — Phase 1-3 Company/Department/Project/Document system).
//
// SESSION HANDLING IS THE ONE REAL DIFFERENCE FROM THE WEB APP: the web
// Business Workspace relies entirely on an HttpOnly `inaya_org_session`
// cookie, set by a redirect from GET /api/orgs/login/consume when the
// magic-link URL is opened directly in a browser. On mobile, tapping that
// same emailed link opens the device's SYSTEM browser, not this app — so
// any cookie it receives is trapped in a cookie jar this app's fetch calls
// never see. There's also no App Links/Universal Links setup in this repo
// to make the link open the app directly instead.
//
// So mobile does it differently: the user copies the emailed link (or just
// the token) into the app, which POSTs it to /api/orgs/login/consume-token
// (a mobile-specific route added alongside the existing browser-redirect
// one — see inaya-network-dapp/src/app/api/orgs/login/consume-token/route.js)
// and gets the raw session token back in the JSON body. That token is sent
// as `Authorization: Bearer <token>` on every request — the backend's
// getRawSessionToken() (lib/orgs.js) accepts either that header or the
// cookie, so every other route needed zero changes to support both clients.
//
// Stored via expo-secure-store (OS keychain/Keystore-backed) on iOS/
// Android, not AsyncStorage — this is what makes the biometric app-unlock
// gate (BusinessWorkspaceStack.js) actually mean something: a Face ID/
// fingerprint prompt in front of a plaintext AsyncStorage string would be
// UI theater, not real protection. A session token easily fits under
// SecureStore's ~2KB item limit (it's a 64-char hex string).
//
// expo-secure-store has NO web implementation — it rejects on web rather
// than no-op'ing, so this app's occasional Expo-web-preview testing needs
// an explicit fallback to AsyncStorage there. This doesn't weaken native
// security at all (real devices never touch this branch); the web target
// has no OS keychain equivalent to protect anyway.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const API_BASE = 'https://www.inayanetwork.com';
const SESSION_TOKEN_KEY = 'inaya_org_session_token';

export async function getStoredSessionToken() {
  if (Platform.OS === 'web') return AsyncStorage.getItem(SESSION_TOKEN_KEY);
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function setStoredSessionToken(token) {
  if (Platform.OS === 'web') {
    if (token) await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
    else await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}

/**
 * fetch() wrapper for every /api/orgs/* call: attaches the stored bearer
 * token (if any) and JSON headers, parses the JSON body, and throws with the
 * server's own error message on a non-2xx response so callers can just
 * try/catch instead of checking res.ok everywhere.
 */
export async function orgFetch(path, { method = 'GET', body } = {}) {
  const token = await getStoredSessionToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // No/invalid JSON body — fall through, res.ok check below still applies.
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (HTTP ${res.status}).`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}
