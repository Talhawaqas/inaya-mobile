// src/components/SegmentedToggle.js
//
// Sleek horizontal toggle group — replaces plain button rows/dropdowns for
// choice sets like the Staking screen's lock tier (Flexible/30 Days/90 Days).

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, fonts, glow } from '../theme';

export default function SegmentedToggle({ options, value, onChange, style }) {
  return (
    <View style={[styles.row, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.8}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive, active && glow(colors.cyan, 0.3, 8)]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
            {!!opt.sublabel && <Text style={[styles.sublabel, active && styles.sublabelActive]}>{opt.sublabel}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  segmentActive: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  label: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textSecondary },
  labelActive: { color: colors.bg },
  sublabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  sublabelActive: { color: 'rgba(6,9,19,0.7)' },
});
