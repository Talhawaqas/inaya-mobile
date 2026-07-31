// src/screens/NodeStatusScreen.js
//
// Watcher Node status screen. IMPORTANT — this is Phase 1 UI only; the
// actual background-check engine (Phase 3) isn't wired in yet, and per
// the design note flagged to Talha, iOS can't run a true always-on
// background pinger. This screen is built to show either state honestly:
// "Watcher Active" (checks ran recently) or "Watcher Idle" (app hasn't
// had a background opportunity), rather than pretending constant uptime.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function NodeStatusScreen() {
  // Placeholder state — Phase 3 wires this to real check-in history,
  // read from either local storage (opportunistic background checks)
  // or a server-side record (if using the push-triggered check-in model).
  const watcherStatus = 'idle'; // 'active' | 'idle' | 'never_run'
  const lastCheckIn = null;
  const uptimeScore = null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Watcher Node</Text>
      <Text style={styles.subtitle}>
        Verifies shard availability in the background and earns $INAYA based on uptime proofs.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>STATUS</Text>
        <Text style={[styles.statusValue, watcherStatus === 'active' ? styles.statusActive : styles.statusIdle]}>
          {watcherStatus === 'active' ? '● Active' : watcherStatus === 'idle' ? '○ Idle' : '— Never Run'}
        </Text>
        <Text style={styles.cardSub}>
          {lastCheckIn ? `Last check-in: ${lastCheckIn}` : 'No check-ins recorded yet.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>UPTIME SCORE</Text>
        <Text style={styles.cardValue}>{uptimeScore ?? '—'}</Text>
        <Text style={styles.cardSub}>Determines your share of Swarm Reserve emissions.</Text>
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          Background execution on mobile is opportunistic, not guaranteed — this is a platform
          constraint (especially on iOS), not a bug. Keep the app installed and occasionally opened
          for the most consistent check-in history.
        </Text>
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
  cardLabel: { fontSize: 10, color: '#22d3d0', fontWeight: '700', letterSpacing: 1.5 },
  cardValue: { fontSize: 20, color: '#fff', fontWeight: '800', marginTop: 6 },
  cardSub: { fontSize: 11, color: '#64748b', marginTop: 6 },
  statusValue: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  statusActive: { color: '#34d399' },
  statusIdle: { color: '#f59e0b' },
  noteBox: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.4)', borderWidth: 1, borderRadius: 10, padding: 14 },
  noteText: { color: '#fbbf24', fontSize: 11.5, lineHeight: 17 },
});