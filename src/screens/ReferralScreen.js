// src/screens/ReferralScreen.js
//
// Mobile port of the web dApp's Referrals section
// (inaya-network-dapp/src/components/ReferralSection.js) — same backend
// (https://www.inayanetwork.com/api/referrals/*), same flow: email + Didit
// KYC only, no wallet-connect anywhere in this screen.
//
// Two differences from the web version, both because this is a native
// screen rather than a browser page:
//   - No `?ref=CODE` URL param to read on load (native apps don't have
//     query-string deep links unless a URL scheme + expo-linking config is
//     set up, which nothing in this app currently does — out of scope to
//     add just for this). Redeeming someone else's link is done instead by
//     typing the code into a plain text field, same underlying
//     /api/referrals/redeem call.
//   - The shareable link uses RN's built-in Share API (native share sheet)
//     instead of a copy-to-clipboard button — no clipboard library is
//     installed in this app, and Share is the more natural mobile idiom
//     for "hand this link to someone" anyway.
//
// KYC itself happens in Didit's hosted web flow, opened via the device's
// browser (Linking.openURL) rather than embedded — same as how this app
// already hands off to external URLs elsewhere (e.g. BscScan links).

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, fonts, glassCard } from '../theme';
import { openExternalLink, suspendAppLock } from '../utils/appLockSuspend';

const API_BASE = 'https://www.inayanetwork.com';

// Persisted so a returning referrer's verified code/status survives an app
// restart — without this, activatedEmail/referrerStatus reset to nothing
// on every fresh launch (React Navigation keeps this screen mounted across
// drawer-tab switches within one app session, so it was only ever a
// cold-start problem, but that's exactly when users open the app to check
// their code). Just an email address, not sensitive.
const ACTIVATED_EMAIL_KEY = 'inaya_referral_activated_email';

