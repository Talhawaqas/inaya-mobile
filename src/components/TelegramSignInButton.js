// src/components/TelegramSignInButton.js
//
// "Continue with Telegram" for the Watcher Pioneer Program. Flow: ask the server for a one-time link, open the Inaya bot in Telegram, then
// poll until the person has pressed Start and confirmed (Yes) in the bot chat. The server hands back a session token exactly once.
// Hidden unless the server has Telegram sign-in configured, so nothing changes for anyone until that is set up.

import React, { useState, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing, radius, fonts } from '../theme';
import { isTelegramSignInEnabled, startTelegramLogin, pollTelegramLogin } from '../utils/watcherApi';
import { openExternalLink } from '../utils/appLockSuspend';

const POLL_MS = 2000;
const GIVE_UP_MS = 10 * 60 * 1000; // matches the server's login-code lifetime

export default function TelegramSignInButton({ onLogin, label = 'Continue with Telegram' }) {
  const [enabled, setEnabled] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; isTelegramSignInEnabled().then((v) => alive.current && setEnabled(v)); return () => { alive.current = false; if (timer.current) clearInterval(timer.current); }; }, []);

  function stop() { if (timer.current) clearInterval(timer.current); timer.current = null; setWaiting(false); }

  async function begin() {
    setError(''); setWaiting(true);
    try {
      const { code, url } = await startTelegramLogin();
      openExternalLink(url);
      const startedAt = Date.now();
      timer.current = setInterval(async () => {
        if (Date.now() - startedAt > GIVE_UP_MS) { stop(); setError('That sign-in timed out. Please try again.'); return; }
        try {
          const r = await pollTelegramLogin(code);
          if (!alive.current) return;
          if (r.status === 'ready') { stop(); await onLogin({ provider: 'telegram', idToken: r.token, subject: r.subject, name: r.name }); }
          else if (r.status === 'denied') { stop(); setError('You chose No in Telegram, so nobody was signed in.'); }
          else if (r.status === 'expired') { stop(); setError('That sign-in expired. Please try again.'); }
        } catch { /* a brief network blip: keep polling until the timeout */ }
      }, POLL_MS);
    } catch (err) { stop(); setError(err.message || 'Could not start Telegram sign-in.'); }
  }

  if (!enabled) return null;
  return (
    <View>
      <TouchableOpacity style={[styles.button, waiting && styles.disabled]} onPress={waiting ? stop : begin}>
        {waiting ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.text}>{label}</Text>}
      </TouchableOpacity>
      {waiting && <Text style={styles.hint}>Open Telegram, press Start, then tap "Yes, sign me in". Tap here to cancel.</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  text: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary },
  disabled: { opacity: 0.7 },
  hint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
});
