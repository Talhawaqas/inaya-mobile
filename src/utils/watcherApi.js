// src/utils/watcherApi.js
//
// Thin client for the testnet-only Watcher Pioneer Program backend
// (inaya-network-dapp's /api/watcher/*). Same plain-fetch-to-API_BASE
// convention ReferralScreen.js uses (not Business Workspace's Bearer-token
// orgFetch — wrong auth paradigm here, this program is wallet-signed, not
// session-cookie-based).
//
// Every mutating call is signed with the connected wallet via personal_sign
// — WalletProvider.js's own signUp() discards its signature (a local-only
// proof-of-ownership flow) and isn't reusable for this; these helpers call
// invokeMethod directly and capture the result.
//
// buildWatcherMessage's exact string format MUST stay in lockstep with
// inaya-network-dapp/src/lib/watcherPioneer.js's own buildWatcherMessage —
// any drift breaks every signed request.

import { ethers } from 'ethers';

const API_BASE = 'https://www.inayanetwork.com';

export function buildWatcherMessage({ action, extra, timestamp }) {
  const lines = ['Inaya Watcher Pioneer Action', `action: ${action}`];
  if (extra) for (const [key, value] of Object.entries(extra)) lines.push(`${key}: ${String(value)}`);
  lines.push(`timestamp: ${timestamp}`);
  return lines.join('\n');
}

async function signWatcherAction(invokeMethod, address, { action, extra }) {
  const timestamp = Date.now();
  const message = buildWatcherMessage({ action, extra, timestamp });
  const signature = await invokeMethod({
    method: 'personal_sign',
    params: [ethers.hexlify(ethers.toUtf8Bytes(message)), address],
  });
  return { message, signature, timestamp };
}

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`);
    err.activeSession = data.activeSession;
    throw err;
  }
  return data;
}

export async function enrollPioneer(invokeMethod, address, { followedX, joinedTelegram }) {
  const { message, signature, timestamp } = await signWatcherAction(invokeMethod, address, {
    action: 'enroll',
    extra: { followedX, joinedTelegram },
  });
  return postJson('/api/watcher/enroll', { walletAddress: address, followedX, joinedTelegram, message, signature, timestamp });
}

export async function qualifyViaUpload(invokeMethod, address, txHash) {
  const { message, signature, timestamp } = await signWatcherAction(invokeMethod, address, {
    action: 'qualify_upload',
    extra: { qualifyingRef: txHash },
  });
  return postJson('/api/watcher/qualify', { walletAddress: address, method: 'upload', qualifyingRef: txHash, message, signature, timestamp });
}

export async function qualifyViaSocial(invokeMethod, address) {
  const { message, signature, timestamp } = await signWatcherAction(invokeMethod, address, {
    action: 'qualify_social',
    extra: { qualifyingRef: '' },
  });
  return postJson('/api/watcher/qualify', { walletAddress: address, method: 'social', qualifyingRef: null, message, signature, timestamp });
}

export async function getPioneerStatus(address) {
  const res = await fetch(`${API_BASE}/api/watcher/status?walletAddress=${encodeURIComponent(address)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

// ---------------------------------------------------------------------------------------------------------------------
// Social login (Google). Same program, same server, same points: a participant can use a wallet OR a Google account (and link the two).
// These are separate functions; nothing above this line changed, so wallet participants and older app builds behave exactly as before.
// Google's ID token authenticates each request (it lasts about an hour); a 401 means "sign in again" and is marked with err.status.
// ---------------------------------------------------------------------------------------------------------------------

async function socialRequest(path, { method = 'GET', idToken, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(method === 'GET' ? { Authorization: `Bearer ${idToken}` } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify({ provider: 'google', idToken, ...body }) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(res.status === 401 ? 'Your Google sign-in expired. Please sign in again.' : data.error || `Request failed (${res.status}).`);
    err.status = res.status;
    err.activeSession = data.activeSession;
    throw err;
  }
  return data;
}

export const enrollPioneerSocial = (idToken, { followedX, joinedTelegram }) => socialRequest('/api/watcher/enroll', { method: 'POST', idToken, body: { followedX, joinedTelegram } });
export const qualifyViaSocialLogin = (idToken) => socialRequest('/api/watcher/qualify', { method: 'POST', idToken, body: { method: 'social', qualifyingRef: null } });
export const getPioneerStatusSocial = (idToken) => socialRequest('/api/watcher/status?provider=google', { idToken });

/** Connects the signed-in Google account to a wallet. Needs BOTH proofs: the Google token and a signature from the wallet. */
export async function linkWalletToLogin(invokeMethod, address, idToken, subject) {
  // The message binds the link to this exact Google account (provider + its stable account id), so a signature cannot be reused for another one.
  const { message, signature, timestamp } = await signWatcherAction(invokeMethod, address, { action: 'link_social', extra: { provider: 'google', subject } });
  return socialRequest('/api/watcher/link', { method: 'POST', idToken, body: { walletAddress: address, message, signature, timestamp } });
}

/** The Google account id (`sub`) is inside the ID token. It is only used to build the message the wallet signs; the server verifies the token itself
 *  and refuses the link if the signed subject is not the verified one, so reading it here without checking the signature is safe. */
export function googleSubjectFromIdToken(idToken) {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    // small dependency-free base64 decoder (atob / Buffer are not guaranteed in every React Native runtime)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0, acc = 0, out = '';
    for (const ch of payload.replace(/=+$/, '')) { const v = chars.indexOf(ch); if (v < 0) return null; acc = (acc << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; out += String.fromCharCode((acc >> bits) & 0xff); } }
    return JSON.parse(out).sub || null;
  } catch { return null; }
}
