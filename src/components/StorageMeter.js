// src/components/StorageMeter.js
//
// Storage utilization widget — "Storage Used: X GB / Y". The used figure is
// a real client-side sum of this device's upload history (see
// useUploadsHistory.js); the allocated figure is a placeholder until a real
// per-wallet storage-quota API exists (Custody has no such concept on-chain,
// and no quota backend has been built yet) — documented here rather than
// silently presented as if it were real account-level data.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, glassCard, spacing, radius, fonts } from '../theme';

const ALLOCATED_BYTES_PLACEHOLDER = 1_000_000_000_000; // 1 TB — placeholder, no real per-wallet quota API exists yet

function formatBytes(bytes) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function StorageMeter({ usedBytes = 0, allocatedBytes = ALLOCATED_BYTES_PLACEHOLDER, style }) {
  const pct = allocatedBytes > 0 ? Math.min(100, (usedBytes / allocatedBytes) * 100) : 0;

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>Storage Used</Text>
      <Text style={styles.value}>
        {formatBytes(usedBytes)} <Text style={styles.valueMuted}>/ {formatBytes(allocatedBytes)}</Text>
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.pct}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...glassCard, padding: spacing.lg },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  value: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.md },
  valueMuted: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 13 },
  track: { height: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.cyan },
  pct: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },
});
