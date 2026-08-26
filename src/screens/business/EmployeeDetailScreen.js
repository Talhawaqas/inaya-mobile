// src/screens/business/EmployeeDetailScreen.js
//
// Employee detail — employment status transitions + computed leave
// balance. POST /api/orgs/hr/employees/:id/transition, GET .../leave-
// balance. Mobile counterpart to the web HRView's EmployeeDetailModal,
// minus document upload (web-only for this pass, same trim FinanceScreen
// documents for receipt attachments).

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STATUS_COLORS = { ONBOARDING: colors.cyan, ACTIVE: colors.success, ON_LEAVE: colors.warning, TERMINATED: colors.textMuted };
const EMPLOYEE_ACTIONS = {
  ONBOARDING: [['activate', 'Activate']],
  ACTIVE: [['placeOnLeave', 'Place on leave'], ['terminate', 'Terminate']],
  ON_LEAVE: [['returnFromLeave', 'Return from leave'], ['terminate', 'Terminate']],
};

export default function EmployeeDetailScreen({ route, navigation }) {
  const { orgId, employeeId, employeeName } = route.params;
  const insets = useSafeAreaInsets();
  const [employee, setEmployee] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');

  const load = useCallback(async () => {
    try {
      setEmployee(await orgFetch(`/api/orgs/hr/employees/${employeeId}?orgId=${orgId}`));
    } catch (err) {
      setError(err.message || 'Could not load this employee.');
    }
    try {
      setBalance(await orgFetch(`/api/orgs/hr/employees/${employeeId}/leave-balance?orgId=${orgId}`));
    } catch {
      setBalance(null);
    }
  }, [orgId, employeeId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: employeeName || 'Employee' }); }, [navigation, employeeName]);

  async function handleAction(action) {
    setActing(action);
    setError('');
    try {
      await orgFetch(`/api/orgs/hr/employees/${employeeId}/transition`, { method: 'POST', body: { orgId, action } });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update this employee.');
    } finally {
      setActing('');
    }
  }

  if (!employee) {
    return (
      <View style={[styles.root, styles.centered]}>
        {error ? <Text style={[styles.error, { padding: spacing.xl }]}>{error}</Text> : <ActivityIndicator color={colors.cyan} />}
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={[badgeStyles.badge, { borderColor: STATUS_COLORS[employee.employmentStatus] || colors.border, alignSelf: 'flex-start' }]}>
        <Text style={[badgeStyles.text, { color: STATUS_COLORS[employee.employmentStatus] || colors.textSecondary }]}>{employee.employmentStatus.replace(/_/g, ' ')}</Text>
      </View>
      {employee.jobTitle ? <Text style={styles.subtitle}>{employee.jobTitle}</Text> : null}
      <Text style={styles.meta}>Joined {new Date(employee.joiningDate).toLocaleDateString()}</Text>

      {balance && (
        <View style={[styles.card, { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between' }]}>
          <Text style={styles.cardTitle}>Leave balance</Text>
          <Text style={styles.balanceText}>{balance.remainingDays} / {balance.allocationDays} days</Text>
        </View>
      )}

      <View style={styles.actionRow}>
        {(EMPLOYEE_ACTIONS[employee.employmentStatus] || []).map(([action, label]) => (
          <TouchableOpacity key={action} style={[styles.actionButton, !!acting && styles.buttonDisabled]} onPress={() => handleAction(action)} disabled={!!acting}>
            <Text style={styles.actionButtonText}>{acting === action ? '…' : label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  text: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 0.4, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl },
  subtitle: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm },
  meta: { fontSize: 11, fontFamily: fonts.mono, color: colors.textMuted, marginTop: 2 },
  card: { ...glassCard, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  balanceText: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.textPrimary },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  actionButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionButtonText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  buttonDisabled: { opacity: 0.4 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.md },
});
