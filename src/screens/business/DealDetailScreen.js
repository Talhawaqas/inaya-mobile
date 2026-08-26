// src/screens/business/DealDetailScreen.js
//
// Deal stage transitions — POST /api/orgs/crm/deals/:id/transition.
// Same "buttons are UX only, the server is the real gate" relationship
// every transition screen in this app has to its workflow lib.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STAGE_LABELS = { NEW: 'New', QUALIFIED: 'Qualified', PROPOSAL: 'Proposal', NEGOTIATION: 'Negotiation', WON: 'Won', LOST: 'Lost' };
const STAGE_COLORS = { NEW: colors.textMuted, QUALIFIED: colors.cyan, PROPOSAL: colors.violet, NEGOTIATION: colors.warning, WON: colors.success, LOST: colors.danger };
const ACTIONS_BY_STAGE = {
  NEW: [['advance', 'Advance'], ['win', 'Mark won'], ['lose', 'Mark lost']],
  QUALIFIED: [['advance', 'Advance'], ['regress', 'Back'], ['win', 'Mark won'], ['lose', 'Mark lost']],
  PROPOSAL: [['advance', 'Advance'], ['regress', 'Back'], ['win', 'Mark won'], ['lose', 'Mark lost']],
  NEGOTIATION: [['regress', 'Back'], ['win', 'Mark won'], ['lose', 'Mark lost']],
  WON: [['reopen', 'Reopen']],
  LOST: [['reopen', 'Reopen']],
};

export default function DealDetailScreen({ route, navigation }) {
  const { orgId, dealId, title } = route.params;
  const insets = useSafeAreaInsets();
  const [deal, setDeal] = useState(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');

  const load = useCallback(async () => {
    try {
      setDeal(await orgFetch(`/api/orgs/crm/deals/${dealId}?orgId=${orgId}`));
    } catch (err) {
      setError(err.message || 'Could not load this deal.');
    }
  }, [orgId, dealId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title }); }, [navigation, title]);

  async function handleAction(action) {
    setActing(action);
    setError('');
    try {
      await orgFetch(`/api/orgs/crm/deals/${dealId}/transition`, { method: 'POST', body: { orgId, action } });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update this deal.');
    } finally {
      setActing('');
    }
  }

  if (!deal) {
    return (
      <View style={[styles.root, styles.centered]}>
        {error ? <Text style={[styles.error, { padding: spacing.xl }]}>{error}</Text> : <ActivityIndicator color={colors.cyan} />}
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>{deal.title}</Text>
      <View style={styles.metaRow}>
        <View style={[badgeStyles.badge, { borderColor: STAGE_COLORS[deal.status] }]}>
          <Text style={[badgeStyles.text, { color: STAGE_COLORS[deal.status] }]}>{STAGE_LABELS[deal.status]}</Text>
        </View>
        {deal.value ? <Text style={styles.valueText}>${deal.value.toLocaleString()}</Text> : null}
      </View>

      <View style={styles.actionRow}>
        {(ACTIONS_BY_STAGE[deal.status] || []).map(([action, label]) => (
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
  title: { fontSize: 17, fontFamily: fonts.sansExtraBold, color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  valueText: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textSecondary },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  actionButton: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  actionButtonText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  buttonDisabled: { opacity: 0.4 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.md },
});
