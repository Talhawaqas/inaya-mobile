// src/screens/WatcherPioneerScreen.js
//
// Testnet-only Watcher Pioneer Program — wallet-based enrollment (max 2,500
// wallets), off-chain points earned via repeating 24-hour "Watcher
// sessions." Deliberately named "Watcher Pioneer Program" throughout, not
// just "Watcher" — an unrelated, backend-less "Watcher Node Status" screen
// already exists in this app's Home stack, and this copy keeps the two from
// being confused.
//
// All server interaction goes through src/utils/watcherApi.js. The 24h
// countdown shown here is DISPLAY only — the authoritative expiry always
// comes from the server (getPioneerStatus), re-fetched on mount and
// periodically, so this screen is correct even after the app was closed and
// reopened mid-session, not because of any local timer state.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useWallet } from '../providers/WalletProvider';
import { colors, spacing, radius, fonts, glassCard } from '../theme';
import {
  enrollPioneer, qualifyViaSocial, getPioneerStatus,
  enrollPioneerSocial, qualifyViaSocialLogin, getPioneerStatusSocial, linkWalletToLogin, googleSubjectFromIdToken,
} from '../utils/watcherApi';
import { openExternalLink } from '../utils/appLockSuspend';
import GoogleSignInButton, { isGoogleSignInConfigured } from '../components/GoogleSignInButton';

// The Google sign-in is kept for the life of the app process only (its token lasts about an hour); it is never written to storage.
let rememberedGoogle = null;

const X_POST_URL = 'https://x.com/InayaNetwork';
const X_FOLLOW_URL = 'https://x.com/InayaNetwork';
const TELEGRAM_URL = 'https://t.me/inayanetwork';

const WATCHER_POINTS_PER_SESSION = 200;
const WATCHER_MAX_POINTS_PER_WALLET = 100000;
const WATCHER_POINTS_PER_INAYA = 1000;

const STATUS_POLL_MS = 30000;

// Limited-time new-enrollment bonus — must stay in lockstep with
// inaya-network-dapp/src/lib/watcherPioneer.js's ENROLLMENT_PROMO_POINTS /
// ENROLLMENT_PROMO_CUTOFF (SQA-037). Display-only here — the actual grant
// and its cutoff enforcement both happen server-side in enrollWallet(), so
// a stale app build showing this banner past the deadline can't over-promise
// anything the backend won't also honor.
const ENROLLMENT_PROMO_POINTS = 11000;
const ENROLLMENT_PROMO_CUTOFF = new Date('2026-10-05T03:59:59.000Z'); // Sunday 2026-10-04, 23:59:59 America/New_York

function formatPromoDeadline() {
  const msRemaining = ENROLLMENT_PROMO_CUTOFF.getTime() - Date.now();
  if (msRemaining <= 0) return null;
  const days = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  return days <= 1 ? 'today' : `in ${days} days`;
}

