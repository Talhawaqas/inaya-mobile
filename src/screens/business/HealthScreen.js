// src/screens/business/HealthScreen.js
//
// Health OS (Healthcare & Legal Expansion SOW) — Patients, Emergency
// Access review, and Research Datasets. Same collapsed-tabs-in-one-screen
// pattern CRMScreen.js established; tapping a patient navigates to
// PatientDetailScreen for the full Patient 360 (appointments, consent,
// ROI, billing, care team) — same reasoning DealDetailScreen already
// established for anything with enough sub-actions to deserve its own
// screen. Every call goes through the same vertical-locked
// /api/orgs/health/* routes the web HealthView.js uses; a general or
// legal org gets a real 403 here too, not just a hidden button.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STATUS_COLORS = { active: colors.success, merged: colors.textMuted };

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HealthScreen({ route, navigation }) {
  const { orgId, orgName, role } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('patients');
  const canManage = role === 'owner' || role === 'admin';

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Health OS` }); }, [navigation, orgName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.tabRow}>
        <Chip label="Patients" active={tab === 'patients'} onPress={() => setTab('patients')} />
        <Chip label="Emergency Access" active={tab === 'emergencyAccess'} onPress={() => setTab('emergencyAccess')} />
        <Chip label="Research" active={tab === 'research'} onPress={() => setTab('research')} />
      </View>
      {tab === 'patients' && <PatientsTab orgId={orgId} navigation={navigation} />}
      {tab === 'emergencyAccess' && <EmergencyAccessTab orgId={orgId} canManage={canManage} />}
      {tab === 'research' && <ResearchTab orgId={orgId} canManage={canManage} />}
    </ScrollView>
  );
}

function PatientsTab({ orgId, navigation }) {
  const [patients, setPatients] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ orgId });
      if (search) params.set('search', search);
      setPatients((await orgFetch(`/api/orgs/health/patients?${params.toString()}`)).patients || []);
    } catch (err) {
      setError(err.message || 'Could not load patients.');
    }
  }, [orgId, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <View>
      <View style={styles.headerRow}>
        <TextInput style={[styles.input, { flex: 1 }]} value={search} onChangeText={setSearch} placeholder="Search patients…" placeholderTextColor={colors.textMuted} />
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>
      {creating && <CreatePatientForm orgId={orgId} onDone={() => { setCreating(false); load(); }} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!patients ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : patients.length === 0 ? (
        <Text style={styles.emptyText}>No patients match, or you have no care-team assignments yet.</Text>
      ) : (
        patients.map((p) => (
          <TouchableOpacity key={p.id} style={styles.card} onPress={() => navigation.navigate('PatientDetail', { orgId, patientId: p.id, title: p.preferredName || p.legalName })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{p.preferredName || p.legalName}</Text>
              <Text style={styles.cardMeta}>{p.facility || 'No facility'} · DOB {p.dateOfBirth}</Text>
            </View>
            <View style={[badgeStyles.badge, { borderColor: STATUS_COLORS[p.status] || STATUS_COLORS.active }]}>
              <Text style={[badgeStyles.text, { color: STATUS_COLORS[p.status] || STATUS_COLORS.active }]}>{p.status}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function CreatePatientForm({ orgId, onDone }) {
  const [legalName, setLegalName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [facility, setFacility] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!legalName.trim() || !dateOfBirth.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/health/patients', { method: 'POST', body: { orgId, legalName: legalName.trim(), preferredName: preferredName.trim() || undefined, dateOfBirth: dateOfBirth.trim(), facility: facility.trim() || undefined } });
      onDone();
    } catch (err) {
      setError(err.message || 'Could not register this patient.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginBottom: spacing.md }]}>
      <TextInput style={styles.input} value={legalName} onChangeText={setLegalName} placeholder="Legal name" placeholderTextColor={colors.textMuted} editable={!submitting} />
      <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={preferredName} onChangeText={setPreferredName} placeholder="Preferred name (optional)" placeholderTextColor={colors.textMuted} editable={!submitting} />
      <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor={colors.textMuted} editable={!submitting} />
      <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={facility} onChangeText={setFacility} placeholder="Facility (optional)" placeholderTextColor={colors.textMuted} editable={!submitting} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, (submitting || !legalName.trim() || !dateOfBirth.trim()) && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting || !legalName.trim() || !dateOfBirth.trim()}>
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Register patient</Text>}
      </TouchableOpacity>
    </View>
  );
}

function EmergencyAccessTab({ orgId, canManage }) {
  const [grants, setGrants] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setGrants((await orgFetch(`/api/orgs/health/breakglass?orgId=${orgId}`)).grants || []);
    } catch (err) {
      setError(err.message || 'Could not load emergency access grants.');
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  async function review(assignmentId) {
    try {
      await orgFetch('/api/orgs/health/breakglass', { method: 'PATCH', body: { orgId, assignmentId, reviewNotes: '' } });
      load();
    } catch (err) {
      setError(err.message || 'Could not mark this grant reviewed.');
    }
  }

  if (!canManage) return <Text style={styles.emptyText}>Only a health manager or org owner/admin can review emergency access grants.</Text>;

  return (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!grants ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : grants.length === 0 ? (
        <Text style={styles.emptyText}>No unreviewed emergency access grants.</Text>
      ) : (
        grants.map((g) => (
          <View key={g.id} style={[styles.card, { borderColor: 'rgba(245,158,11,0.3)' }]}>
            <Text style={styles.cardTitle}>{g.email}</Text>
            <Text style={styles.cardMeta}>{g.reason}</Text>
            <Text style={styles.cardMeta}>Expires {g.expiresAt?.slice(0, 16).replace('T', ' ')}</Text>
            <TouchableOpacity onPress={() => review(g.id)} style={{ marginTop: spacing.sm }}>
              <Text style={styles.linkText}>Mark reviewed</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

function ResearchTab({ orgId, canManage }) {
  const [name, setName] = useState('');
  const [methodology, setMethodology] = useState('');
  const [patientIds, setPatientIds] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  async function handleCreate() {
    if (!name.trim() || !methodology.trim()) return;
    setSubmitting(true);
    setError('');
    setCreated(null);
    try {
      const ids = patientIds.split(',').map((s) => s.trim()).filter(Boolean);
      const data = await orgFetch('/api/orgs/health/research', { method: 'POST', body: { orgId, name: name.trim(), methodologyNotes: methodology.trim(), sourcePatientIds: ids } });
      setCreated(data.dataset);
      setName(''); setMethodology(''); setPatientIds('');
    } catch (err) {
      setError(err.message || 'Could not create this dataset.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!canManage) return <Text style={styles.emptyText}>Only a health manager or org owner/admin can create research datasets.</Text>;

  return (
    <View style={styles.card}>
      <Text style={styles.noteText}>De-identified research datasets require a documented methodology — there's no "anonymous" checkbox, you describe exactly what was done to the data.</Text>
      <TextInput style={[styles.input, { marginTop: spacing.md }]} value={name} onChangeText={setName} placeholder="Dataset name" placeholderTextColor={colors.textMuted} editable={!submitting} />
      <TextInput style={[styles.input, styles.textArea, { marginTop: spacing.xs }]} value={methodology} onChangeText={setMethodology} placeholder="De-identification methodology (required)" placeholderTextColor={colors.textMuted} editable={!submitting} multiline numberOfLines={3} />
      <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={patientIds} onChangeText={setPatientIds} placeholder="Source patient IDs, comma-separated" placeholderTextColor={colors.textMuted} editable={!submitting} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, (submitting || !name.trim() || !methodology.trim()) && styles.buttonDisabled]} onPress={handleCreate} disabled={submitting || !name.trim() || !methodology.trim()}>
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Create dataset</Text>}
      </TouchableOpacity>
      {created ? <Text style={styles.successText}>Created "{created.name}" v{created.version} from {created.sourceRecordCount} source record(s).</Text> : null}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  card: { ...glassCard, padding: spacing.lg, marginTop: spacing.sm },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  noteText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  successText: { fontFamily: fonts.sans, fontSize: 11, color: colors.success, marginTop: spacing.sm },
  linkText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.cyan, textTransform: 'uppercase', letterSpacing: 0.4 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: 'rgba(0,242,254,0.3)' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
  chipTextActive: { color: colors.cyan },
  input: {
    fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  textArea: { textAlignVertical: 'top', minHeight: 70 },
  button: { marginTop: spacing.sm, backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
});
