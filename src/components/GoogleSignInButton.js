// src/components/GoogleSignInButton.js
//
// "Continue with Google" for flows that need a Google ID token (the Watcher Pioneer Program's social login). This deliberately mirrors the
// proven GoogleSignInButton inside screens/business/BusinessAuthScreen.js (same Web client ID, same https redirect page that bounces into the
// app, same deep-link + state-nonce handling, same app-lock suspension) rather than refactoring that screen, so Business Workspace sign-in is
// not touched by this feature. If the redirect flow there ever changes, change both: read that file's comments for WHY each part exists.
//
// Mounted only when a client ID is configured (the hook throws at call time without one), see isGoogleSignInConfigured().

import React, { useState, useEffect, useRef } from 'react';
import { Platform, Text, TouchableOpacity, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { colors, spacing, radius, fonts } from '../theme';
import { suspendAppLock, resumeAppLock } from '../utils/appLockSuspend';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const REDIRECT_URI = 'https://www.inayanetwork.com/oauth2redirect';
const APP_REDIRECT_PREFIX = 'inayamobile://oauth2redirect';

export const isGoogleSignInConfigured = () => !!Platform.select({ web: GOOGLE_WEB_CLIENT_ID, android: GOOGLE_WEB_CLIENT_ID, ios: GOOGLE_WEB_CLIENT_ID });

const extractIdTokenFromUrl = (url) => { const m = url.match(/[#&]id_token=([^&]+)/); return m ? decodeURIComponent(m[1]) : null; };
// SECURITY (see BusinessAuthScreen): inayamobile:// is not exclusive to this app, so a deep link is only accepted if its `state` is the nonce of the
// request THIS app is waiting on; otherwise a stranger's token could sign the user into the stranger's account.
const extractStateFromUrl = (url) => { const m = url.match(/[#&]state=([^&]+)/); return m ? decodeURIComponent(m[1]) : null; };

export default function GoogleSignInButton({ onIdToken, label = 'Continue with Google' }) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID, androidClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri: REDIRECT_URI, responseType: 'id_token',
  });
  const handledRef = useRef(false);

  useEffect(() => {
    // web path: expo-auth-session has already verified `state` before reporting success
    if (response?.type === 'success' && response.params?.id_token) handleIdToken(response.params.id_token);
    else if (response?.type === 'error') setError('Google sign-in failed.');
  }, [response]);

  useEffect(() => {
    // native path: the redirect completes by reopening the app through its own scheme
    const handler = ({ url }) => {
      if (!url || !url.startsWith(APP_REDIRECT_PREFIX)) return;
      if (!request?.state || extractStateFromUrl(url) !== request.state) { setError('Google sign-in failed.'); return; }
      const idToken = extractIdTokenFromUrl(url);
      if (idToken) handleIdToken(idToken); else setError('Google sign-in failed.');
    };
    const sub = Linking.addEventListener('url', handler);
    return () => sub.remove();
  }, [request]);

  async function handleIdToken(idToken) {
    if (handledRef.current) return;
    handledRef.current = true;
    setRequesting(true); setError('');
    try { await onIdToken(idToken); }
    catch (err) { setError(err.message || 'Could not sign in with Google.'); }
    finally { setRequesting(false); handledRef.current = false; resumeAppLock(); }
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.googleButton, (requesting || !request) && styles.buttonDisabled]}
        onPress={() => { suspendAppLock(); promptAsync(); }} // the browser backgrounds the app; without this the app lock would fire and unmount the sign-in
        disabled={requesting || !request}
      >
        {requesting ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.googleButtonText}>{label}</Text>}
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  googleButton: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  googleButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary },
  buttonDisabled: { opacity: 0.4 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
});
