// src/screens/business/MfaVerifyScreen.js
//
// Login-time second-factor entry — rendered by BusinessAuthScreen instead
// of the normal sign-in form once primary auth (magic link or Google)
// succeeds AND the account has MFA enrolled (mfaRequired in the
// consume-token/google response). Same backend as web
// (inaya-network-dapp's /api/orgs/mfa/*) — POST /api/orgs/mfa/verify
// accepts a TOTP code, a Firebase Phone Auth ID token, or a recovery code
// and, on success, returns a real sessionToken in its JSON body (not just
// a cookie mobile can't read — see orgApi.js's header comment for why
// mobile always needs the token itself). Server-side rate limiting (5
// attempts) means this screen just relays whatever error comes back.
//
// "Verify via Web" reuses the exact same bounce mechanism as
// MfaSettingsScreen's enrollment button and BusinessAuthScreen's
// GoogleSignInButton — opens the web app's /mfa/phone-auth page (a real
// browser context is what Firebase's client SDK + invisible reCAPTCHA
// need), which bounces back into the app with a signed ID token that's
// submitted here as the "code" itself.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';
import { suspendAppLock, resumeAppLock } from '../../utils/appLockSuspend';

const PHONE_AUTH_URL = 'https://www.inayanetwork.com/mfa/phone-auth';
const APP_PHONE_BOUNCE_PREFIX = 'inayamobile://mfa-phone-bounce';

function extractIdTokenFromUrl(url) {
  const match = url.match(/[#&]idToken=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function extractStateFromUrl(url) {
  const match = url.match(/[#&]state=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// SECURITY: see MfaSettingsScreen.js's identical comment -- inayamobile://
// isn't exclusive to this app, so a nonce generated per attempt and echoed
// back by the bounce page is what makes an unsolicited/spoofed deep link
// (carrying an attacker's own Firebase-verified phone idToken) rejectable
// here, rather than being submitted to /api/orgs/mfa/verify unconditionally.
function generateNonce() {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
}

export default function MfaVerifyScreen({ mfaPendingToken, onVerified, onCancel }) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const handledRef = useRef(false);
  const pendingStateRef = useRef(null);

  useEffect(() => {
    const handler = ({ url }) => {
      if (!url || !url.startsWith(APP_PHONE_BOUNCE_PREFIX)) return;
      const inboundState = extractStateFromUrl(url);
      if (!pendingStateRef.current || inboundState !== pendingStateRef.current) {
        setError('Phone verification failed.');
        return;
      }
      pendingStateRef.current = null; // one-shot -- a replayed/duplicate callback shouldn't match again
      const idToken = extractIdTokenFromUrl(url);
      if (idToken) {
        submitCode(idToken);
      } else {
        setError('Phone verification failed.');
      }
    };
    const sub = Linking.addEventListener('url', handler);
    return () => sub.remove();
  }, []);

  async function submitCode(rawCode) {
    if (handledRef.current) return;
    handledRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const data = await orgFetch('/api/orgs/mfa/verify', { method: 'POST', body: { mfaPendingToken, code: rawCode } });
      await onVerified(data.sessionToken);
    } catch (err) {
      setError(err.message || 'Could not verify.');
    } finally {
      setSubmitting(false);
      handledRef.current = false;
      resumeAppLock();
    }
  }

  function handleVerify() {
    if (!code.trim()) return;
    submitCode(code.trim());
  }

  function handlePhoneVerify() {
    setError('');
    suspendAppLock();
    const nonce = generateNonce();
    pendingStateRef.current = nonce;
    WebBrowser.openBrowserAsync(`${PHONE_AUTH_URL}?callback=${encodeURIComponent(APP_PHONE_BOUNCE_PREFIX)}&state=${encodeURIComponent(nonce)}`);
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

        <TouchableOpacity style={styles.linkRow} onPress={handlePhoneVerify} disabled={submitting}>
          <Text style={styles.linkText}>Verify by phone instead</Text>
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
});