function formatCountdown(msRemaining) {
  if (msRemaining <= 0) return '00:00:00';
  const totalSeconds = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function WatcherPioneerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { address, isConnected, connecting, connect, invokeMethod } = useWallet();

  const [status, setStatus] = useState(null); // null while loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followedX, setFollowedX] = useState(false);
  const [joinedTelegram, setJoinedTelegram] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  // Social login: when signed in with Google the program is used through that account (it resolves to the right record whether the person
  // started with Google, or started with a wallet and attached Google). Otherwise everything below behaves exactly as it always has.
  const [google, setGoogleState] = useState(rememberedGoogle); // { idToken, subject } | null
  const [notice, setNotice] = useState('');
  const [linking, setLinking] = useState(false);
  const setGoogle = (g) => { rememberedGoogle = g; setGoogleState(g); };
  const googleOn = !!google;
  const identityKey = googleOn ? `google:${google.subject}` : address;

  const pollRef = useRef(null);
  const tickRef = useRef(null);

  const refreshStatus = useCallback(async () => {
    if (!identityKey) return;
    try {
      const data = googleOn ? await getPioneerStatusSocial(google.idToken) : await getPioneerStatus(address);
      setStatus(data);
      setError('');
    } catch (err) {
      if (googleOn && err.status === 401) { setGoogle(null); setStatus(null); }
      setError(err.message || 'Could not load Watcher Pioneer status.');
    } finally {
      setLoading(false);
    }
  }, [identityKey, googleOn, google, address]);

  useEffect(() => {
    if (!identityKey) { setLoading(false); return; }
    setLoading(true);
    setStatus(null);
    refreshStatus();
    pollRef.current = setInterval(refreshStatus, STATUS_POLL_MS);
    return () => pollRef.current && clearInterval(pollRef.current);
  }, [identityKey, refreshStatus]);

  useEffect(() => {
    if (!status?.activeSession) return;
    tickRef.current = setInterval(() => setNowTick(Date.now()), 1000);
    return () => tickRef.current && clearInterval(tickRef.current);
  }, [status?.activeSession]);

  async function handleEnroll() {
    if (!followedX || !joinedTelegram) return;
    setEnrolling(true);
    setError('');
    try {
      if (googleOn) await enrollPioneerSocial(google.idToken, { followedX, joinedTelegram });
      else await enrollPioneer(invokeMethod, address, { followedX, joinedTelegram });
      await refreshStatus();
    } catch (err) {
      setError(err.message || 'Could not enroll.');
    } finally {
      setEnrolling(false);
    }
  }

  async function handleQualifySocial() {
    setQualifying(true);
    setError('');
    try {
      if (googleOn) await qualifyViaSocialLogin(google.idToken);
      else await qualifyViaSocial(invokeMethod, address);
      await refreshStatus();
    } catch (err) {
      setError(err.message || 'Could not start a Watcher session.');
    } finally {
      setQualifying(false);
    }
  }

  async function handleGoogleSignIn(idToken) {
    const subject = googleSubjectFromIdToken(idToken);
    if (!subject) throw new Error('Could not read your Google account. Please try again.');
    setError(''); setNotice('');
    setGoogle({ idToken, subject });
  }

  // A wallet participant adds Google sign-in to the SAME account (needs a wallet signature as well as the Google token). Stays in wallet view.
  async function handleAddGoogleToWallet(idToken) {
    const subject = googleSubjectFromIdToken(idToken);
    if (!subject) throw new Error('Could not read your Google account. Please try again.');
    setError(''); setNotice('');
    await linkWalletToLogin(invokeMethod, address, idToken, subject);
    setNotice('Google sign-in added. You can now open this account with Google or with your wallet.');
  }

  // A Google participant links a wallet (to use the upload action and to receive rewards). Two steps: connect, then sign the link.
  async function handleLinkWallet() {
    setError(''); setNotice('');
    if (!isConnected) { connect(); return; }
    setLinking(true);
    try {
      await linkWalletToLogin(invokeMethod, address, google.idToken, google.subject);
      setNotice('Wallet linked. Your points and sessions are unchanged.');
      await refreshStatus();
    } catch (err) {
      if (err.status === 401) { setGoogle(null); setStatus(null); }
      setError(err.message || 'Could not link the wallet.');
    } finally {
      setLinking(false);
    }
  }

  const insetsBottom = insets.bottom + spacing.xxxl;

  if (!googleOn && !isConnected) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insetsBottom }]}>
        <Text style={styles.title}>Watcher Pioneer Program</Text>
        <Text style={styles.subtitle}>{isGoogleSignInConfigured() ? 'Connect your wallet or sign in with Google to join.' : 'Connect your wallet to join.'}</Text>
        <TouchableOpacity style={styles.button} onPress={connect} disabled={connecting}>
          {connecting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Connect Wallet</Text>}
        </TouchableOpacity>
        {isGoogleSignInConfigured() && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.cardHint, { textAlign: 'center' }]}>or</Text>
            <GoogleSignInButton onIdToken={handleGoogleSignIn} />
            <Text style={[styles.cardHint, { textAlign: 'center' }]}>No wallet needed. You can link one later to receive rewards.</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insetsBottom }]}>
      <Text style={styles.title}>Watcher Pioneer Program</Text>
      <Text style={styles.subtitle}>
        Testnet-only. Upload a file or complete today's social task to start a 24-hour Watcher session — every
        completed session earns points toward real $INAYA.
      </Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      {googleOn && (
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.cardTitle}>Signed in with Google</Text>
          <Text style={styles.cardHint}>{status?.email || 'Your Google account'}</Text>
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => { setGoogle(null); setNotice(''); }}>
            <Text style={styles.buttonText}>Sign out of Google</Text>
          </TouchableOpacity>
        </View>
      )}

      {googleOn && status?.enrolled && !status?.linkedWallet && (
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.cardTitle}>Link a wallet</Text>
          <Text style={styles.cardHint}>Your points are safe and keep counting. Link a wallet to receive your INAYA rewards and to use the upload action. Until then, use the social task below.</Text>
          <TouchableOpacity style={[styles.button, linking && styles.buttonDisabled]} onPress={handleLinkWallet} disabled={linking}>
            {linking ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>{isConnected ? 'Link this wallet' : 'Connect a wallet'}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {!googleOn && status?.enrolled && isGoogleSignInConfigured() && (
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.cardTitle}>Also sign in with Google</Text>
          <Text style={styles.cardHint}>Add Google to this same account so you can open it either way. Your points and sessions stay exactly as they are.</Text>
          <GoogleSignInButton label="Add Google sign-in" onIdToken={handleAddGoogleToWallet} />
        </View>
      )}

      {!status?.enrolled ? (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          {status?.spotsRemaining === 0 ? (
            <Text style={styles.fullText}>The Watcher Pioneer Program is full — all 2,500 spots have been claimed.</Text>
          ) : (
            <>
              {!!formatPromoDeadline() && (
                <View style={styles.promoBanner}>
                  <Text style={styles.promoTitle}>🎉 Limited-time bonus</Text>
                  <Text style={styles.promoHint}>
                    Enroll {formatPromoDeadline()} and get {ENROLLMENT_PROMO_POINTS.toLocaleString()} bonus points
                    ({ENROLLMENT_PROMO_POINTS / WATCHER_POINTS_PER_INAYA} INAYA) credited instantly — automatic, no
                    extra step.
                  </Text>
                </View>
              )}
              <Text style={styles.cardTitle}>Join the Program</Text>
              <Text style={styles.cardHint}>{status?.spotsRemaining ?? '—'} spots remaining out of 2,500.</Text>

              <TouchableOpacity style={styles.attestRow} onPress={() => openExternalLink(X_FOLLOW_URL)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attestLabel}>Follow @InayaNetwork on X</Text>
                  <Text style={styles.attestLink}>Open X ↗</Text>
                </View>
                <Switch value={followedX} onValueChange={setFollowedX} trackColor={{ true: colors.cyan }} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.attestRow} onPress={() => openExternalLink(TELEGRAM_URL)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attestLabel}>Join the Telegram group</Text>
                  <Text style={styles.attestLink}>Open Telegram ↗</Text>
                </View>
                <Switch value={joinedTelegram} onValueChange={setJoinedTelegram} trackColor={{ true: colors.cyan }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, (!followedX || !joinedTelegram || enrolling) && styles.buttonDisabled]}
                onPress={handleEnroll}
                disabled={!followedX || !joinedTelegram || enrolling}
              >
                {enrolling ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>{formatPromoDeadline() ? 'Enroll Now' : 'Join the Watcher Pioneer Program'}</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <>
          <View style={[styles.card, { marginTop: spacing.lg }]}>
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Watcher Points</Text>
                <Text style={styles.statValue}>{status.totalPoints.toLocaleString()}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>INAYA Equivalent</Text>
                <Text style={styles.statValue}>{status.inayaEquivalent.toLocaleString()}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Daily Reward</Text>
                <Text style={styles.statValue}>+{WATCHER_POINTS_PER_SESSION}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Lifetime Cap</Text>
                <Text style={styles.statValue}>{WATCHER_MAX_POINTS_PER_WALLET / WATCHER_POINTS_PER_INAYA} INAYA</Text>
              </View>
            </View>
          </View>

          {status.capReached ? (
            <View style={[styles.card, { marginTop: spacing.lg }]}>
              <Text style={styles.cardTitle}>Lifetime cap reached 🎉</Text>
              <Text style={styles.cardHint}>
                This wallet has earned the full 100 INAYA lifetime reward. Thank you for participating in the Watcher
                Pioneer Program.
              </Text>
            </View>
          ) : status.activeSession ? (
            <View style={[styles.card, { marginTop: spacing.lg, alignItems: 'center' }]}>
              <Text style={styles.cardTitle}>Watcher session running</Text>
              <Text style={styles.countdown}>
                {formatCountdown(new Date(status.activeSession.expiresAt).getTime() - nowTick)}
              </Text>
              <Text style={styles.cardHint}>Come back after this session completes to start the next one.</Text>
            </View>
          ) : (
            <View style={[styles.card, { marginTop: spacing.lg }]}>
              <Text style={styles.cardTitle}>Start today's Watcher session</Text>
              <Text style={styles.cardHint}>Either action starts a new 24-hour session.</Text>

              <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Home', { screen: 'Upload' })}>
                <Text style={styles.buttonText}>Upload a File</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => openExternalLink(X_POST_URL)}>
                <Text style={[styles.buttonText, styles.buttonSecondaryText]}>Open Latest X Post ↗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, qualifying && styles.buttonDisabled]}
                onPress={handleQualifySocial}
                disabled={qualifying}
              >
                {qualifying ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>I Liked &amp; Retweeted</Text>}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: 20, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, letterSpacing: 0.5 },
  subtitle: { fontSize: 12, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 17 },
  card: { ...glassCard, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  cardHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm, lineHeight: 16 },
  fullText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.warning, textAlign: 'center' },
  promoBanner: {
    backgroundColor: 'rgba(0,242,254,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,242,254,0.25)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  promoTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.cyan },
  promoHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textPrimary, marginTop: spacing.xs, lineHeight: 16 },
  attestRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  attestLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textPrimary },
  attestLink: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.cyan, marginTop: 2 },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonSecondary: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border },
  buttonSecondaryText: { color: colors.textPrimary },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  notice: { fontFamily: fonts.sans, fontSize: 11, color: colors.success || colors.cyan, marginTop: spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCell: { width: '47%' },
  statLabel: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontFamily: fonts.sansExtraBold, fontSize: 20, color: colors.textPrimary, marginTop: 2 },
  countdown: { fontFamily: fonts.mono, fontSize: 32, color: colors.cyan, marginVertical: spacing.sm, letterSpacing: 1 },
});
