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
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useWallet } from '../providers/WalletProvider';

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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Watcher Node</Text>
      <Text style={styles.subtitle}>
        Connect and verify your wallet to activate this device as a node on the Inaya Network.
      </Text>

      <View style={styles.card}>
        <View style={styles.statusHeader}>
          <View style={[styles.dot, isConnected ? styles.dotLive : styles.dotIdle]} />
          <Text style={styles.cardLabel}>NODE STATUS</Text>
        </View>
        <Text
          style={[
            styles.statusValue,
            !isConnected ? styles.statusIdle : isSignedUp ? styles.statusActive : styles.statusUnverified,
          ]}
        >
          {statusLabel}
        </Text>
        <Text style={styles.cardSub}>
          {!isConnected
            ? 'Connect your wallet to activate this node.'
            : isSignedUp
            ? 'Node identity verified for this session.'
            : 'Wallet connected — sign the verification message to complete sign-up.'}
        </Text>
      </View>

      {!isConnected && (
        <TouchableOpacity style={styles.actionButton} onPress={connect} disabled={connecting}>
          {connecting ? (
            <ActivityIndicator color="#0a0e14" />
          ) : (
            <Text style={styles.actionButtonText}>Connect Wallet</Text>
          )}
        </TouchableOpacity>
      )}

      {isConnected && !isSignedUp && (
        <TouchableOpacity style={styles.actionButton} onPress={handleSignUp} disabled={isSigning}>
          {isSigning ? (
            <ActivityIndicator color="#0a0e14" />
          ) : (
            <Text style={styles.actionButtonText}>📝 Complete Sign-Up (Verify Node)</Text>
          )}
        </TouchableOpacity>
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
  root: { flex: 1, backgroundColor: '#0a0e14' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 8 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 20, lineHeight: 18 },
  card: { backgroundColor: '#111c33', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1c2a38', marginBottom: 16 },
  statusHeader: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  dotLive: { backgroundColor: '#34d399' },
  dotIdle: { backgroundColor: '#64748b' },
  cardLabel: { fontSize: 10, color: '#22d3d0', fontWeight: '700', letterSpacing: 1.5 },
  cardValue: { fontSize: 18, color: '#fff', fontWeight: '800', marginTop: 6 },
  cardSub: { fontSize: 11, color: '#64748b', marginTop: 6 },
  statusValue: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  statusActive: { color: '#34d399' },
  statusUnverified: { color: '#f59e0b' },
  statusIdle: { color: '#64748b' },
  actionButton: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  actionButtonText: { color: '#0a0e14', fontWeight: '800', fontSize: 13 },
  errorText: { color: '#ff8080', fontSize: 11, marginBottom: 16, textAlign: 'center' },
});
