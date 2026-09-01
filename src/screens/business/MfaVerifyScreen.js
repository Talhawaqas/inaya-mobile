// src/screens/business/MfaVerifyScreen.js
//
// Login-time second-factor entry — rendered by BusinessAuthScreen instead
// of the normal sign-in form once primary auth (magic link or Google)
// succeeds AND the account has MFA enrolled (mfaRequired in the
// consume-token/google response). Same backend as web
// (inaya-network-dapp's /api/orgs/mfa/*) — POST /api/orgs/mfa/verify
// accepts a TOTP code, an SMS code, or a recovery code and, on success,
// returns a real sessionToken in its JSON body (not just a cookie mobile
// can't read — see orgApi.js's header comment for why mobile always needs
// the token itself). Server-side rate limiting (5 attempts) means this
// screen just relays whatever error comes back.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

export default function MfaVerifyScreen({ mfaPendingToken, onVerified, onCancel }) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [smsSent, setSmsSent] = useState(false);

  async function handleVerify() {
    if (!code.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await orgFetch('/api/orgs/mfa/verify', { method: 'POST', body: { mfaPendingToken, code: code.trim() } });
      await onVerified(data.sessionToken);
    } catch (err) {
      setError(err.message || 'Could not verify.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendSms() {
    setError('');
    try {
      await orgFetch('/api/orgs/mfa/send-sms', { method: 'POST', body: { mfaPendingToken } });
      setSmsSent(true);
    } catch (err) {
      setError(err.message || 'Could not send code.');
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Text style={styles.title}>Two-Step Verification</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code from your authenticator app, a code we texted you, or one of your recovery codes.
      </Text>

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          autoFocus
          editable={!submitting}
        />
        <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleVerify} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Verify</Text>}
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.linkRow} onPress={handleSendSms} disabled={smsSent}>
          <Text style={[styles.linkText, smsSent && styles.linkTextDisabled]}>
            {smsSent ? 'Code sent — check your phone' : 'Text me a code instead'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={onCancel}>
          <Text style={styles.linkText}>← Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  title: { fontSize: 20, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, letterSpacing: 0.5 },
  subtitle: { fontSize: 12, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 17 },
  card: { ...glassCard, padding: spacing.lg },
  codeInput: {
    fontFamily: fonts.mono,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 6,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  linkRow: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textMuted, textDecorationLine: 'underline' },
  linkTextDisabled: { opacity: 0.5, textDecorationLine: 'none' },
});
