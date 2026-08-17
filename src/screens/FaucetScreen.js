// src/screens/FaucetScreen.js
//
// Mobile port of the web dApp's "Faucet" tab (page.js) — same backend
// (POST /api/faucet), same drip amounts and sufficiency-skip behavior, same
// copy. The route is stateless and treasury-signed server-side, so this
// screen only needs the connected wallet address, no on-chain signing.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../providers/WalletProvider';
import { colors, spacing, radius, fonts, glassCard } from '../theme';
import { openExternalLink } from '../utils/appLockSuspend';

const API_BASE = 'https://www.inayanetwork.com';
const GAS_FAUCET_URL = 'https://faucet.zalalena.com/bsc';

export default function FaucetScreen() {
  const insets = useSafeAreaInsets();
  const { address, isConnected, connecting, connect } = useWallet();
  const [isFauceting, setIsFauceting] = useState(false);
  const [faucetLog, setFaucetLog] = useState('');

  async function handleFaucetRequest() {
    if (!isConnected || !address) return;
    setIsFauceting(true);
    setFaucetLog('📡 Requesting test tokens from the Inaya faucet...');
    try {
      const res = await fetch(`${API_BASE}/api/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Faucet request failed.');
      const lines = [
        data.results.inaya.sent ? `✅ Sent ${data.results.inaya.amount} $INAYA` : `ℹ️ $INAYA: ${data.results.inaya.reason}`,
        data.results.usdt.sent ? `✅ Sent ${data.results.usdt.amount} mUSDT` : `ℹ️ mUSDT: ${data.results.usdt.reason}`,
      ];
      setFaucetLog(lines.join('\n'));
    } catch (err) {
      setFaucetLog(`❌ Faucet request failed: ${err.message}`);
    } finally {
      setIsFauceting(false);
    }
  }

  const insetsBottom = insets.bottom + spacing.xxxl;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insetsBottom }]}>
      <Text style={styles.title}>🚰 Testnet Token Faucet</Text>
      <Text style={styles.subtitle}>
        Get free test $INAYA and mUSDT to try the dual-asset upload flow — no real value, BNB Chain Testnet only.
      </Text>

      {!isConnected ? (
        <TouchableOpacity style={[styles.button, { marginTop: spacing.lg }]} onPress={connect} disabled={connecting}>
          {connecting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Connect Wallet</Text>}
        </TouchableOpacity>
      ) : (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: colors.success }]}>500</Text>
              <Text style={styles.statLabel}>$INAYA per request</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: colors.cyan }]}>100</Text>
              <Text style={styles.statLabel}>mUSDT per request</Text>
            </View>
          </View>

          {!!faucetLog && (
            <View style={styles.logBox}>
              <Text style={styles.logText}>{faucetLog}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, isFauceting && styles.buttonDisabled, { marginTop: spacing.md }]}
            onPress={handleFaucetRequest}
            disabled={isFauceting}
          >
            {isFauceting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Request Test Tokens</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>
            The faucet skips a token if your wallet already holds enough for testing — this keeps the treasury available for everyone.
          </Text>
        </View>
      )}

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.gasTitle}>⛽ Need gas (tBNB) too?</Text>
        <Text style={styles.gasHint}>This faucet only covers $INAYA and mUSDT.</Text>
        <TouchableOpacity onPress={() => openExternalLink(GAS_FAUCET_URL)}>
          <Text style={styles.gasLink}>Get free testnet BNB here: {GAS_FAUCET_URL} ↗</Text>
        </TouchableOpacity>
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
  statsGrid: { flexDirection: 'row', gap: spacing.md },
  statCell: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  statValue: { fontFamily: fonts.sansExtraBold, fontSize: 24, color: colors.textPrimary },
  statLabel: { fontFamily: fonts.sansMedium, fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, textAlign: 'center' },
  logBox: {
    marginTop: spacing.md, backgroundColor: 'rgba(0,242,254,0.06)', borderWidth: 1, borderColor: 'rgba(0,242,254,0.2)',
    borderRadius: radius.md, padding: spacing.md,
  },
  logText: { fontFamily: fonts.mono, fontSize: 11, color: colors.cyan, lineHeight: 16 },
  button: {
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  hint: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 14 },
  gasTitle: { fontFamily: fonts.sansBold, fontSize: 12, color: '#fbbf24' },
  gasHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  gasLink: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.cyan, marginTop: spacing.sm },
});
