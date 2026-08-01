// src/screens/NodeStatusScreen.js
//
// Watcher Node status — mirrors the web dApp's "Node Identity" sidebar card
// and "RPC Connection Status" / "Wallet Core Status" home tiles (page.js).
// This is wallet-connection + signature verification only, same as the web
// dApp: no backend node registry, no capacity/heartbeat, no uptime scoring —
// the inaya-network-dapp backend has a separate Mongo-backed node-operator
// system (/api/nodes/*) for that, but nothing on the web dApp's own frontend
// calls it either, so there's no live behavior to match there.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useWallet } from '../providers/WalletProvider';
import { colors, spacing, radius, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import StatusDot from '../components/StatusDot';

export default function NodeStatusScreen() {
  const { address, isConnected, connecting, connect, isSignedUp, isSigning, signUp } = useWallet();
  const [signUpError, setSignUpError] = React.useState('');

  async function handleSignUp() {
    setSignUpError('');
    try {
      await signUp();
    } catch (err) {
      setSignUpError(err?.message || 'Sign-up failed.');
    }
  }

  // Matches page.js exactly: isConnected ? (isSignedUp ? "ACTIVE_NODE" : "UNVERIFIED_SIGNUP") : "WAITING_AUTH"
  const statusLabel = !isConnected ? 'IDLE' : isSignedUp ? 'LIVE — VERIFIED' : 'LIVE — UNVERIFIED';
  const statusColor = !isConnected ? colors.textMuted : isSignedUp ? colors.success : colors.warning;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Watcher Node</Text>
      <Text style={styles.subtitle}>
        Connect and verify your wallet to activate this device as a node on the Inaya Network.
      </Text>

      <View style={styles.card}>
        <View style={styles.statusHeader}>
          <StatusDot active={isConnected} color={isSignedUp ? colors.success : colors.warning} />
          <Text style={styles.cardLabel}>NODE STATUS</Text>
        </View>
        <Text style={[styles.statusValue, { color: statusColor }]}>{statusLabel}</Text>
        <Text style={styles.cardSub}>
          {!isConnected
            ? 'Connect your wallet to activate this node.'
            : isSignedUp
            ? 'Node identity verified for this session.'
            : 'Wallet connected — sign the verification message to complete sign-up.'}
        </Text>
      </View>

      {!isConnected && (
        <GradientButton
          title="Connect Wallet"
          onPress={connect}
          loading={connecting}
          style={styles.actionButton}
        />
      )}

      {isConnected && !isSignedUp && (
        <GradientButton
          title="📝 Complete Sign-Up (Verify Node)"
          onPress={handleSignUp}
          loading={isSigning}
          variant="warning"
          style={styles.actionButton}
        />
      )}
      {!!signUpError && <Text style={styles.errorText}>❌ {signUpError}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>WALLET</Text>
        <Text style={styles.cardValue}>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '—'}</Text>
        <Text style={styles.cardSub}>Wallet Core Status</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + 8 },
  title: { fontSize: 24, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { fontSize: 13, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardLabel: { fontSize: 10, fontFamily: fonts.sansBold, color: colors.cyan, letterSpacing: 1.5 },
  cardValue: { fontSize: 18, fontFamily: fonts.monoBold, color: colors.textPrimary, marginTop: spacing.sm },
  cardSub: { fontSize: 11, fontFamily: fonts.sans, color: colors.textMuted, marginTop: spacing.sm },
  statusValue: { fontSize: 18, fontFamily: fonts.monoBold, marginTop: spacing.md },
  actionButton: { marginBottom: spacing.lg },
  errorText: { color: colors.danger, fontSize: 11, marginBottom: spacing.lg, textAlign: 'center', fontFamily: fonts.mono },
});
