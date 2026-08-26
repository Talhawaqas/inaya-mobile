// src/screens/business/CRMScreen.js
//
// CRM (Phase 2) — Contacts and Deals tabs, GET/POST /api/orgs/crm/*.
// Same collapsed-tabs-in-one-screen pattern the web CRMView.js uses;
// tapping a deal navigates to DealDetailScreen for stage transitions
// (a deal's pipeline actions are involved enough to deserve their own
// screen, same reasoning TasksScreen -> TaskDetailScreen already
// established). Contacts have no detail screen — the one thing you'd do
// there (convert Lead -> Customer) is a single inline action on the row.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STAGE_LABELS = { NEW: 'New', QUALIFIED: 'Qualified', PROPOSAL: 'Proposal', NEGOTIATION: 'Negotiation', WON: 'Won', LOST: 'Lost' };
const STAGE_COLORS = { NEW: colors.textMuted, QUALIFIED: colors.cyan, PROPOSAL: colors.violet, NEGOTIATION: colors.warning, WON: colors.success, LOST: colors.danger };

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CRMScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('contacts');
  const [departments, setDepartments] = useState([]);

  useEffect(() => { navigation.setOptions({ title: `${orgName} · CRM` }); }, [navigation, orgName]);
  useEffect(() => {
    orgFetch(`/api/orgs/departments?orgId=${orgId}`).then((d) => setDepartments(d.departments || [])).catch(() => {});
  }, [orgId]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.tabRow}>
        <Chip label="Contacts" active={tab === 'contacts'} onPress={() => setTab('contacts')} />
        <Chip label="Deals" active={tab === 'deals'} onPress={() => setTab('deals')} />
      </View>
      {tab === 'contacts' ? <ContactsTab orgId={orgId} departments={departments} /> : <DealsTab orgId={orgId} departments={departments} navigation={navigation} />}
    </ScrollView>
  );
}

function ContactsTab({ orgId, departments }) {
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setContacts((await orgFetch(`/api/orgs/crm/contacts?orgId=${orgId}`)).contacts || []);
    } catch (err) {
      setError(err.message || 'Could not load contacts.');
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  async function toggleType(contact) {
    try {
      await orgFetch(`/api/orgs/crm/contacts/${contact.id}`, { method: 'PATCH', body: { orgId, type: contact.type === 'LEAD' ? 'CUSTOMER' : 'LEAD' } });
      load();
    } catch (err) {
      setError(err.message || 'Could not update contact.');
    }
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Contacts</Text>
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && <CreateContactForm orgId={orgId} departments={departments} onDone={() => { setCreating(false); load(); }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!contacts ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : contacts.length === 0 ? (
        <Text style={styles.emptyText}>No contacts yet.</Text>
      ) : (
        contacts.map((c) => (
          <TouchableOpacity key={c.id} style={styles.card} onPress={() => toggleType(c)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{c.name}</Text>
              <Text style={styles.cardMeta}>{c.company || 'No company'}{c.email ? ` · ${c.email}` : ''}</Text>
            </View>
            <View style={[badgeStyles.badge, { borderColor: c.type === 'CUSTOMER' ? colors.success : colors.warning }]}>
              <Text style={[badgeStyles.text, { color: c.type === 'CUSTOMER' ? colors.success : colors.warning }]}>{c.type}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function CreateContactForm({ orgId, departments, onDone }) {
  const [departmentId, setDepartmentId] = useState(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!departmentId || !name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/crm/contacts', { method: 'POST', body: { orgId, departmentId, name: name.trim() } });
      onDone();
    } catch (err) {
      setError(err.message || 'Could not create contact.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginBottom: spacing.md }]}>
      <View style={styles.chipRow}>
        {departments.map((d) => <Chip key={d.id} label={d.name} active={departmentId === d.id} onPress={() => setDepartmentId(d.id)} />)}
      </View>
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={name} onChangeText={setName} placeholder="Contact name" placeholderTextColor={colors.textMuted} editable={!submitting} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, (submitting || !departmentId || !name.trim()) && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting || !departmentId || !name.trim()}>
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Create</Text>}
      </TouchableOpacity>
    </View>
  );
}

function DealsTab({ orgId, departments, navigation }) {
  const [deals, setDeals] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setDeals((await orgFetch(`/api/orgs/crm/deals?orgId=${orgId}`)).deals || []);
    } catch (err) {
      setError(err.message || 'Could not load deals.');
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Deals</Text>
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && <CreateDealForm orgId={orgId} departments={departments} onDone={() => { setCreating(false); load(); }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!deals ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : deals.length === 0 ? (
        <Text style={styles.emptyText}>No deals yet.</Text>
      ) : (
        deals.map((d) => (
          <TouchableOpacity key={d.id} style={styles.card} onPress={() => navigation.navigate('DealDetail', { orgId, dealId: d.id, title: d.title })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{d.title}</Text>
              <Text style={styles.cardMeta}>{d.contactName}{d.value ? ` · $${d.value.toLocaleString()}` : ''}</Text>
            </View>
            <View style={[badgeStyles.badge, { borderColor: STAGE_COLORS[d.stage] }]}>
              <Text style={[badgeStyles.text, { color: STAGE_COLORS[d.stage] }]}>{STAGE_LABELS[d.stage]}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function CreateDealForm({ orgId, departments, onDone }) {
  const [departmentId, setDepartmentId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactId, setContactId] = useState(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!departmentId) { setContacts([]); setContactId(null); return; }
    orgFetch(`/api/orgs/crm/contacts?orgId=${orgId}&departmentId=${departmentId}`).then((d) => setContacts(d.contacts || [])).catch(() => setContacts([]));
    setContactId(null);
  }, [orgId, departmentId]);

  async function handleSubmit() {
    if (!departmentId || !contactId || !title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/crm/deals', { method: 'POST', body: { orgId, departmentId, contactId, title: title.trim() } });
      onDone();
    } catch (err) {
      setError(err.message || 'Could not create deal.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginBottom: spacing.md }]}>
      <View style={styles.chipRow}>
        {departments.map((d) => <Chip key={d.id} label={d.name} active={departmentId === d.id} onPress={() => setDepartmentId(d.id)} />)}
      </View>
      {departmentId && (
        <View style={[styles.chipRow, { marginTop: spacing.xs }]}>
          {contacts.map((c) => <Chip key={c.id} label={c.name} active={contactId === c.id} onPress={() => setContactId(c.id)} />)}
          {contacts.length === 0 && <Text style={styles.emptyText}>No contacts in this department yet.</Text>}
        </View>
      )}
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={title} onChangeText={setTitle} placeholder="Deal title" placeholderTextColor={colors.textMuted} editable={!submitting} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, (submitting || !departmentId || !contactId || !title.trim()) && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting || !departmentId || !contactId || !title.trim()}>
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
  tabRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
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
});
