// src/components/GlassCard.js
//
// The shared "premium card" surface for V2 — translucent background, subtle
// border, soft shadow (see theme.js's glassCard for why this stands in for
// a real backdrop blur). Used for the Wallet Balance card, dashboard stat
// cards, and the Staking screen's metric cards.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { glassCard, spacing } from '../theme';

export default function GlassCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    ...glassCard,
    padding: spacing.lg,
  },
});
