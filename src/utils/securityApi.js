// src/utils/securityApi.js
//
// Thin client for the Inaya Network Security Layer backend
// (inaya-network-dapp's /api/security/*, /api/ai/security-chat). Same
// plain-fetch-to-API_BASE convention as watcherApi.js — reports are
// wallet-signed via personal_sign when a wallet is connected, but every
// other read (threat lookup, policy, events, chat) works with just an
// identityId (wallet address or a locally-generated device id), same
// anonymous-identity trust model as activity.js's DAU/WAU pings.
//
// buildSecurityReportMessage's exact string format MUST stay in lockstep
// with inaya-network-dapp/src/lib/security.js's own
// buildSecurityReportMessage — any drift breaks every signed report.

import { ethers } from 'ethers';

const API_BASE = 'https://www.inayanetwork.com';

export function buildSecurityReportMessage({ indicator, category, confidenceBps, evidenceHash, timestamp }) {
  const lines = [
    'Inaya Security Report',
    `indicator: ${String(indicator || '').trim().toLowerCase()}`,
    `category: ${String(category)}`,
    `confidenceBps: ${confidenceBps}`,
  ];
  if (evidenceHash) lines.push(`evidenceHash: ${evidenceHash}`);
  lines.push(`timestamp: ${timestamp}`);
  return lines.join('\n');
}

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

/** Requires a connected wallet — a device-id-only identity can't sign a report (there's nothing
 *  to sign with), so reporting is a wallet-only capability while everything else works for both. */
export async function submitThreatReport(invokeMethod, address, { indicator, category, confidenceBps, evidenceHash }) {
  const timestamp = Date.now();
  const message = buildSecurityReportMessage({ indicator, category, confidenceBps, evidenceHash, timestamp });
  const signature = await invokeMethod({
    method: 'personal_sign',
    params: [ethers.hexlify(ethers.toUtf8Bytes(message)), address],
  });
  return postJson('/api/security/report', {
    nodeAddress: address,
    indicator,
    category,
    confidenceBps,
    evidenceHash: evidenceHash || null,
    message,
    signature,
    timestamp,
  });
}

export async function checkThreat(indicator) {
  return getJson(`/api/security/threat?indicator=${encodeURIComponent(indicator)}`);
}

export async function getSecurityPolicy() {
  return getJson('/api/security/policy');
}

/** Network-wide, public-safe stats (confirmed threat count, reporting node count, average
 *  reputation) — same route the web /security transparency page uses. */
export async function getSecurityStats() {
  return getJson('/api/security/stats');
}

export async function getSecurityFeed(sinceIso) {
  const qs = sinceIso ? `?since=${encodeURIComponent(sinceIso)}` : '';
  return getJson(`/api/security/feed${qs}`);
}

export async function logSecurityEvent({ identityId, surface, eventType, destination, decision, reason, confidenceBps, category }) {
  return postJson('/api/security/events', { identityId, surface, eventType, destination, decision, reason, confidenceBps, category });
}

export async function getSecurityEvents(identityId, limit = 20) {
  return getJson(`/api/security/events?identityId=${encodeURIComponent(identityId)}&limit=${limit}`);
}

export async function askSecurityAssistant(identityId, messages) {
  return postJson('/api/ai/security-chat', { identityId, messages });
}
