// src/screens/business/InvoiceDetailScreen.js
//
// Invoice detail — line items + status transitions (send/markPaid/cancel).
// POST /api/orgs/finance/invoices/:id/transition. Mobile counterpart to
// the web FinanceView's InvoiceDetailModal, minus the activity log (kept
// to the actionable core, same trim OrderDetailScreen makes vs. its web
// equivalent).

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STATUS_COLORS = { DRAFT: colors.textMuted, SENT: colors.cyan, PAID: colors.success, OVERDUE: colors.danger, CANCELLED: colors.textMuted };
const INVOICE_ACTIONS = {
  DRAFT: [['send', 'Send']],
  SENT: [['markPaid', 'Mark paid'], ['cancel', 'Cancel']],
  OVERDUE: [['markPaid', 'Mark paid'], ['cancel', 'Cancel']],
};

export default function InvoiceDetailScreen({ route, navigation }) {
  const { orgId, invoiceId, invoiceNumber } = route.params;
  const insets = useSafeAreaInsets();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');

  const load = useCallback(async () => {
    try {
      setInvoice(await orgFetch(`/api/orgs/finance/invoices/${invoiceId}?orgId=${orgId}`));
    } catch (err) {
      setError(err.message || 'Could not load this invoice.');
    }
  }, [orgId, invoiceId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: invoiceNumber || 'Invoice' }); }, [navigation, invoiceNumber]);

  async function handleAction(action) {
    setActing(action);
    setError('');
    try {
      await orgFetch(`/api/orgs/finance/invoices/${invoiceId}/transition`, { method: 'POST', body: { orgId, action } });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update this invoice.');
    } finally {
      setActing('');
    }
  }

  if (!invoice) {
    return (
      <View style={[styles.root, styles.centered]}>
        {error ? <Text style={[styles.error, { padding: spacing.xl }]}>{error}</Text> : <ActivityIndicator color={colors.cyan} />}
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.headerRow}>
        <View style={[badgeStyles.badge, { borderColor: STATUS_COLORS[invoice.status] || colors.border }]}>
          <Text style={[badgeStyles.text, { color: STATUS_COLORS[invoice.status] || colors.textSecondary }]}>{invoice.status}</Text>
        </View>
        <Text style={styles.totalText}>${invoice.total.toFixed(2)}</Text>
      </View>
      <Text style={styles.subtitle}>Issued {new Date(invoice.issueDate).toLocaleDateString()} · Due {new Date(invoice.dueDate).toLocaleDateString()}</Text>

      <View style={[styles.card, { marginTop: spacing.md, flexDirection: 'column', alignItems: 'stretch' }]}>
        <Text style={styles.cardTitle}>Line items</Text>
        {invoice.lineItems.map((it, i) => (
          <View key={i} style={styles.lineRow}>
            <Text style={styles.lineDesc}>{it.description} × {it.quantity}</Text>
            <Text style={styles.lineAmount}>${(it.quantity * it.unitPrice).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {invoice.notes ? <Text style={styles.notes}>{invoice.notes}</Text> : null}

      <View style={styles.actionRow}>
        {(INVOICE_ACTIONS[invoice.status] || []).map(([action, label]) => (
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalText: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.textPrimary },
  subtitle: { fontSize: 11, fontFamily: fonts.mono, color: colors.textMuted, marginTop: spacing.xs },
  card: { ...glassCard, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs },
  lineDesc: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, flex: 1, marginRight: spacing.sm },
  lineAmount: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textPrimary },
  notes: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.md },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  actionButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionButtonText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  buttonDisabled: { opacity: 0.4 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.md },
});
