// src/screens/business/HRScreen.js
//
// HR (Phase 5) — Employees and Leave tabs, backed by /api/orgs/hr/*.
// Tapping an employee opens EmployeeDetailScreen for status transitions +
// leave balance. Any member sees their OWN employee/leave data even
// without HR access (self-service) — this screen just renders whatever
// the API returns, same as the web HRView.
//
// Department Manager assignment is web-only for this pass (an
// infrequent, admin-only setup action — same "richer editing stays on
// web" split FinanceScreen documents for its own create/attach flows).

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STATUS_COLORS = {
  ONBOARDING: colors.cyan, ACTIVE: colors.success, ON_LEAVE: colors.warning, TERMINATED: colors.textMuted,
  PENDING: colors.warning, APPROVED: colors.success, REJECTED: colors.danger, CANCELLED: colors.textMuted,
};

function StatusBadge({ status }) {
  return (
    <View style={[badgeStyles.badge, { borderColor: STATUS_COLORS[status] || colors.border }]}>
      <Text style={[badgeStyles.text, { color: STATUS_COLORS[status] || colors.textSecondary }]}>{status?.replace(/_/g, ' ')}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HRScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('employees');

  useEffect(() => { navigation.setOptions({ title: `${orgName} · HR` }); }, [navigation, orgName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={[badgeStyles.badge, { borderColor: colors.warning, alignSelf: 'flex-start', marginBottom: spacing.md }]}>
        <Text style={[badgeStyles.text, { color: colors.warning }]}>Testnet / Beta</Text>
      </View>
      <View style={styles.tabRow}>
        <Chip label="Employees" active={tab === 'employees'} onPress={() => setTab('employees')} />
        <Chip label="Leave" active={tab === 'leave'} onPress={() => setTab('leave')} />
      </View>
      {tab === 'employees' ? <EmployeesTab orgId={orgId} navigation={navigation} /> : <LeaveTab orgId={orgId} />}
    </ScrollView>
  );
}

function EmployeesTab({ orgId, navigation }) {
  const [employees, setEmployees] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    orgFetch(`/api/orgs/hr/employees?orgId=${orgId}`).then((d) => setEmployees(d.employees || [])).catch((err) => setError(err.message || 'Could not load employees.'));
  }, [orgId]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!employees) return <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />;
  if (employees.length === 0) return <Text style={styles.emptyText}>No employee records visible yet.</Text>;

  return employees.map((emp) => (
    <TouchableOpacity key={emp.id} style={styles.card} onPress={() => navigation.navigate('EmployeeDetail', { orgId, employeeId: emp.id, employeeName: emp.fullName })}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{emp.fullName}</Text>
        {emp.jobTitle ? <Text style={styles.cardMeta}>{emp.jobTitle}</Text> : null}
      </View>
      <StatusBadge status={emp.employmentStatus} />
    </TouchableOpacity>
  ));
}

function LeaveTab({ orgId }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');

  const load = useCallback(async () => {
    try {
      setRequests((await orgFetch(`/api/orgs/hr/leave-requests?orgId=${orgId}`)).leaveRequests || []);
    } catch (err) {
      setError(err.message || 'Could not load leave requests.');
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id, action) {
    setActing(`${id}:${action}`);
    setError('');
    try {
      await orgFetch(`/api/orgs/hr/leave-requests/${id}/transition`, { method: 'POST', body: { orgId, action } });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update this request.');
    } finally {
      setActing('');
    }
  }

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!requests) return <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />;
  if (requests.length === 0) return <Text style={styles.emptyText}>No leave requests yet.</Text>;

  return requests.map((r) => (
    <View key={r.id} style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.cardTitle}>{r.leaveType}</Text>
        <StatusBadge status={r.status} />
      </View>
      <Text style={styles.cardMeta}>{new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</Text>
      {r.status === 'PENDING' && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <TouchableOpacity style={[styles.smallButton, { borderColor: 'rgba(52,211,153,0.3)' }]} disabled={!!acting} onPress={() => handleAction(r.id, 'approve')}>
            <Text style={[styles.smallButtonText, { color: colors.success }]}>{acting === `${r.id}:approve` ? '…' : 'Approve'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallButton, { borderColor: 'rgba(248,113,113,0.3)' }]} disabled={!!acting} onPress={() => handleAction(r.id, 'reject')}>
            <Text style={[styles.smallButtonText, { color: colors.danger }]}>{acting === `${r.id}:reject` ? '…' : 'Reject'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallButton} disabled={!!acting} onPress={() => handleAction(r.id, 'cancel')}>
            <Text style={styles.smallButtonText}>{acting === `${r.id}:cancel` ? '…' : 'Cancel'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  ));
}

const badgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  text: { fontFamily: fonts.monoBold, fontSize: 8, letterSpacing: 0.4, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  tabRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: 'rgba(0,242,254,0.3)' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
  chipTextActive: { color: colors.cyan },
  card: { ...glassCard, padding: spacing.lg, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  smallButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  smallButtonText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
});
