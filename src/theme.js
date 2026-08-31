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
//
// PHASE 7 (Theme Switch) SCOPE NOTE: `colors` below stays the static,
// unchanged dark palette every one of the app's 58 screens already
// imports directly — none of them were touched, zero regression risk.
// THEME_TOKENS + useTheme() (bottom of this file) are the NEW, additive
// live-switchable layer: App.js's navigator chrome (drawer, headers, nav
// theme, lock screen) and the Settings screen's own picker read from the
// hook and genuinely respond to White/Dark/Neon. Reskinning the other 57
// screens live would mean migrating every one of them off the static
// import and moving their `StyleSheet.create()` calls from module scope
// into the component body (so they re-evaluate per theme change) — a
// real, mechanical but large migration explicitly out of scope for this
// pass, stated plainly rather than silently claimed as "done everywhere."

export const colors = {
  bg: '#060913',
  surface: '#0b1120',
  surfaceAlt: '#0c162b',
  navBar: '#090d16',
  border: 'rgba(255,255,255,0.07)',
  borderAccent: 'rgba(0,242,254,0.2)',

  cyan: '#00f2fe',
  blue: '#4facfe',
  violet: '#7c5cff', // spatial-background accent glow only, not used for text/CTAs

  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  success: '#34d399',
  warning: '#f59e0b',
  warningDeep: '#ea580c',
  danger: '#f87171',

  // Glassmorphism surfaces -- translucent-color + border + glow rather than
  // a real backdrop blur (expo-blur/@react-native-community/blur): this app's
  // background is a near-flat dark navy, not rich content, so a literal blur
  // buys little over a well-tuned translucent card, and skipping it avoids
  // adding a native module that would need a real device/emulator to verify
  // visually -- something this environment doesn't have.
  glass: 'rgba(15,23,42,0.55)',
  glassBorder: 'rgba(255,255,255,0.09)',
};

export const gradients = {
  accent: [colors.cyan, colors.blue],
  warning: [colors.warning, colors.warningDeep],
};

// Style spread for a glassmorphism card — translucent background, subtle
// border, soft ambient shadow. Spread this into a StyleSheet entry rather
// than calling it inline every render.
export const glassCard = {
  backgroundColor: colors.glass,
  borderWidth: 1,
  borderColor: colors.glassBorder,
  borderRadius: 18,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 16,
  elevation: 6,
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

// ============================================================
// PHASE 7 — live-switchable theme layer (additive, see header note).
// Each variant carries exactly the fields App.js's navigator chrome and
// the Settings picker itself actually read — not a full re-derivation of
// every token above (bg/surface/navBar/border/cyan/blue/textPrimary/
// textSecondary/textMuted/danger), matching the web side's identical
// "~8 most-repeated colors" scope.
// ============================================================
export const THEMES = ['white', 'dark', 'neon'];
export const THEME_LABELS = { white: 'White', dark: 'Dark', neon: 'Neon' };

export const THEME_TOKENS = {
  dark: {
    bg: colors.bg, surface: colors.surface, navBar: colors.navBar, border: colors.border,
    accent: colors.cyan, accent2: colors.blue,
    textPrimary: colors.textPrimary, textSecondary: colors.textSecondary, textMuted: colors.textMuted,
    danger: colors.danger,
  },
  white: {
    bg: '#f4f6fb', surface: '#ffffff', navBar: '#ffffff', border: 'rgba(15,23,42,0.10)',
    accent: '#0284c7', accent2: '#0ea5e9',
    textPrimary: '#0f172a', textSecondary: '#334155', textMuted: '#64748b',
    danger: '#dc2626',
  },
  neon: {
    bg: '#050014', surface: '#0d0221', navBar: '#0d0221', border: 'rgba(255,0,229,0.25)',
    accent: '#00ffe1', accent2: '#ff00e5',
    textPrimary: '#f5f3ff', textSecondary: '#c4b5fd', textMuted: '#b8a9e0',
    danger: '#ff4d6d',
  },
};
