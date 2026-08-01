// src/components/StatTile.js
//
// Left-border-accent stat tile — mirrors the web dApp's home-panel tiles
// (bg-[#0b1120]/40 border-l-4 border-[#00f2fe]), used for "Wallet Core
// Status" / "RPC Connection Status" style readouts.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, fonts } from '../theme';

export default function StatTile({ label, value, valueColor, style }) {
  return (
    <View style={[styles.tile, style]}>
      <Text style={[styles.value, valueColor && { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: 'rgba(11,17,32,0.6)',
    borderLeftWidth: 3,
    borderLeftColor: colors.cyan,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  value: {
    fontFamily: fonts.monoBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: spacing.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
