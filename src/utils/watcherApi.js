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
