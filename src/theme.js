// src/theme.js
//
// Shared design tokens — ported from the web dApp's actual palette
// (inaya-network-dapp/src/app/page.js: deep navy surfaces, cyan->blue
// gradient accent, Geist Sans/Mono typography) so the Android app reads
// as the same product instead of a generic dark-mode template.
// Font family names below refer to @expo-google-fonts/inter and
// @expo-google-fonts/jetbrains-mono, loaded once via useFonts() in App.js —
// Inter/JetBrains Mono stand in for Geist Sans/Mono, which aren't
// distributed as loadable font files for React Native.

export const colors = {
  bg: '#060913',
  surface: '#0b1120',
  surfaceAlt: '#0c162b',
  navBar: '#090d16',
  border: 'rgba(255,255,255,0.07)',
  borderAccent: 'rgba(0,242,254,0.2)',

  cyan: '#00f2fe',
  blue: '#4facfe',

  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  success: '#34d399',
  warning: '#f59e0b',
  warningDeep: '#ea580c',
  danger: '#f87171',
};

export const gradients = {
  accent: [colors.cyan, colors.blue],
  warning: [colors.warning, colors.warningDeep],
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const radius = { sm: 10, md: 14, lg: 18, xl: 22, full: 999 };

export const fonts = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  sansExtraBold: 'Inter_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
};

// RN shadow props (iOS) + elevation (Android) approximating the web
// version's `shadow-[0_0_20px_rgba(0,242,254,0.25)]` CTA glow.
export const glow = (color = colors.cyan, opacity = 0.35, radiusPx = 16) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: opacity,
  shadowRadius: radiusPx,
  elevation: 8,
});
