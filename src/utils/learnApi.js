// src/utils/learnApi.js
//
// Thin client for Inaya Learn's backend (inaya-network-dapp's
// /api/learn/*). Plain-fetch-to-API_BASE convention, same as
// watcherApi.js/ReferralScreen.js's public-endpoint calls — no Bearer
// session (that's the org/Business Workspace auth paradigm, wrong fit
// here). walletAddress is passed as a plain param when present; every
// endpoint that needs it also works fine without one where the caller is
// meant to be public (config/search/video).

const API_BASE = 'https://www.inayanetwork.com';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (HTTP ${res.status}).`);
  }
  return data;
}

export async function getLearnConfig() {
  return request('/api/learn/config');
}

export async function searchLearnVideos({ query, categoryId, pageToken }) {
  const params = new URLSearchParams({ q: query });
  if (categoryId) params.set('category', categoryId);
  if (pageToken) params.set('pageToken', pageToken);
  return request(`/api/learn/search?${params.toString()}`);
}

export async function getLearnVideo(videoId, relatedCategoryId) {
  const qs = relatedCategoryId ? `?related=${encodeURIComponent(relatedCategoryId)}` : '';
  return request(`/api/learn/video/${encodeURIComponent(videoId)}${qs}`);
}

export async function saveLearnVideo({ walletAddress, videoId, title, thumbnailUrl, channelTitle, categoryId }) {
  return request('/api/learn/saved', {
    method: 'POST',
    body: { walletAddress, videoId, title, thumbnailUrl, channelTitle, categoryId },
  });
}

export async function unsaveLearnVideo({ walletAddress, videoId }) {
  const params = new URLSearchParams({ walletAddress });
  return request(`/api/learn/saved/${encodeURIComponent(videoId)}?${params.toString()}`, { method: 'DELETE' });
}

export async function listSavedLearnVideos(walletAddress) {
  const params = new URLSearchParams({ walletAddress });
  return request(`/api/learn/saved?${params.toString()}`);
}

export async function saveLearnProgress({ walletAddress, videoId, title, thumbnailUrl, channelTitle, positionSeconds, durationSeconds, status }) {
  return request('/api/learn/progress', {
    method: 'POST',
    body: { walletAddress, videoId, title, thumbnailUrl, channelTitle, positionSeconds, durationSeconds, status },
  });
}

export async function listLearnProgress(walletAddress, status) {
  const params = new URLSearchParams({ walletAddress });
  if (status) params.set('status', status);
  return request(`/api/learn/progress?${params.toString()}`);
}

export async function reportLearnVideo({ videoId, reason, detail, walletAddress }) {
  return request('/api/learn/report', { method: 'POST', body: { videoId, reason, detail, walletAddress } });
}

/** Fire-and-forget — never throws into the caller's UI flow. */
export async function logLearnEvent({ event, categoryId, videoId }) {
  try {
    await request('/api/learn/analytics', { method: 'POST', body: { event, categoryId, videoId } });
  } catch {
    // analytics failures are silently ignored by design — see the route's own comment
  }
}
