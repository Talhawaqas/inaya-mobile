// src/screens/business/OrderDetailScreen.js
//
// Purchase order detail — status transitions plus per-item receiving.
// POST /api/orgs/procurement/orders/:id/transition and .../receive.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const PO_COLORS = {
  DRAFT: colors.textMuted, PENDING_APPROVAL: colors.warning, APPROVED: colors.success, REJECTED: colors.danger,
  CANCELLED: colors.violet, ORDERED: colors.cyan, PARTIALLY_RECEIVED: colors.warning, RECEIVED: colors.success,
};
const PO_ACTIONS = {
  DRAFT: [['submit', 'Submit'], ['cancel', 'Cancel']],
  PENDING_APPROVAL: [['approve', 'Approve'], ['reject', 'Reject'], ['cancel', 'Cancel']],
  APPROVED: [['order', 'Mark ordered'], ['cancel', 'Cancel']],
  ORDERED: [['cancel', 'Cancel']],
};

export default function OrderDetailScreen({ route, navigation }) {
  const { orgId, orderId } = route.params;
  const insets = useSafeAreaInsets();
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');
  const [receiveQty, setReceiveQty] = useState({});

  const load = useCallback(async () => {
    try {
      setPo(await orgFetch(`/api/orgs/procurement/orders/${orderId}?orgId=${orgId}`));
    } catch (err) {
      setError(err.message || 'Could not load this purchase order.');
    }
  }, [orgId, orderId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: 'Purchase Order' }); }, [navigation]);

  async function handleAction(action) {
    setActing(action);
    setError('');
    try {
      await orgFetch(`/api/orgs/procurement/orders/${orderId}/transition`, { method: 'POST', body: { orgId, action } });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update this purchase order.');
    } finally {
      setActing('');
    }
  }

  async function handleReceive(itemIndex) {
    const quantity = Number(receiveQty[itemIndex]);
    if (!quantity || quantity <= 0) return;
    setActing(`receive-${itemIndex}`);
    setError('');
    try {
      await orgFetch(`/api/orgs/procurement/orders/${orderId}/receive`, { method: 'POST', body: { orgId, receipts: [{ itemIndex, quantity }] } });
      setReceiveQty((prev) => ({ ...prev, [itemIndex]: '' }));
      await load();
    } catch (err) {
      setError(err.message || 'Could not record receipt.');
    } finally {
      setActing('');
    }
  }

  if (!po) {
    return (
      <View style={[styles.root, styles.centered]}>
        {error ? <Text style={[styles.error, { padding: spacing.xl }]}>{error}</Text> : <ActivityIndicator color={colors.cyan} />}
      </View>
    );
  }

  const canReceive = ['ORDERED', 'PARTIALLY_RECEIVED'].includes(po.status);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={[badgeStyles.badge, { borderColor: PO_COLORS[po.status], alignSelf: 'flex-start' }]}>
        <Text style={[badgeStyles.text, { color: PO_COLORS[po.status] }]}>{po.status.replace(/_/g, ' ')}</Text>
      </View>

      {po.items.map((item, i) => (
        <View key={i} style={[styles.card, { marginTop: spacing.md, flexDirection: 'column', alignItems: 'stretch' }]}>
          <Text style={styles.cardTitle}>{item.description}</Text>
          <Text style={styles.cardMeta}>
            Qty {item.quantity}{item.unitPrice ? ` · $${item.unitPrice}/unit` : ''} · Received {item.receivedQuantity}/{item.quantity}
          </Text>
          {canReceive && item.receivedQuantity < item.quantity && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={receiveQty[i] || ''}
                onChangeText={(v) => setReceiveQty((prev) => ({ ...prev, [i]: v }))}
                placeholder="Qty received"
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity style={[styles.receiveButton, !!acting && styles.buttonDisabled]} onPress={() => handleReceive(i)} disabled={!!acting}>
                <Text style={styles.receiveButtonText}>{acting === `receive-${i}` ? '…' : 'Receive'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      <View style={styles.actionRow}>
        {(PO_ACTIONS[po.status] || []).map(([action, label]) => (
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
  card: { ...glassCard, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  input: {
    fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  receiveButton: { backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  receiveButtonText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.success, textTransform: 'uppercase' },
  buttonDisabled: { opacity: 0.4 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  actionButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionButtonText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.md },
});
