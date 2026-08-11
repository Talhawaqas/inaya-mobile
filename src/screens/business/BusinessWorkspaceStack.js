// src/screens/business/BusinessWorkspaceStack.js
//
// Entry point wired into App.js's drawer (as "Workspace", distinct from the
// existing "Business" drawer item, which is BusinessModelScreen — a
// marketing/pricing page, not this org document system). Owns the
// authenticated-or-not decision: checks for a stored session token on
// mount, validates it against GET /api/orgs/session, and renders either
// BusinessAuthScreen or the nested Departments->Projects->Documents->
// DocumentDetail stack. Mirrors HomeStack's pattern of hiding its own
// Drawer header and using its own Stack.Navigator headers instead.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, AppState, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, fonts, spacing, radius } from '../../theme';
import { orgFetch, getStoredSessionToken, setStoredSessionToken } from '../../utils/orgApi';
import { isBiometricAvailable, getBiometricEnabled, promptBiometricUnlock } from '../../utils/biometric';
import { BusinessSessionProvider } from './BusinessSessionContext';
import BusinessAuthScreen from './BusinessAuthScreen';
import OrgHomeScreen from './OrgHomeScreen';
import DepartmentsScreen from './DepartmentsScreen';
import ProjectsScreen from './ProjectsScreen';
import DocumentsScreen from './DocumentsScreen';
import DocumentDetailScreen from './DocumentDetailScreen';
import BusinessAIScreen from './BusinessAIScreen';

const Stack = createNativeStackNavigator();

export default function BusinessWorkspaceStack() {
  // undefined = still checking AsyncStorage/session; null = not signed in
  const [session, setSession] = useState(undefined);

  const checkExistingSession = useCallback(async () => {
    const token = await getStoredSessionToken();
    if (!token) {
      setSession(null);
      return;
    }
    try {
      const data = await orgFetch('/api/orgs/session');
      setSession(data);
    } catch {
      await setStoredSessionToken(null);
      setSession(null);
    }
  }, []);

  useEffect(() => { checkExistingSession(); }, [checkExistingSession]);

  const signOut = useCallback(async () => {
    try {
      await orgFetch('/api/orgs/logout', { method: 'POST' });
    } catch {
      // Session may already be gone server-side — clearing the local token
      // below is what actually matters for signing the user out on-device.
    }
    await setStoredSessionToken(null);
    setSession(null);
  }, []);

  // Biometric app-unlock — a LOCAL gate on top of the session above, only
  // relevant once that session is real. 'checking' while the hardware/
  // enrollment/preference checks run; 'not-required' when the device has
  // no biometrics enrolled or the user hasn't opted in (both skip the gate
  // silently); 'required' shows the retry screen below; 'unlocked' renders
  // the actual workspace. Mirrored into a ref so the AppState listener
  // (a plain callback, not tied to React's render cycle) can read the
  // current value without a stale closure.
  const [biometricGate, setBiometricGate] = useState('checking');
  const biometricGateRef = useRef('checking');
  useEffect(() => {
    biometricGateRef.current = biometricGate;
  }, [biometricGate]);

  const runBiometricCheck = useCallback(async () => {
    const [available, enabled] = await Promise.all([isBiometricAvailable(), getBiometricEnabled()]);
    if (!available || !enabled) {
      setBiometricGate('not-required');
      return;
    }
    setBiometricGate('required');
    const success = await promptBiometricUnlock();
    setBiometricGate(success ? 'unlocked' : 'required');
  }, []);

  useEffect(() => {
    if (session && typeof session === 'object') runBiometricCheck();
  }, [session, runBiometricCheck]);

  // Re-lock on backgrounding, re-prompt on returning to foreground — a
  // gate that only checks once at cold start misses the actual point of
  // the feature (someone else picking up an already-unlocked phone).
  useEffect(() => {
    let previousState = AppState.currentState;
    const sub = AppState.addEventListener('change', (nextState) => {
      const wasActive = previousState === 'active';
      if (wasActive && nextState !== 'active' && biometricGateRef.current === 'unlocked') {
        setBiometricGate('required');
      } else if (!wasActive && nextState === 'active' && biometricGateRef.current === 'required') {
        runBiometricCheck();
      }
      previousState = nextState;
    });
    return () => sub.remove();
  }, [runBiometricCheck]);

  if (session === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  if (session === null) {
    return <BusinessAuthScreen onAuthenticated={setSession} />;
  }

  if (biometricGate === 'checking') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  if (biometricGate === 'required') {
    return (
      <View style={lockStyles.root}>
        <Text style={lockStyles.title}>Unlock to continue</Text>
        <Text style={lockStyles.hint}>Confirm with Face ID / fingerprint to open Business Workspace.</Text>
        <TouchableOpacity style={lockStyles.button} onPress={runBiometricCheck}>
          <Text style={lockStyles.buttonText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={lockStyles.signOutLink} onPress={signOut}>
          <Text style={lockStyles.signOutText}>Sign out instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <BusinessSessionProvider session={session} signOut={signOut} refreshSession={checkExistingSession}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.navBar },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fonts.sansExtraBold, fontSize: 15 },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="OrgHome" component={OrgHomeScreen} options={{ title: 'Business Workspace' }} />
        <Stack.Screen name="Departments" component={DepartmentsScreen} />
        <Stack.Screen name="Projects" component={ProjectsScreen} />
        <Stack.Screen name="Documents" component={DocumentsScreen} />
        <Stack.Screen name="DocumentDetail" component={DocumentDetailScreen} />
        <Stack.Screen name="BusinessAI" component={BusinessAIScreen} options={{ title: 'AI Assistant' }} />
      </Stack.Navigator>
    </BusinessSessionProvider>
  );
}

const lockStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { fontFamily: fonts.sansExtraBold, fontSize: 18, color: colors.textPrimary },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl, lineHeight: 17 },
  button: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  signOutLink: { marginTop: spacing.lg, paddingVertical: spacing.sm },
  signOutText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.danger },
});
