// src/screens/business/ProcurementScreen.js
//
// Procurement (Phase 3) — Suppliers, Requests, Orders tabs. Requests get
// inline approve/reject/cancel buttons right on the row (their whole
// lifecycle is 4 states, no line items) — Orders navigate to
// OrderDetailScreen since receiving needs a real per-item form.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const PR_COLORS = { DRAFT: colors.textMuted, PENDING_APPROVAL: colors.warning, APPROVED: colors.success, REJECTED: colors.danger, CANCELLED: colors.violet };
const PO_COLORS = { ...PR_COLORS, ORDERED: colors.cyan, PARTIALLY_RECEIVED: colors.warning, RECEIVED: colors.success };
const PR_ACTIONS = { DRAFT: [['submit', 'Submit'], ['cancel', 'Cancel']], PENDING_APPROVAL: [['approve', 'Approve'], ['reject', 'Reject']] };

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Badge({ label, color }) {
  return (
    <View style={[badgeStyles.badge, { borderColor: color }]}>
      <Text style={[badgeStyles.text, { color }]}>{label.replace(/_/g, ' ')}</Text>
    </View>
  );
}

export default function ProcurementScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('suppliers');
  const [departments, setDepartments] = useState([]);

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Procurement` }); }, [navigation, orgName]);
  useEffect(() => {
    orgFetch(`/api/orgs/departments?orgId=${orgId}`).then((d) => setDepartments(d.departments || [])).catch(() => {});
  }, [orgId]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.tabRow}>
        <Chip label="Suppliers" active={tab === 'suppliers'} onPress={() => setTab('suppliers')} />
        <Chip label="Requests" active={tab === 'requests'} onPress={() => setTab('requests')} />
        <Chip label="Orders" active={tab === 'orders'} onPress={() => setTab('orders')} />
      </View>
      {tab === 'suppliers' && <SuppliersTab orgId={orgId} departments={departments} />}
      {tab === 'requests' && <RequestsTab orgId={orgId} departments={departments} />}
      {tab === 'orders' && <OrdersTab orgId={orgId} navigation={navigation} />}
    </ScrollView>
  );
}

function SuppliersTab({ orgId, departments }) {
  const [suppliers, setSuppliers] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setSuppliers((await orgFetch(`/api/orgs/procurement/suppliers?orgId=${orgId}`)).suppliers || []);
    } catch (err) {
      setError(err.message || 'Could not load suppliers.');
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Suppliers</Text>
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && <CreateSupplierForm orgId={orgId} departments={departments} onDone={() => { setCreating(false); load(); }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!suppliers ? <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} /> : suppliers.length === 0 ? (
        <Text style={styles.emptyText}>No suppliers yet.</Text>
      ) : (
        suppliers.map((s) => (
          <View key={s.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{s.name}</Text>
              <Text style={styles.cardMeta}>{s.contactEmail || 'No contact email'}</Text>
            </View>
            <Badge label={s.status} color={s.status === 'ACTIVE' ? colors.success : colors.textMuted} />
          </View>
        ))
      )}
    </View>
  );
}

function CreateSupplierForm({ orgId, departments, onDone }) {
  const [departmentId, setDepartmentId] = useState(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!departmentId || !name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/procurement/suppliers', { method: 'POST', body: { orgId, departmentId, name: name.trim() } });
      onDone();
    } catch (err) {
      setError(err.message || 'Could not create supplier.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginBottom: spacing.md, flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={styles.chipRow}>
        {departments.map((d) => <Chip key={d.id} label={d.name} active={departmentId === d.id} onPress={() => setDepartmentId(d.id)} />)}
      </View>
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={name} onChangeText={setName} placeholder="Supplier name" placeholderTextColor={colors.textMuted} editable={!submitting} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, (submitting || !departmentId || !name.trim()) && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting || !departmentId || !name.trim()}>
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Create</Text>}
      </TouchableOpacity>
    </View>
  );
}

function RequestsTab({ orgId, departments }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState('');

  const load = useCallback(async () => {
    try {
      setRequests((await orgFetch(`/api/orgs/procurement/requests?orgId=${orgId}`)).requests || []);
    } catch (err) {
      setError(err.message || 'Could not load requests.');
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id, action) {
    setActing(id + action);
    try {
      await orgFetch(`/api/orgs/procurement/requests/${id}/transition`, { method: 'POST', body: { orgId, action } });
      load();
    } catch (err) {
      setError(err.message || 'Could not update request.');
    } finally {
      setActing('');
    }
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Requests</Text>
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && <CreateRequestForm orgId={orgId} departments={departments} onDone={() => { setCreating(false); load(); }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!requests ? <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} /> : requests.length === 0 ? (
        <Text style={styles.emptyText}>No purchase requests yet.</Text>
      ) : (
        requests.map((r) => (
          <View key={r.id} style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{r.title}</Text>
                <Text style={styles.cardMeta}>{r.estimatedCost ? `$${r.estimatedCost.toLocaleString()}` : 'No estimate'}</Text>
              </View>
              <Badge label={r.status} color={PR_COLORS[r.status]} />
            </View>
            {(PR_ACTIONS[r.status] || []).length > 0 && (
              <View style={[styles.actionRow, { marginTop: spacing.sm }]}>
                {PR_ACTIONS[r.status].map(([action, label]) => (
                  <TouchableOpacity key={action} style={[styles.actionButton, !!acting && styles.buttonDisabled]} onPress={() => handleAction(r.id, action)} disabled={!!acting}>
                    <Text style={styles.actionButtonText}>{acting === r.id + action ? '…' : label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

function CreateRequestForm({ orgId, departments, onDone }) {
  const [departmentId, setDepartmentId] = useState(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!departmentId || !title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/procurement/requests', { method: 'POST', body: { orgId, departmentId, title: title.trim() } });
      onDone();
    } catch (err) {
      setError(err.message || 'Could not create request.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginBottom: spacing.md, flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={styles.chipRow}>
        {departments.map((d) => <Chip key={d.id} label={d.name} active={departmentId === d.id} onPress={() => setDepartmentId(d.id)} />)}
      </View>
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={title} onChangeText={setTitle} placeholder="What do you need to buy?" placeholderTextColor={colors.textMuted} editable={!submitting} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, (submitting || !departmentId || !title.trim()) && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting || !departmentId || !title.trim()}>
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Create</Text>}
      </TouchableOpacity>
    </View>
  );
}

function OrdersTab({ orgId, navigation }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [departments, setDepartments] = useState([]);

  const load = useCallback(async () => {
    try {
      setOrders((await orgFetch(`/api/orgs/procurement/orders?orgId=${orgId}`)).orders || []);
    } catch (err) {
      setError(err.message || 'Could not load orders.');
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    orgFetch(`/api/orgs/departments?orgId=${orgId}`).then((d) => setDepartments(d.departments || [])).catch(() => {});
  }, [orgId]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Orders</Text>
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && <CreateOrderForm orgId={orgId} departments={departments} onDone={() => { setCreating(false); load(); }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!orders ? <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} /> : orders.length === 0 ? (
        <Text style={styles.emptyText}>No purchase orders yet.</Text>
      ) : (
        orders.map((po) => (
          <TouchableOpacity key={po.id} style={styles.card} onPress={() => navigation.navigate('OrderDetail', { orgId, orderId: po.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{po.items.length} item{po.items.length === 1 ? '' : 's'}</Text>
              <Text style={styles.cardMeta}>{new Date(po.createdAt).toLocaleDateString()}</Text>
            </View>
            <Badge label={po.status} color={PO_COLORS[po.status]} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function CreateOrderForm({ orgId, departments, onDone }) {
  const [departmentId, setDepartmentId] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState(null);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!departmentId) { setSuppliers([]); setSupplierId(null); return; }
    orgFetch(`/api/orgs/procurement/suppliers?orgId=${orgId}&departmentId=${departmentId}`).then((d) => setSuppliers(d.suppliers || [])).catch(() => setSuppliers([]));
    setSupplierId(null);
  }, [orgId, departmentId]);

  async function handleSubmit() {
    if (!departmentId || !supplierId || !description.trim() || !quantity) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/procurement/orders', {
        method: 'POST',
        body: { orgId, departmentId, supplierId, items: [{ description: description.trim(), quantity: Number(quantity), unitPrice: unitPrice ? Number(unitPrice) : undefined }] },
      });
      onDone();
    } catch (err) {
      setError(err.message || 'Could not create purchase order.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginBottom: spacing.md, flexDirection: 'column', alignItems: 'stretch' }]}>
      <Text style={[styles.cardMeta, { marginBottom: spacing.xs }]}>Add more line items from the web workspace after creating.</Text>
      <View style={styles.chipRow}>
        {departments.map((d) => <Chip key={d.id} label={d.name} active={departmentId === d.id} onPress={() => setDepartmentId(d.id)} />)}
      </View>
      {departmentId && (
        <View style={[styles.chipRow, { marginTop: spacing.xs }]}>
          {suppliers.map((s) => <Chip key={s.id} label={s.name} active={supplierId === s.id} onPress={() => setSupplierId(s.id)} />)}
          {suppliers.length === 0 && <Text style={styles.emptyText}>No suppliers in this department yet.</Text>}
        </View>
      )}
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={description} onChangeText={setDescription} placeholder="Item description" placeholderTextColor={colors.textMuted} editable={!submitting} />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={quantity} onChangeText={setQuantity} placeholder="Qty" keyboardType="numeric" placeholderTextColor={colors.textMuted} editable={!submitting} />
        <TextInput style={[styles.input, { flex: 1 }]} value={unitPrice} onChangeText={setUnitPrice} placeholder="$/unit" keyboardType="numeric" placeholderTextColor={colors.textMuted} editable={!submitting} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, (submitting || !departmentId || !supplierId || !description.trim()) && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting || !departmentId || !supplierId || !description.trim()}>
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Create</Text>}
      </TouchableOpacity>
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
  tabRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg, flexWrap: 'wrap' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 15, fontFamily: fonts.sansExtraBold, color: colors.textPrimary },
  card: { ...glassCard, padding: spacing.lg, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
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
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  actionButtonText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
});
