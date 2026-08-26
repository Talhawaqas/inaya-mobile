// src/screens/business/InventoryScreen.js
//
// Inventory (Phase 4) — Products and Movements tabs. Tapping a product
// navigates to ProductDetailScreen for per-warehouse stock + recording a
// manual movement (same reasoning as OrderDetailScreen: real enough
// interaction to deserve its own screen).

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function InventoryScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('products');
  const [departments, setDepartments] = useState([]);

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Inventory` }); }, [navigation, orgName]);
  useEffect(() => {
    orgFetch(`/api/orgs/departments?orgId=${orgId}`).then((d) => setDepartments(d.departments || [])).catch(() => {});
  }, [orgId]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.tabRow}>
        <Chip label="Products" active={tab === 'products'} onPress={() => setTab('products')} />
        <Chip label="Movements" active={tab === 'movements'} onPress={() => setTab('movements')} />
      </View>
      {tab === 'products' ? <ProductsTab orgId={orgId} departments={departments} navigation={navigation} /> : <MovementsTab orgId={orgId} />}
    </ScrollView>
  );
}

function ProductsTab({ orgId, departments, navigation }) {
  const [products, setProducts] = useState(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ orgId });
      if (lowStockOnly) params.set('lowStockOnly', 'true');
      setProducts((await orgFetch(`/api/orgs/inventory/products?${params.toString()}`)).products || []);
    } catch (err) {
      setError(err.message || 'Could not load products.');
    }
  }, [orgId, lowStockOnly]);

  useEffect(() => { load(); }, [load]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Chip label="Low stock only" active={lowStockOnly} onPress={() => setLowStockOnly((v) => !v)} />
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && <CreateProductForm orgId={orgId} departments={departments} onDone={() => { setCreating(false); load(); }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!products ? <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} /> : products.length === 0 ? (
        <Text style={styles.emptyText}>No products match these filters.</Text>
      ) : (
        products.map((p) => (
          <TouchableOpacity key={p.id} style={styles.card} onPress={() => navigation.navigate('ProductDetail', { orgId, productId: p.id, productName: p.name, departmentId: p.departmentId, sku: p.sku, reorderThreshold: p.reorderThreshold })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{p.name}</Text>
              <Text style={styles.cardMeta}>SKU {p.sku}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.stockText}>{p.totalStock}</Text>
              {p.lowStock && (
                <View style={[badgeStyles.badge, { borderColor: colors.warning, marginTop: 2 }]}>
                  <Text style={[badgeStyles.text, { color: colors.warning }]}>Low</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function CreateProductForm({ orgId, departments, onDone }) {
  const [departmentId, setDepartmentId] = useState(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!departmentId || !sku.trim() || !name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/inventory/products', { method: 'POST', body: { orgId, departmentId, sku: sku.trim(), name: name.trim() } });
      onDone();
    } catch (err) {
      setError(err.message || 'Could not create product.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginBottom: spacing.md, flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={styles.chipRow}>
        {departments.map((d) => <Chip key={d.id} label={d.name} active={departmentId === d.id} onPress={() => setDepartmentId(d.id)} />)}
      </View>
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={sku} onChangeText={setSku} placeholder="SKU" placeholderTextColor={colors.textMuted} editable={!submitting} />
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={name} onChangeText={setName} placeholder="Product name" placeholderTextColor={colors.textMuted} editable={!submitting} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, (submitting || !departmentId || !sku.trim() || !name.trim()) && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting || !departmentId || !sku.trim() || !name.trim()}>
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Create</Text>}
      </TouchableOpacity>
    </View>
  );
}

function MovementsTab({ orgId }) {
  const [movements, setMovements] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    orgFetch(`/api/orgs/inventory/movements?orgId=${orgId}`).then((d) => setMovements(d.movements || [])).catch((err) => setError(err.message || 'Could not load movements.'));
  }, [orgId]);

  return (
    <View>
      <Text style={styles.sectionTitle}>Recent movements</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!movements ? <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} /> : movements.length === 0 ? (
        <Text style={styles.emptyText}>No stock movements recorded yet.</Text>
      ) : (
        movements.map((m, i) => (
          <View key={i} style={styles.movementRow}>
            <Text style={styles.movementTitle}>{m.productName}</Text>
            <Text style={{ fontFamily: fonts.monoBold, fontSize: 11, color: m.delta > 0 ? colors.success : colors.danger }}>{m.delta > 0 ? '+' : ''}{m.delta} · {m.type.toLowerCase()} · {m.warehouseName}</Text>
            <Text style={styles.movementMeta}>{m.actorEmail} · {new Date(m.createdAt).toLocaleString()}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  text: { fontFamily: fonts.monoBold, fontSize: 8, letterSpacing: 0.4, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  tabRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, marginBottom: spacing.sm },
  card: { ...glassCard, padding: spacing.lg, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  stockText: { fontFamily: fonts.monoBold, fontSize: 15, color: colors.textPrimary },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
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
  movementRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  movementTitle: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textPrimary },
  movementMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
});
