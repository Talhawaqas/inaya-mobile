// src/providers/ThemeProvider.js
//
// Phase 7 (Theme Switch) — one shared context at the app root (same
// "single source of truth" reasoning as CardCustomerProvider.js) so
// App.js's navigator chrome and SettingsScreen's picker read/write the
// same live value. Persisted via AsyncStorage, same mechanism the web
// side uses localStorage for — mirrors src/lib/theme.js's THEME_STORAGE_KEY
// naming on the web app, just namespaced for mobile.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, THEME_TOKENS } from '../theme';

const THEME_STORAGE_KEY = 'inaya_theme';
const ThemeContext = createContext({ theme: 'dark', tokens: THEME_TOKENS.dark, setTheme: () => {} });

export function ThemeProviderRoot({ children }) {
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored && THEMES.includes(stored)) setThemeState(stored);
      } catch {
        // Fall back to the default dark theme — same tolerant handling
        // every other AsyncStorage read in this app already uses.
      }
    })();
  }, []);

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    setThemeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }, []);

  const tokens = THEME_TOKENS[theme] || THEME_TOKENS.dark;
  return <ThemeContext.Provider value={{ theme, tokens, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
