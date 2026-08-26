// src/screens/business/FinanceScreen.js
//
// Finance (Phase 5) — Invoices, Expenses, and Payments tabs, backed by
// /api/orgs/finance/*. Tapping an invoice opens InvoiceDetailScreen for
// status transitions; expenses/payments stay list-only here (creation and
// receipt attachments are web-only for this pass — same "core workflows
// on mobile, richer editing on web" split TasksScreen/ProcurementScreen
// already established, not a capability gap specific to Finance).
//
// Carries the same "Testnet / Beta" pill the web FinanceView shows (SOW §8).

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STATUS_COLORS = {
  DRAFT: colors.textMuted, SENT: colors.cyan, PAID: colors.success, OVERDUE: colors.danger, CANCELLED: colors.textMuted,
  PENDING_APPROVAL: colors.warning, APPROVED: colors.success, REJECTED: colors.danger, RECORDED: colors.textMuted,
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

export default function FinanceScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('invoices');

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Finance` }); }, [navigation, orgName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={[badgeStyles.badge, { borderColor: colors.warning, alignSelf: 'flex-start', marginBottom: spacing.md }]}>
        <Text style={[badgeStyles.text, { color: colors.warning }]}>Testnet / Beta</Text>
      </View>
      <View style={styles.tabRow}>
        <Chip label="Invoices" active={tab === 'invoices'} onPress={() => setTab('invoices')} />
        <Chip label="Expenses" active={tab === 'expenses'} onPress={() => setTab('expenses')} />
        <Chip label="Payments" active={tab === 'payments'} onPress={() => setTab('payments')} />
      </View>
      {tab === 'invoices' && <InvoicesTab orgId={orgId} navigation={navigation} />}
      {tab === 'expenses' && <ExpensesTab orgId={orgId} />}
      {tab === 'payments' && <PaymentsTab orgId={orgId} />}
    </ScrollView>
  );
}

function InvoicesTab({ orgId, navigation }) {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    orgFetch(`/api/orgs/finance/invoices?orgId=${orgId}`).then((d) => setInvoices(d.invoices || [])).catch((err) => setError(err.message || 'Could not load invoices.'));
  }, [orgId]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!invoices) return <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />;
  if (invoices.length === 0) return <Text style={styles.emptyText}>No invoices yet.</Text>;

  return invoices.map((inv) => (
    <TouchableOpacity key={inv.id} style={styles.card} onPress={() => navigation.navigate('InvoiceDetail', { orgId, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber })}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{inv.invoiceNumber}</Text>
        <Text style={styles.cardMeta}>Due {new Date(inv.dueDate).toLocaleDateString()}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.amountText}>${inv.total.toFixed(2)}</Text>
        <StatusBadge status={inv.status} />
      </View>
    </TouchableOpacity>
  ));
}

function ExpensesTab({ orgId }) {
  const [expenses, setExpenses] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    orgFetch(`/api/orgs/finance/expenses?orgId=${orgId}`).then((d) => setExpenses(d.expenses || [])).catch((err) => setError(err.message || 'Could not load expenses.'));
  }, [orgId]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!expenses) return <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />;
  if (expenses.length === 0) return <Text style={styles.emptyText}>No expenses yet.</Text>;

  return expenses.map((e) => (
    <View key={e.id} style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{e.vendor}</Text>
        <Text style={styles.cardMeta}>{e.category}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.amountText}>${e.amount.toFixed(2)}</Text>
        <StatusBadge status={e.status} />
      </View>
    </View>
  ));
}

function PaymentsTab({ orgId }) {
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    orgFetch(`/api/orgs/finance/payments?orgId=${orgId}`).then((d) => setPayments(d.payments || [])).catch((err) => setError(err.message || 'Could not load payments.'));
  }, [orgId]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!payments) return <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />;
  if (payments.length === 0) return <Text style={styles.emptyText}>No payments recorded yet.</Text>;

  return payments.map((p) => (
    <View key={p.id} style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: p.direction === 'INCOMING' ? colors.success : colors.danger }]}>
          {p.direction === 'INCOMING' ? '+' : '−'}${p.amount.toFixed(2)}
        </Text>
        <Text style={styles.cardMeta}>{p.method || '—'} · {new Date(p.paymentDate).toLocaleDateString()}</Text>
      </View>
      <StatusBadge status={p.status} />
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
  amountText: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
});
