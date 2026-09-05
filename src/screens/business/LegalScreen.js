// src/screens/business/LegalScreen.js
//
// Legal OS (Healthcare & Legal Expansion SOW) — Matters, Clients,
// Prospects, and Corporate Entities. Same collapsed-tabs-in-one-screen
// pattern CRMScreen.js established; tapping a matter navigates to
// MatterDetailScreen for the full matter workspace (team, deadlines,
// evidence, holds, discovery, redaction, contracts, time & billing,
// trust accounting). Prospects are in-session state only, matching the
// web ProspectsTab — intake/engage/decline for this visit, not a
// persisted list fetched on load.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STATUS_COLORS = { OPEN: colors.textMuted, ACTIVE: colors.cyan, ON_HOLD: colors.warning, CLOSED: colors.success };

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function LegalScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('matters');

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Legal OS` }); }, [navigation, orgName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.tabRow}>
        <Chip label="Matters" active={tab === 'matters'} onPress={() => setTab('matters')} />
        <Chip label="Clients" active={tab === 'clients'} onPress={() => setTab('clients')} />
        <Chip label="Prospects" active={tab === 'prospects'} onPress={() => setTab('prospects')} />
        <Chip label="Entities" active={tab === 'entities'} onPress={() => setTab('entities')} />
      </View>
      {tab === 'matters' && <MattersTab orgId={orgId} navigation={navigation} />}
      {tab === 'clients' && <ClientsTab orgId={orgId} />}
      {tab === 'prospects' && <ProspectsTab orgId={orgId} />}
      {tab === 'entities' && <EntitiesTab orgId={orgId} />}
    </ScrollView>
  );
}

function MattersTab({ orgId, navigation }) {
  const [matters, setMatters] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ orgId });
      if (search) params.set('search', search);
      setMatters((await orgFetch(`/api/orgs/legal/matters?${params.toString()}`)).matters || []);
    } catch (err) {
      setError(err.message || 'Could not load matters.');
    }
  }, [orgId, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <View>
      <View style={styles.headerRow}>
        <TextInput style={[styles.input, { flex: 1 }]} value={search} onChangeText={setSearch} placeholder="Search matters…" placeholderTextColor={colors.textMuted} />
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && <CreateMatterForm orgId={orgId} onDone={() => { setCreating(false); load(); }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!matters ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : matters.length === 0 ? (
        <Text style={styles.emptyText}>No matters match, or you have no matter-team assignments yet.</Text>
      ) : (
        matters.map((m) => (
          <TouchableOpacity key={m.id} style={styles.card} onPress={() => navigation.navigate('MatterDetail', { orgId, matterId: m.id, title: m.name })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{m.name}</Text>
              <Text style={styles.cardMeta}>{m.type}{m.jurisdiction ? ` · ${m.jurisdiction}` : ''}</Text>
            </View>
            <View style={[badgeStyles.badge, { borderColor: STATUS_COLORS[m.status] || STATUS_COLORS.OPEN }]}>
              <Text style={[badgeStyles.text, { color: STATUS_COLORS[m.status] || STATUS_COLORS.OPEN }]}>{m.status}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function CreateMatterForm({ orgId, onDone }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('litigation');
  const [jurisdiction, setJurisdiction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const TYPES = ['litigation', 'corporate', 'regulatory', 'advisory'];

  async function handleSubmit() {
    if (!name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/legal/matters', { method: 'POST', body: { orgId, name: name.trim(), type, jurisdiction: jurisdiction.trim() || undefined } });
      onDone();
    } catch (err) {
      setError(err.message || 'Could not open this matter.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginBottom: spacing.md }]}>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Matter name" placeholderTextColor={colors.textMuted} editable={!submitting} />
      <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
        {TYPES.map((t) => <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />)}
      </View>
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={jurisdiction} onChangeText={setJurisdiction} placeholder="Jurisdiction (optional)" placeholderTextColor={colors.textMuted} editable={!submitting} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, (submitting || !name.trim()) && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting || !name.trim()}>
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Open matter</Text>}
      </TouchableOpacity>
    </View>
  );
}

function ClientsTab({ orgId }) {
  const [clients, setClients] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setClients((await orgFetch(`/api/orgs/legal/clients?orgId=${orgId}`)).clients || []);
    } catch (err) {
      setError(err.message || 'Could not load clients.');
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!name.trim()) return;
    try {
      await orgFetch('/api/orgs/legal/clients', { method: 'POST', body: { orgId, name: name.trim() } });
      setName(''); setCreating(false);
      load();
    } catch (err) {
      setError(err.message || 'Could not create this client.');
    }
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Clients</Text>
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && (
        <View style={[styles.card, { marginBottom: spacing.md }]}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Client name" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={styles.button} onPress={create}><Text style={styles.buttonText}>Create</Text></TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!clients ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : clients.length === 0 ? (
        <Text style={styles.emptyText}>No clients yet.</Text>
      ) : (
        clients.map((c) => (
          <View key={c.id} style={styles.card}>
            <Text style={styles.cardTitle}>{c.name}</Text>
            <Text style={styles.cardMeta}>{c.status}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function ProspectsTab({ orgId }) {
  const [prospects, setProspects] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function create() {
    if (!name.trim()) return;
    try {
      const data = await orgFetch('/api/orgs/legal/prospects', { method: 'POST', body: { orgId, name: name.trim() } });
      setProspects((prev) => [...prev, data.prospect]);
      setName('');
    } catch (err) {
      setError(err.message || 'Could not intake this prospect.');
    }
  }

  async function decide(prospectId, decision) {
    try {
      const data = await orgFetch('/api/orgs/legal/prospects', { method: 'PATCH', body: { orgId, prospectId, decision } });
      setProspects((prev) => prev.map((p) => (p.id === prospectId ? data.prospect : p)));
    } catch (err) {
      setError(err.message || 'Could not update this prospect.');
    }
  }

  return (
    <View>
      <Text style={styles.noteText}>Prospective clients are kept restricted (Confidential classification) — intake is tracked here separately from full clients until you decide to engage.</Text>
      <View style={[styles.card, { marginTop: spacing.md, marginBottom: spacing.md }]}>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Prospect name" placeholderTextColor={colors.textMuted} />
        <TouchableOpacity style={styles.button} onPress={create}><Text style={styles.buttonText}>Intake prospect</Text></TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {prospects.length === 0 ? (
        <Text style={styles.emptyText}>No prospects intaken this session yet.</Text>
      ) : (
        prospects.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <View style={styles.row}>
              <Text style={styles.rowRight}>{p.status}</Text>
              {p.status === 'intake' && (
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <TouchableOpacity onPress={() => decide(p.id, 'engage')}><Text style={[styles.linkText, { color: colors.success }]}>Engage</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => decide(p.id, 'decline')}><Text style={[styles.linkText, { color: colors.danger }]}>Decline</Text></TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function EntitiesTab({ orgId }) {
  const [entities, setEntities] = useState(null);
  const [name, setName] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntities((await orgFetch(`/api/orgs/legal/entities?orgId=${orgId}`)).entities || []);
    } catch (err) {
      setError(err.message || 'Could not load entities.');
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!name.trim()) return;
    try {
      await orgFetch('/api/orgs/legal/entities', { method: 'POST', body: { orgId, name: name.trim(), jurisdiction: jurisdiction.trim() || undefined } });
      setName(''); setJurisdiction(''); setCreating(false);
      load();
    } catch (err) {
      setError(err.message || 'Could not create this entity.');
    }
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Entities</Text>
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && (
        <View style={[styles.card, { marginBottom: spacing.md }]}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Entity name" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={jurisdiction} onChangeText={setJurisdiction} placeholder="Jurisdiction (optional)" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={styles.button} onPress={create}><Text style={styles.buttonText}>Create</Text></TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!entities ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : entities.length === 0 ? (
        <Text style={styles.emptyText}>No corporate entities yet.</Text>
      ) : (
        entities.map((e) => (
          <View key={e.id} style={styles.card}>
            <Text style={styles.cardTitle}>{e.name}</Text>
            <Text style={styles.cardMeta}>{e.jurisdiction || 'No jurisdiction'}</Text>
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
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontFamily: fonts.sansExtraBold, color: colors.textPrimary },
  card: { ...glassCard, padding: spacing.lg, marginTop: spacing.sm },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  noteText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  linkText: { fontFamily: fonts.sansBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  rowRight: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
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
