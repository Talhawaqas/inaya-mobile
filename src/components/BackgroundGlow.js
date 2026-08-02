// src/components/BackgroundGlow.js
//
// The "dark spatial theme" ambiance from the V2 design brief — soft glow
// circles positioned behind screen content, not a real nebula/starfield
// image (no asset budget for that) and not a blurred backdrop (see
// theme.js's note on why expo-blur was skipped). Absolutely-positioned,
// heavily-shadowed circles read as ambient glow on a near-black background
// without any extra native dependency.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function BackgroundGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.orb, styles.orbCyan]} />
      <View style={[styles.orb, styles.orbViolet]} />
      <View style={[styles.orb, styles.orbBlue]} />
    </View>
  );
}

const orbShadow = (color) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.5,
  shadowRadius: 80,
  elevation: 0,
});

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.16,
  },
  orbCyan: { top: -60, right: -60, backgroundColor: colors.cyan, ...orbShadow(colors.cyan) },
  orbViolet: { top: 220, left: -90, backgroundColor: colors.violet, ...orbShadow(colors.violet) },
  orbBlue: { bottom: -80, right: -40, backgroundColor: colors.blue, ...orbShadow(colors.blue) },
});
