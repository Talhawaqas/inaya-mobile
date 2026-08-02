// src/components/ActionTile.js
//
// One glowing tile in the dashboard's 3x2 action grid (Upload/Download/
// My Files/Watcher Node/Staking/Dashboard) — icon + label, routes via the
// onPress the screen passes in (see StorageDashboardScreen.js).

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, glassCard, spacing, radius, fonts, glow } from '../theme';

export default function ActionTile({ icon, label, onPress, style }) {
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={[styles.tile, style]}>
      <Ionicons name={icon} size={22} color={colors.cyan} style={styles.icon} />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    ...glassCard,
    ...glow(colors.cyan, 0.12, 12),
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  icon: {
    textShadowColor: 'rgba(0,242,254,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
