// src/screens/business/MfaSettingsScreen.js
//
// Enroll/manage MFA for the signed-in member's own account — identity-
// scoped (see inaya-network-dapp's mfa.js header), so this protects
// every org they belong to, not just one. User's choice: nothing here is
// mandatory, this screen exists precisely so a member can opt in
// (Two-Step Verification button on OrgHomeScreen). Same backend as web,
// same two methods (TOTP/QR code, SMS), same "disabling requires a live
// code first" rule.
//
// QR rendering: the qrDataUri the backend returns is a plain
// data:image/png;base64,... string — <Image source={{ uri }}> renders a
// data URI directly, no extra QR-scanning/rendering library needed here.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

export default function MfaSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  const [totpEnrollment, setTotpEnrollment] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsPending, setSmsPending] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [disableCode, setDisableCode] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setStatus(await orgFetch('/api/orgs/mfa/status'));
    } catch (err) {
      setError(err.message || 'Could not load MFA status.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function startTotpEnrollment() {
    setError(''); setBusy('totp-start');
    try {
      setTotpEnrollment(await orgFetch('/api/orgs/mfa/totp/enroll', { method: 'POST' }));
    } catch (err) {
      setError(err.message || 'Could not start enrollment.');
    } finally {
      setBusy('');
    }
  }

  async function confirmTotp() {
    if (!totpCode.trim()) return;
    setError(''); setBusy('totp-confirm');
    try {
      const result = await orgFetch('/api/orgs/mfa/totp/confirm', { method: 'POST', body: { code: totpCode.trim() } });
      if (result.recoveryCodes) setRecoveryCodes(result.recoveryCodes);
      setTotpEnrollment(null);
      setTotpCode('');
      await load();
    } catch (err) {
      setError(err.message || 'That code doesn’t match.');
    } finally {
      setBusy('');
    }
  }

  async function startSmsEnrollment() {
    if (!phoneNumber.trim()) return;
    setError(''); setBusy('sms-start');
    try {
      await orgFetch('/api/orgs/mfa/sms/enroll', { method: 'POST', body: { phoneNumber: phoneNumber.trim() } });
      setSmsPending(true);
    } catch (err) {
      setError(err.message || 'Could not send code.');
    } finally {
      setBusy('');
    }
  }

  async function confirmSms() {
    if (!smsCode.trim()) return;
    setError(''); setBusy('sms-confirm');
    try {
      const result = await orgFetch('/api/orgs/mfa/sms/confirm', { method: 'POST', body: { code: smsCode.trim() } });
      if (result.recoveryCodes) setRecoveryCodes(result.recoveryCodes);
      setSmsPending(false);
      setSmsCode('');
      setPhoneNumber('');
      await load();
    } catch (err) {
      setError(err.message || 'That code doesn’t match.');
    } finally {
      setBusy('');
    }
  }

  async function disable() {
    if (!disableCode.trim()) return;
    setError(''); setBusy('disable');
    try {
      await orgFetch('/api/orgs/mfa/disable', { method: 'POST', body: { code: disableCode.trim() } });
      setDisableCode('');
      await load();
    } catch (err) {
      setError(err.message || 'Incorrect code.');
    } finally {
      setBusy('');
    }
  }

  if (!status) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  const mfaEnabled = status.totpEnabled || status.smsEnabled;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.subtitle}>Protects sign-in for your account across every company you belong to — not just this one.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {recoveryCodes && (
        <View style={[styles.card, styles.recoveryCard]}>
          <Text style={styles.recoveryTitle}>Save your recovery codes — shown only once</Text>
          <Text style={styles.recoveryHint}>Tap and hold a code to select and copy it.</Text>
          <View style={styles.recoveryGrid}>
            {recoveryCodes.map((c) => <Text key={c} style={styles.recoveryCode} selectable>{c}</Text>)}
          </View>
          <TouchableOpacity onPress={() => setRecoveryCodes(null)} style={styles.linkRow}>
            <Text style={styles.recoveryLink}>I've saved these</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Authenticator app (QR code) */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Authenticator App (QR Code)</Text>
          {status.totpEnabled && <Text style={styles.badge}>Enabled</Text>}
        </View>
        <Text style={styles.cardHint}>Google Authenticator, Authy, or any standard authenticator app.</Text>

        {!status.totpEnabled && !totpEnrollment && (
          <TouchableOpacity style={styles.actionButton} onPress={startTotpEnrollment} disabled={busy === 'totp-start'}>
            {busy === 'totp-start' ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.actionButtonText}>Set up</Text>}
          </TouchableOpacity>
        )}

        {totpEnrollment && (
          <View style={{ marginTop: spacing.md }}>
            <Image source={{ uri: totpEnrollment.qrDataUri }} style={styles.qrImage} />
            <Text style={styles.secretText} selectable>Or enter manually: {totpEnrollment.secret}</Text>
            <TextInput
              style={[styles.input, { marginTop: spacing.sm }]}
              value={totpCode}
              onChangeText={setTotpCode}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.actionButton} onPress={confirmTotp} disabled={busy === 'totp-confirm'}>
              {busy === 'totp-confirm' ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.actionButtonText}>Confirm</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* SMS */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Phone Number (SMS)</Text>
          {status.smsEnabled && <Text style={styles.badge}>Enabled • •••{status.smsPhoneLast4}</Text>}
        </View>

        {!status.smsEnabled && !smsPending && (
          <View style={{ marginTop: spacing.sm }}>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+15551234567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.actionButton} onPress={startSmsEnrollment} disabled={busy === 'sms-start'}>
              {busy === 'sms-start' ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.actionButtonText}>Send code</Text>}
            </TouchableOpacity>
          </View>
        )}

        {smsPending && (
          <View style={{ marginTop: spacing.sm }}>
            <TextInput
              style={styles.input}
              value={smsCode}
              onChangeText={setSmsCode}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.actionButton} onPress={confirmSms} disabled={busy === 'sms-confirm'}>
              {busy === 'sms-confirm' ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.actionButtonText}>Confirm</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {mfaEnabled && (
        <View style={[styles.card, styles.disableCard]}>
          <Text style={styles.disableTitle}>Disable Two-Step Verification</Text>
          <Text style={styles.cardHint}>Requires a current code first — this can't be turned off with just a tap.</Text>
          <TextInput
            style={[styles.input, { marginTop: spacing.sm }]}
            value={disableCode}
            onChangeText={setDisableCode}
            placeholder="Current code"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.disableButton} onPress={disable} disabled={busy === 'disable'}>
            {busy === 'disable' ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.disableButtonText}>Disable</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  loadingRoot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 12, fontFamily: fonts.sans, color: colors.textSecondary, lineHeight: 17 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  card: { ...glassCard, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  cardHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 16 },
  badge: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.success, textTransform: 'uppercase' },
  actionButton: { marginTop: spacing.md, backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  actionButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  qrImage: { width: 160, height: 160, backgroundColor: '#fff', borderRadius: radius.md, alignSelf: 'center' },
  secretText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  recoveryCard: { marginTop: spacing.lg, backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' },
  recoveryTitle: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.warning, textTransform: 'uppercase' },
  recoveryHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  recoveryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, gap: spacing.sm },
  recoveryCode: { fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary, width: '45%' },
  linkRow: { marginTop: spacing.sm },
  recoveryLink: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.warning, textTransform: 'uppercase' },
  disableCard: { marginTop: spacing.lg, backgroundColor: 'rgba(248,113,113,0.05)', borderColor: 'rgba(248,113,113,0.2)' },
  disableTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.danger },
  disableButton: { marginTop: spacing.sm, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  disableButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.danger, textTransform: 'uppercase', letterSpacing: 0.5 },
});