function StatusPill({ status }) {
  const map = {
    verified: [colors.success, 'rgba(52,211,153,0.12)', '✅ Verified'],
    pending: [colors.warning, 'rgba(245,158,11,0.12)', '⏳ Pending KYC'],
    rejected: [colors.danger, 'rgba(248,113,113,0.12)', '❌ Rejected'],
    not_started: [colors.textMuted, 'rgba(255,255,255,0.05)', 'Not started'],
  };
  const [color, bg, label] = map[status] || map.not_started;
  return (
    <View style={[pillStyles.pill, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[pillStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  text: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 0.4, textTransform: 'uppercase' },
});

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const pollRef = useRef(null);

  const [email, setEmail] = useState('');
  const [activatedEmail, setActivatedEmail] = useState('');
  const [referrerStatus, setReferrerStatus] = useState(null);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [kycUrl, setKycUrl] = useState('');

  const [referredEmail, setReferredEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  const [redeemCode, setRedeemCode] = useState('');
  const [redeemEmail, setRedeemEmail] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemUrl, setRedeemUrl] = useState('');

  const [history, setHistory] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  const refreshStatus = useCallback(async (targetEmail) => {
    if (!targetEmail) return;
    try {
      const res = await fetch(`${API_BASE}/api/referrals/status?email=${encodeURIComponent(targetEmail)}`);
      const data = await res.json();
      if (res.ok) setReferrerStatus(data);
    } catch {
      // Background poll — errors here don't need surfacing, the activate
      // flow's own error state already covers anything actionable.
    }
  }, []);

  const refreshHistory = useCallback(async (targetEmail) => {
    if (!targetEmail) return;
    try {
      const res = await fetch(`${API_BASE}/api/referrals/history?email=${encodeURIComponent(targetEmail)}`);
      const data = await res.json();
      if (res.ok) setHistory(data);
    } catch {
      // Same as above.
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/referrals/leaderboard`)
      .then((res) => res.json())
      .then((data) => setLeaderboard(data.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoadingLeaderboard(false));
  }, []);

  // Resume a previously-activated referrer on cold start — see
  // ACTIVATED_EMAIL_KEY's comment. refreshStatus() also benefits from
  // /api/referrals/status's own Didit-reconciliation fallback, so this
  // doubles as a chance to self-heal a status stuck on "pending" locally
  // despite already being verified on Didit's side.
  useEffect(() => {
    (async () => {
      const persisted = await AsyncStorage.getItem(ACTIVATED_EMAIL_KEY);
      if (!persisted) return;
      setEmail(persisted);
      setActivatedEmail(persisted);
      refreshStatus(persisted);
    })();
  }, [refreshStatus]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activatedEmail && referrerStatus?.status === 'pending') {
      pollRef.current = setInterval(() => refreshStatus(activatedEmail), 5000);
    }
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [activatedEmail, referrerStatus?.status, refreshStatus]);

  useEffect(() => {
    if (referrerStatus?.status === 'verified' && activatedEmail) refreshHistory(activatedEmail);
  }, [referrerStatus?.status, activatedEmail, refreshHistory]);

  async function handleActivate() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setActivating(true);
    setActivationError('');
    setKycUrl('');
    try {
      const res = await fetch(`${API_BASE}/api/referrals/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start verification.');
      setActivatedEmail(trimmed);
      await AsyncStorage.setItem(ACTIVATED_EMAIL_KEY, trimmed);
      setReferrerStatus(data.status === 'verified' ? { status: 'verified', referralCode: data.referralCode } : { status: 'pending' });
      if (data.url) setKycUrl(data.url);
    } catch (err) {
      setActivationError(err.message || 'Something went wrong.');
    } finally {
      setActivating(false);
    }
  }

  async function handleInvite() {
    const trimmed = referredEmail.trim().toLowerCase();
    if (!trimmed) return;
    setInviting(true);
    setInviteError('');
    setInviteUrl('');
    try {
      const res = await fetch(`${API_BASE}/api/referrals/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerEmail: activatedEmail, referredEmail: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the referral.');
      if (data.url) setInviteUrl(data.url);
      setReferredEmail('');
      refreshHistory(activatedEmail);
    } catch (err) {
      setInviteError(err.message || 'Something went wrong.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRedeem() {
    const trimmedCode = redeemCode.trim().toUpperCase();
    const trimmedEmail = redeemEmail.trim().toLowerCase();
    if (!trimmedCode || !trimmedEmail) return;
    setRedeeming(true);
    setRedeemError('');
    setRedeemUrl('');
    try {
      const res = await fetch(`${API_BASE}/api/referrals/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: trimmedCode, referredEmail: trimmedEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start verification.');
      if (data.url) setRedeemUrl(data.url);
    } catch (err) {
      setRedeemError(err.message || 'Something went wrong.');
    } finally {
      setRedeeming(false);
    }
  }

  function shareReferralLink() {
    const link = `${API_BASE}/?ref=${referrerStatus.referralCode}`;
    suspendAppLock(); // Share sheet is a separate Android Activity — same AppLockGate risk as openExternalLink()
    Share.share({ message: `Join Inaya Network using my referral code ${referrerStatus.referralCode}: ${link}` });
  }

  const isVerifiedReferrer = referrerStatus?.status === 'verified';

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>Referrals</Text>
      <Text style={styles.subtitle}>
        Earn 0.4 INAYA for every successful referral, and the person you refer earns 0.1 INAYA — no wallet needed, just email and a quick
        identity check. Rewards are recorded now and distributed at mainnet.
      </Text>

      {/* REDEEM A CODE */}
      {!isVerifiedReferrer && (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={styles.cardTitle}>Have a referral code?</Text>
          <Text style={styles.cardHint}>Enter it along with your email to start your own verification.</Text>
          <TextInput
            style={styles.input}
            value={redeemCode}
            onChangeText={setRedeemCode}
            placeholder="REFERRAL CODE"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
          <TextInput
            style={[styles.input, { marginTop: spacing.sm }]}
            value={redeemEmail}
            onChangeText={setRedeemEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity style={[styles.button, redeeming && styles.buttonDisabled]} onPress={handleRedeem} disabled={redeeming}>
            <Text style={styles.buttonText}>{redeeming ? 'Starting…' : 'Start verification'}</Text>
          </TouchableOpacity>
          {redeemError ? <Text style={styles.error}>{redeemError}</Text> : null}
          {redeemUrl ? (
            <TouchableOpacity onPress={() => openExternalLink(redeemUrl)} style={styles.linkBox}>
              <Text style={styles.linkBoxLabel}>Complete your verification:</Text>
              <Text style={styles.linkBoxUrl}>{redeemUrl}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* STEP 1: ACTIVATE AS A REFERRER */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>1. Verify your own identity</Text>
          {referrerStatus && <StatusPill status={referrerStatus.status} />}
        </View>
        <Text style={styles.cardHint}>
          A one-time identity check (ID + liveness, via Didit) is required before you can refer anyone — this is what lets us actually
          detect and block self-referral, instead of just trusting an email address.
        </Text>

        {!isVerifiedReferrer && (
          <>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!activating}
            />
            <TouchableOpacity style={[styles.button, activating && styles.buttonDisabled]} onPress={handleActivate} disabled={activating}>
              <Text style={styles.buttonText}>{activating ? 'Starting…' : 'Start verification'}</Text>
            </TouchableOpacity>
          </>
        )}

        {activationError ? <Text style={styles.error}>{activationError}</Text> : null}

        {kycUrl && referrerStatus?.status === 'pending' ? (
          <TouchableOpacity onPress={() => openExternalLink(kycUrl)} style={styles.linkBox}>
            <Text style={styles.linkBoxLabel}>Complete your verification:</Text>
            <Text style={styles.linkBoxUrl}>{kycUrl}</Text>
          </TouchableOpacity>
        ) : null}

        {referrerStatus?.status === 'pending' && !kycUrl ? (
          <Text style={styles.pendingNote}>Verification in progress — checking automatically every few seconds.</Text>
        ) : null}

        {referrerStatus?.status === 'rejected' ? (
          <Text style={styles.error}>
            Verification wasn't approved{referrerStatus.rejectionReason ? ` (${referrerStatus.rejectionReason.replace(/_/g, ' ')})` : ''}. You can try again above.
          </Text>
        ) : null}

        {isVerifiedReferrer && (
          <>
            <Text style={styles.codeText}>
              Your referral code: <Text style={styles.codeValue}>{referrerStatus.referralCode}</Text>
            </Text>
            <TouchableOpacity style={styles.shareButton} onPress={shareReferralLink}>
              <Text style={styles.shareButtonText}>📤 Share your referral link</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* STEP 2: INVITE SOMEONE DIRECTLY */}
      {isVerifiedReferrer && (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={styles.cardTitle}>2. Or invite someone directly by email</Text>
          <TextInput
            style={styles.input}
            value={referredEmail}
            onChangeText={setReferredEmail}
            placeholder="their-email@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!inviting}
          />
          <TouchableOpacity style={[styles.button, inviting && styles.buttonDisabled]} onPress={handleInvite} disabled={inviting}>
            <Text style={styles.buttonText}>{inviting ? 'Sending…' : 'Send invite'}</Text>
          </TouchableOpacity>
          {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}
          {inviteUrl ? (
            <TouchableOpacity onPress={() => openExternalLink(inviteUrl)} style={styles.linkBox}>
              <Text style={styles.linkBoxLabel}>Share this verification link with them:</Text>
              <Text style={styles.linkBoxUrl}>{inviteUrl}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* STEP 3: HISTORY */}
      {isVerifiedReferrer && history && (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={styles.cardTitle}>Your referrals</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{history.successfulReferralCount}</Text>
              <Text style={styles.statLabel}>Successful</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{history.totalInayaEarned.toFixed(2)}</Text>
              <Text style={styles.statLabel}>INAYA Earned</Text>
            </View>
          </View>
          {history.referrals.length === 0 ? (
            <Text style={styles.emptyText}>No referrals yet — invite someone above.</Text>
          ) : (
            history.referrals.map((r, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyEmail} numberOfLines={1}>{r.referredEmail}</Text>
                <StatusPill status={r.status === 'verified' ? 'verified' : r.status === 'pending' ? 'pending' : 'rejected'} />
              </View>
            ))
          )}
        </View>
      )}

      {/* LEADERBOARD */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.cardTitle}>🏆 Top 50 Referrers</Text>
        {loadingLeaderboard ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : leaderboard.length === 0 ? (
          <Text style={styles.emptyText}>No successful referrals yet — be the first.</Text>
        ) : (
          leaderboard.map((row) => (
            <View key={row.rank} style={styles.leaderRow}>
              <Text style={styles.leaderRank}>#{row.rank}</Text>
              <Text style={styles.leaderEmail} numberOfLines={1}>{row.email}</Text>
              <Text style={styles.leaderCount}>{row.successfulReferralCount}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: 20, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, letterSpacing: 0.5 },
  subtitle: { fontSize: 12, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 17 },
  card: { ...glassCard, padding: spacing.lg },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  cardHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 16 },
  input: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  pendingNote: { fontFamily: fonts.sans, fontSize: 11, color: colors.warning, marginTop: spacing.sm },
  linkBox: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  linkBoxLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.warning, marginBottom: spacing.xs },
  linkBoxUrl: { fontFamily: fonts.mono, fontSize: 11, color: colors.cyan },
  codeText: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  codeValue: { color: colors.cyan, fontFamily: fonts.monoBold },
  shareButton: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(0,242,254,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,242,254,0.3)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  shareButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.cyan },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, padding: spacing.md },
  statValue: { fontFamily: fonts.sansExtraBold, fontSize: 18, color: colors.textPrimary },
  statLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', marginTop: 2 },
  emptyText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  historyEmail: { flex: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.textPrimary },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  leaderRank: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary, width: 32 },
  leaderEmail: { flex: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  leaderCount: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.cyan },
});
