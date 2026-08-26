// src/screens/business/ProductDetailScreen.js
//
// Per-warehouse stock levels + recent movement history (GET
// .../products/:id/stock) and a manual-movement recorder (POST
// /api/orgs/inventory/movements) — the mobile counterpart to the web
// InventoryView's ProductDetailModal.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const TYPES = [['RECEIPT', 'Stock in'], ['ISSUE', 'Stock out'], ['ADJUSTMENT', 'Adjustment']];

export default function ProductDetailScreen({ route, navigation }) {
  const { orgId, productId, productName, departmentId, sku, reorderThreshold } = route.params;
  const insets = useSafeAreaInsets();
  const [stock, setStock] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(null);
  const [type, setType] = useState('RECEIPT');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setStock(await orgFetch(`/api/orgs/inventory/products/${productId}/stock?orgId=${orgId}`));
    } catch (err) {
      setError(err.message || 'Could not load stock levels.');
    }
  }, [orgId, productId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: productName }); }, [navigation, productName]);
  useEffect(() => {
    orgFetch(`/api/orgs/inventory/warehouses?orgId=${orgId}&departmentId=${departmentId}`).then((d) => setWarehouses(d.warehouses || [])).catch(() => setWarehouses([]));
  }, [orgId, departmentId]);

  async function handleSubmit() {
    if (!warehouseId || !quantity) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/inventory/movements', { method: 'POST', body: { orgId, productId, warehouseId, type, quantity: Number(quantity) } });
      setQuantity('');
      await load();
    } catch (err) {
      setError(err.message || 'Could not record movement.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.subtitle}>SKU {sku} · Reorder at {reorderThreshold}</Text>

      <View style={[styles.card, { marginTop: spacing.md }]}>
        <Text style={styles.cardTitle}>Stock by warehouse</Text>
        {!stock ? <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.sm }} /> : stock.levels.length === 0 ? (
          <Text style={styles.emptyText}>No stock recorded yet.</Text>
        ) : (
          stock.levels.map((l) => (
            <View key={l.warehouseId} style={styles.levelRow}>
              <Text style={styles.levelName}>{l.warehouseName}</Text>
              <Text style={styles.levelQty}>{l.quantity}</Text>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, { marginTop: spacing.md }]}>
        <Text style={styles.cardTitle}>Record a movement</Text>
        <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
          {warehouses.map((w) => (
            <TouchableOpacity key={w.id} style={[styles.chip, warehouseId === w.id && styles.chipActive]} onPress={() => setWarehouseId(w.id)}>
              <Text style={[styles.chipText, warehouseId === w.id && styles.chipTextActive]}>{w.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
          {TYPES.map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.chip, type === key && styles.chipActive]} onPress={() => setType(key)}>
              <Text style={[styles.chipText, type === key && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={quantity} onChangeText={setQuantity} placeholder="Quantity" keyboardType="numeric" placeholderTextColor={colors.textMuted} editable={!submitting} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={[styles.button, (submitting || !warehouseId || !quantity) && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting || !warehouseId || !quantity}>
          {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Record movement</Text>}
        </TouchableOpacity>
      </View>

      {stock && stock.movements.length > 0 && (
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.cardTitle}>Recent movements</Text>
          {stock.movements.slice(0, 10).map((m, i) => (
            <View key={i} style={styles.movementRow}>
              <Text style={{ fontFamily: fonts.monoBold, fontSize: 11, color: m.delta > 0 ? colors.success : colors.danger }}>{m.delta > 0 ? '+' : ''}{m.delta} · {m.type.toLowerCase()} · {m.warehouseName}</Text>
              <Text style={styles.movementMeta}>{m.actorEmail} · {new Date(m.createdAt).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  subtitle: { fontSize: 11, fontFamily: fonts.mono, color: colors.textMuted, textTransform: 'uppercase' },
  card: { ...glassCard, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  emptyText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, fontStyle: 'italic' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs },
  levelName: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  levelQty: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: 'rgba(0,242,254,0.3)' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
  chipTextActive: { color: colors.cyan },
  input: {
    fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  button: { marginTop: spacing.sm, backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  movementRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs },
  movementMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
});
