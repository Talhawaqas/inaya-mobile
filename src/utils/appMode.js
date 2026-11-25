// src/utils/appMode.js -- which part of Inaya this phone shows (co-founder request, 25 Nov 2026).
//   business  Inaya Business OS only (company home, My jobs, modules), plus Meet, Learn, Knowledge Base and Settings
//   network   Inaya Network (storage dashboard, wallet, staking, bridge, faucet, Watcher, referrals, white paper...)
//   all       everything, the way the app worked before this choice existed
// New installs are asked once on first open. Existing users (owner decision) keep "all" unless they change it in
// Settings. The Google Play edition is unchanged and always shows its usual menu.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { PLAY_EDITION } from './edition';

export const MODES = ['business', 'network', 'all'];
const KEY = 'inaya.appMode.v1';
const listeners = new Set();

/** Drawer screens per mode (names from App.js). */
export const SCREENS_FOR = {
  business: ['Workspace', 'Meet', 'Learn', 'KnowledgeBase', 'Settings'],
  network: ['Home', 'Faucet', 'Business', 'SaaSRoadmap', 'Staking', 'Bridge', 'Dashboard', 'WhitePaper', 'KnowledgeBase', 'AIAssistant', 'Referrals', 'WatcherPioneer', 'Meet', 'Notifications', 'Learn', 'Security', 'Settings'],
};
export const visibleScreen = (mode, name) => mode === 'all' || !SCREENS_FOR[mode] || SCREENS_FOR[mode].includes(name);
export const firstScreen = (mode) => (mode === 'business' ? 'Workspace' : 'Home');

async function hasUsedAppBefore() {
  // Set by every earlier launch (activity ping) or by a Business OS sign-in.
  try { if (await AsyncStorage.getItem('inaya_device_id')) return true; } catch { /* ignore */ }
  try { const t = Platform.OS === 'web' ? await AsyncStorage.getItem('inaya_org_session_token') : await SecureStore.getItemAsync('inaya_org_session_token'); if (t) return true; } catch { /* ignore */ }
  return false;
}

/** The saved mode; 'all' for existing users and the Play edition; null when a new install must be asked. */
export async function loadAppMode() {
  if (PLAY_EDITION) return 'all';
  try { const v = await AsyncStorage.getItem(KEY); if (MODES.includes(v)) return v; } catch { /* ignore */ }
  if (await hasUsedAppBefore()) { await saveAppMode('all', { silent: true }); return 'all'; }
  return null;
}
export async function saveAppMode(mode, { silent = false } = {}) {
  if (!MODES.includes(mode)) return;
  try { await AsyncStorage.setItem(KEY, mode); } catch { /* ignore */ }
  if (!silent) listeners.forEach((fn) => { try { fn(mode); } catch { /* ignore */ } });
}
export function onAppModeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
