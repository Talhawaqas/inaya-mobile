// src/screens/SettingsScreen.js
//
// App-level settings, reachable from the main drawer without needing a
// Business Workspace session — currently just the biometric app-unlock
// toggle. It used to live inside Business Workspace's OrgHomeScreen, but
// the gate it controls (App.js's AppLockGate) has always applied to the
// WHOLE app, not just that section, so requiring a Workspace sign-in just
// to turn it on was a mismatch — moved here per user feedback so anyone
// can enable it regardless of whether they use Business Workspace at all.

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../theme';
import { isBiometricAvailable, getBiometricEnabled, setBiometricEnabled } from '../utils/biometric';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  // Hidden entirely on a device with no Face ID/fingerprint enrolled —
  // never show a toggle for a capability that isn't there.
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);
      if (available) setBiometricEnabledState(await getBiometricEnabled());
      setChecking(false);
    })();
  }, []);

  async function toggleBiometric(value) {
    setBiometricEnabledState(value);
    await setBiometricEnabled(value);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>Settings</Text>

      {!checking && (
        <View style={[styles.card, styles.row, { marginTop: spacing.lg }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Biometric unlock</Text>
            <Text style={styles.rowHint}>
              {biometricAvailable
                ? 'Require Face ID / fingerprint to open the app'
                : 'Not available — no Face ID / fingerprint enrolled on this device'}
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={toggleBiometric}
            disabled={!biometricAvailable}
            trackColor={{ true: colors.cyan }}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: 20, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, letterSpacing: 0.5 },
  card: { ...glassCard, padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  rowHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
});
