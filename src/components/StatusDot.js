// src/components/StatusDot.js
//
// Small glowing status dot — mirrors the web dApp's Node Authentication
// indicator (w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]).

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, glow } from '../theme';

export default function StatusDot({ active, color = colors.success, style }) {
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: active ? color : colors.textMuted },
        active && glow(color, 0.9, 4),
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4 },
});
