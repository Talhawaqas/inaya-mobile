// src/screens/business/BusinessAuthScreen.js
//
// Sign in / create company for the mobile Business Workspace. Two steps,
// same magic-link mechanism the web app uses:
//   1. Enter email (+ company name if creating a new one) -> backend emails
//      a login link via Resend.
//   2. Paste that link (or just the token) back into the app -> the app
//      exchanges it for a session token via /api/orgs/login/consume-token
//      and stores it (see src/utils/orgApi.js's header comment for why this
//      differs from the web app's cookie-based flow).
//
// Scoped per the SOW's mobile section: sign in / create company only — no
// invite-member or admin flows on mobile this pass.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch, setStoredSessionToken } from '../../utils/orgApi';

export default function BusinessAuthScreen({ onAuthenticated }) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('signin'); // 'signin' | 'create'

  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [devLoginUrl, setDevLoginUrl] = useState('');

  const [pastedLink, setPastedLink] = useState('');
  const [consuming, setConsuming] = useState(false);
  const [consumeError, setConsumeError] = useState('');

  async function handleRequestLink() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;
    if (mode === 'create' && !orgName.trim()) return;

    setRequesting(true);
    setRequestError('');
    setDevLoginUrl('');
    try {
      const data = mode === 'create'
        ? await orgFetch('/api/orgs/create', { method: 'POST', body: { orgName: orgName.trim(), ownerEmail: trimmedEmail } })
        : await orgFetch('/api/orgs/login/request', { method: 'POST', body: { email: trimmedEmail } });

      setLinkSent(true);
      // Only present when real email delivery didn't happen (e.g. local dev
      // without RESEND_API_KEY) — see the route's own comment for why this
      // is never returned once delivery actually works.
      if (data.loginUrl) setDevLoginUrl(data.loginUrl);
    } catch (err) {
      setRequestError(err.message || 'Something went wrong.');
    } finally {
      setRequesting(false);
    }
  }

  async function handleConsumeLink() {
    const trimmed = pastedLink.trim();
    if (!trimmed) return;
    setConsuming(true);
    setConsumeError('');
    try {
      const data = await orgFetch('/api/orgs/login/consume-token', { method: 'POST', body: { token: trimmed } });
      await setStoredSessionToken(data.sessionToken);
      const session = await orgFetch('/api/orgs/session');
      onAuthenticated(session);
    } catch (err) {
      setConsumeError(err.message || 'Could not sign in.');
    } finally {
      setConsuming(false);
    }
  }

  function resetToStepOne() {
    setLinkSent(false);
    setDevLoginUrl('');
    setPastedLink('');
    setConsumeError('');
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>Business Workspace</Text>
      <Text style={styles.subtitle}>
        Sign in with your work email — no wallet needed. Your company's documents stay encrypted end-to-end, same as everywhere else in Inaya.
      </Text>

      {!linkSent ? (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}
              onPress={() => setMode('signin')}
            >
              <Text style={[styles.modeButtonText, mode === 'signin' && styles.modeButtonTextActive]}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'create' && styles.modeButtonActive]}
              onPress={() => setMode('create')}
            >
              <Text style={[styles.modeButtonText, mode === 'create' && styles.modeButtonTextActive]}>Create company</Text>
            </TouchableOpacity>
          </View>

          {mode === 'create' && (
            <TextInput
              style={[styles.input, { marginTop: spacing.md }]}
              value={orgName}
              onChangeText={setOrgName}
              placeholder="Company name"
              placeholderTextColor={colors.textMuted}
            />
          )}
          <TextInput
            style={[styles.input, { marginTop: spacing.sm }]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!requesting}
          />
          <TouchableOpacity style={[styles.button, requesting && styles.buttonDisabled]} onPress={handleRequestLink} disabled={requesting}>
            {requesting ? <ActivityIndicator color={colors.bg} /> : (
              <Text style={styles.buttonText}>{mode === 'create' ? 'Create company' : 'Send login link'}</Text>
            )}
          </TouchableOpacity>
          {requestError ? <Text style={styles.error}>{requestError}</Text> : null}
        </View>
      ) : (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={styles.cardTitle}>Check your email</Text>
          <Text style={styles.cardHint}>
            We sent a login link to {email}. Open it, then copy the full link (or just the code after "token=") and paste it below to finish
            signing in on this device.
          </Text>

          {devLoginUrl ? (
            <View style={styles.linkBox}>
              <Text style={styles.linkBoxLabel}>Email delivery isn't configured — here's your link directly:</Text>
              <Text style={styles.linkBoxUrl} selectable>{devLoginUrl}</Text>
            </View>
          ) : null}

          <TextInput
            style={[styles.input, { marginTop: spacing.md }]}
            value={pastedLink}
            onChangeText={setPastedLink}
            placeholder="Paste your login link or code"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            editable={!consuming}
          />
          <TouchableOpacity style={[styles.button, consuming && styles.buttonDisabled]} onPress={handleConsumeLink} disabled={consuming}>
            {consuming ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableOpacity>
          {consumeError ? <Text style={styles.error}>{consumeError}</Text> : null}

          <TouchableOpacity style={styles.backLink} onPress={resetToStepOne}>
            <Text style={styles.backLinkText}>Use a different email</Text>
          </TouchableOpacity>
        </View>
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
  modeRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, padding: 3 },
  modeButton: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  modeButtonActive: { backgroundColor: colors.cyan },
  modeButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textMuted },
  modeButtonTextActive: { color: colors.bg },
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
  linkBox: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  linkBoxLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.warning, marginBottom: spacing.xs },
  linkBoxUrl: { fontFamily: fonts.mono, fontSize: 11, color: colors.cyan },
  backLink: { marginTop: spacing.md, alignItems: 'center' },
  backLinkText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textMuted, textDecorationLine: 'underline' },
});
