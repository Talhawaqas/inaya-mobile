// src/utils/notificationsApi.js
//
// Thin client for the notification center's server-computed events
// (inaya-network-dapp's /api/notifications). Same plain-fetch-to-API_BASE
// convention as learnApi.js/watcherApi.js -- no Bearer session, public
// GET keyed by the referral-activated email already cached under
// ACTIVATED_EMAIL_KEY (see ReferralScreen.js).
//
// Deliberately does NOT duplicate the web app's client-computed staking/
// airdrop notifications -- those need live on-chain reads this app
// already does inside StakingScreen/UploadScreen's own state, and
// re-fetching them here would mean a second, separate wallet round-trip
// just to power a badge. Server-side (email/referral) events only for
// this pass.

const API_BASE = 'https://www.inayanetwork.com';

export async function getNotifications(email) {
  if (!email) return { notifications: [] };
  const res = await fetch(`${API_BASE}/api/notifications?email=${encodeURIComponent(email)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status}).`);
  return data;
}
