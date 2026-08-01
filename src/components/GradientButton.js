// src/components/GradientButton.js
//
// Primary CTA — cyan->blue gradient with a glow shadow, mirrors the web
// dApp's "Try the Encrypted Vault" / "Complete Sign-Up" buttons
// (bg-gradient-to-r from-[#00f2fe] to-[#4facfe] + shadow glow).

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, spacing, radius, fonts, glow } from '../theme';

export default function GradientButton({ title, onPress, disabled, loading, variant = 'accent', style }) {
  const gradientColors = variant === 'warning' ? gradients.warning : gradients.accent;
  const glowColor = variant === 'warning' ? colors.warning : colors.cyan;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.button, !disabled && glow(glowColor, 0.35, 14)]}
      >
        {loading ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.text}>{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.bg,
    fontFamily: fonts.sansExtraBold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  disabled: { opacity: 0.4 },
});
