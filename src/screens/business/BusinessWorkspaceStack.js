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

import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, fonts } from '../../theme';
import { orgFetch, getStoredSessionToken, setStoredSessionToken } from '../../utils/orgApi';
import { BusinessSessionProvider } from './BusinessSessionContext';
import BusinessAuthScreen from './BusinessAuthScreen';
import OrgHomeScreen from './OrgHomeScreen';
import DepartmentsScreen from './DepartmentsScreen';
import ProjectsScreen from './ProjectsScreen';
import DocumentsScreen from './DocumentsScreen';
import DocumentDetailScreen from './DocumentDetailScreen';
import TasksScreen from './TasksScreen';
import TaskDetailScreen from './TaskDetailScreen';
import CRMScreen from './CRMScreen';
import DealDetailScreen from './DealDetailScreen';
import HealthScreen from './HealthScreen';
import PatientDetailScreen from './PatientDetailScreen';
import LegalScreen from './LegalScreen';
import MatterDetailScreen from './MatterDetailScreen';
import ProcurementScreen from './ProcurementScreen';
import OrderDetailScreen from './OrderDetailScreen';
import InventoryScreen from './InventoryScreen';
import ProductDetailScreen from './ProductDetailScreen';
import FinanceScreen from './FinanceScreen';
import InvoiceDetailScreen from './InvoiceDetailScreen';
import HRScreen from './HRScreen';
import EmployeeDetailScreen from './EmployeeDetailScreen';
import InsightsScreen from './InsightsScreen';
import BusinessAIScreen from './BusinessAIScreen';
import MfaSettingsScreen from './MfaSettingsScreen';

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

  // Biometric app-unlock now happens once, app-wide, at launch (App.js's
  // AppLockGate) rather than being re-checked specifically for this screen —
  // see biometric.js's header comment. Gating here too would just mean a
  // redundant second Face ID/fingerprint prompt on top of the one the user
  // already cleared to open the app at all.

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
        <Stack.Screen name="Tasks" component={TasksScreen} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
        <Stack.Screen name="CRM" component={CRMScreen} />
        <Stack.Screen name="DealDetail" component={DealDetailScreen} />
        <Stack.Screen name="Health" component={HealthScreen} options={{ title: 'Health OS' }} />
        <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
        <Stack.Screen name="Legal" component={LegalScreen} options={{ title: 'Legal OS' }} />
        <Stack.Screen name="MatterDetail" component={MatterDetailScreen} />
        <Stack.Screen name="Procurement" component={ProcurementScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="Inventory" component={InventoryScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Finance" component={FinanceScreen} />
        <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
        <Stack.Screen name="HR" component={HRScreen} />
        <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} />
        <Stack.Screen name="Insights" component={InsightsScreen} />
        <Stack.Screen name="BusinessAI" component={BusinessAIScreen} options={{ title: 'AI Assistant' }} />
        <Stack.Screen name="MfaSettings" component={MfaSettingsScreen} options={{ title: 'Two-Step Verification' }} />
      </Stack.Navigator>
    </BusinessSessionProvider>
  );
}
