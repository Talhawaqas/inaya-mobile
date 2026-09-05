// src/screens/business/PatientDetailScreen.js
//
// Patient 360 — GET /api/orgs/health/patients/:id aggregates encounters,
// clinical records, appointments, consents, and recent access in one
// call; appointments/consent/ROI/billing/care-team are separate
// sections each hitting their own route, mirroring the web
// Patient360Modal in HealthView.js section-for-section. A 404 here means
// "not on this patient's care team" — the one path where a normal
// screen replaces itself with a break-glass request instead of just
// showing an error, same as the web modal does.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

function Row({ left, right }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLeft} numberOfLines={1}>{left}</Text>
      <Text style={styles.rowRight}>{right}</Text>
    </View>
  );
}

function SectionHeader({ title, onAdd, adding }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onAdd && (
        <TouchableOpacity onPress={onAdd}>
          <Text style={styles.linkText}>{adding ? 'Close' : '+ Add'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function PatientDetailScreen({ route, navigation }) {
  const { orgId, patientId, title } = route.params;
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [requestingAccess, setRequestingAccess] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await orgFetch(`/api/orgs/health/patients/${patientId}?orgId=${orgId}`));
    } catch (err) {
      setError({ message: err.message || 'Could not load this patient.', notFound: err.status === 404 });
    }
  }, [orgId, patientId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title }); }, [navigation, title]);

  async function requestEmergencyAccess() {
    setRequestingAccess(true);
    try {
      await orgFetch('/api/orgs/health/breakglass', { method: 'POST', body: { orgId, patientId, reason: 'Emergency access requested from mobile app' } });
      load();
    } catch (err) {
      setError({ message: err.message || 'Could not request emergency access.' });
    } finally {
      setRequestingAccess(false);
    }
  }

  if (error) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
        <Text style={styles.error}>{error.message}</Text>
        {error.notFound && (
          <TouchableOpacity style={[styles.button, styles.emergencyButton, requestingAccess && styles.buttonDisabled]} onPress={requestEmergencyAccess} disabled={requestingAccess}>
            {requestingAccess ? <ActivityIndicator color={colors.warning} /> : <Text style={styles.emergencyButtonText}>🚨 Request emergency access</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }
  if (!detail) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.metaText}>{detail.patient.facility || 'No facility'} · DOB {detail.patient.dateOfBirth} · consent: {detail.patient.consentStatus}</Text>

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <SectionHeader title={`Encounters (${detail.encounters.length})`} />
        {detail.encounters.length === 0 ? <Text style={styles.emptyText}>None.</Text> : detail.encounters.map((e) => <Row key={e.id} left={e.reason || 'Encounter'} right={e.date} />)}
      </View>

      <View style={[styles.card, { marginTop: spacing.md }]}>
        <SectionHeader title={`Clinical records (${detail.clinicalRecords.length})`} />
        {detail.clinicalRecords.length === 0 ? <Text style={styles.emptyText}>None.</Text> : detail.clinicalRecords.map((r) => <Row key={r.id} left={r.template} right={r.status} />)}
      </View>

      <AppointmentsSection orgId={orgId} patientId={patientId} appointments={detail.appointments} onChanged={load} />
      <ConsentSection orgId={orgId} patientId={patientId} consents={detail.consents} onChanged={load} />
      <RoiSection orgId={orgId} patientId={patientId} />
      <BillingSection orgId={orgId} patientId={patientId} />
      <CareTeamSection orgId={orgId} patientId={patientId} />

      <View style={[styles.card, { marginTop: spacing.md }]}>
        <SectionHeader title="Recent access" />
        {detail.recentAccess.length === 0 ? <Text style={styles.emptyText}>None.</Text> : detail.recentAccess.slice(0, 5).map((a, i) => <Row key={i} left={a.actorEmail} right={a.action} />)}
      </View>
    </ScrollView>
  );
}

function AppointmentsSection({ orgId, patientId, appointments, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('');
  const [startAt, setStartAt] = useState('');
  const [error, setError] = useState('');

  async function create() {
    if (!type.trim() || !startAt.trim()) return;
    try {
      await orgFetch('/api/orgs/health/appointments', { method: 'POST', body: { orgId, patientId, type: type.trim(), startAt: new Date(startAt.trim()).toISOString() } });
      setAdding(false); setType(''); setStartAt('');
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not schedule this appointment.');
    }
  }

  const NEXT_STATUS = { SCHEDULED: 'CONFIRMED', CONFIRMED: 'COMPLETED' };
  async function advance(appointmentId, status) {
    const next = NEXT_STATUS[status];
    if (!next) return;
    try {
      await orgFetch('/api/orgs/health/appointments', { method: 'PATCH', body: { orgId, appointmentId, status: next } });
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not update this appointment.');
    }
  }

  return (
    <View style={[styles.card, { marginTop: spacing.md }]}>
      <SectionHeader title={`Appointments (${appointments.length})`} onAdd={() => setAdding((v) => !v)} adding={adding} />
      {adding && (
        <View style={{ marginBottom: spacing.sm }}>
          <TextInput style={styles.input} value={type} onChangeText={setType} placeholder="Type (e.g. checkup)" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={startAt} onChangeText={setStartAt} placeholder="Start (YYYY-MM-DD HH:MM)" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={styles.smallButton} onPress={create}><Text style={styles.smallButtonText}>Schedule</Text></TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {appointments.length === 0 ? <Text style={styles.emptyText}>None.</Text> : appointments.map((a) => (
        <View key={a.id} style={styles.row}>
          <Text style={styles.rowLeft} numberOfLines={1}>{a.type} · {a.startAt?.slice(0, 16).replace('T', ' ')}</Text>
          {NEXT_STATUS[a.status] ? (
            <TouchableOpacity onPress={() => advance(a.id, a.status)}><Text style={styles.linkText}>{a.status} → {NEXT_STATUS[a.status]}</Text></TouchableOpacity>
          ) : <Text style={styles.rowRight}>{a.status}</Text>}
        </View>
      ))}
    </View>
  );
}

function ConsentSection({ orgId, patientId, consents, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');

  async function create() {
    if (!type.trim() || !purpose.trim()) return;
    try {
      await orgFetch('/api/orgs/health/consents', { method: 'POST', body: { orgId, patientId, type: type.trim(), purpose: purpose.trim() } });
      setAdding(false); setType(''); setPurpose('');
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not record this consent.');
    }
  }

  async function withdraw(consentId) {
    try {
      await orgFetch('/api/orgs/health/consents', { method: 'PATCH', body: { orgId, consentId } });
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not withdraw this consent.');
    }
  }

  return (
    <View style={[styles.card, { marginTop: spacing.md }]}>
      <SectionHeader title={`Consents (${consents.length})`} onAdd={() => setAdding((v) => !v)} adding={adding} />
      {adding && (
        <View style={{ marginBottom: spacing.sm }}>
          <TextInput style={styles.input} value={type} onChangeText={setType} placeholder="Type (e.g. treatment)" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={purpose} onChangeText={setPurpose} placeholder="Purpose" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={styles.smallButton} onPress={create}><Text style={styles.smallButtonText}>Record</Text></TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {consents.length === 0 ? <Text style={styles.emptyText}>None.</Text> : consents.map((c) => (
        <View key={c.id} style={styles.row}>
          <Text style={styles.rowLeft} numberOfLines={1}>{c.type} — {c.purpose}</Text>
          {c.status === 'ACTIVE' ? <TouchableOpacity onPress={() => withdraw(c.id)}><Text style={[styles.linkText, { color: colors.danger }]}>Withdraw</Text></TouchableOpacity> : <Text style={styles.rowRight}>{c.status}</Text>}
        </View>
      ))}
    </View>
  );
}

function RoiSection({ orgId, patientId }) {
  const [requests, setRequests] = useState(null);
  const [adding, setAdding] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRequests((await orgFetch(`/api/orgs/health/roi?orgId=${orgId}&patientId=${patientId}`)).requests || []);
    } catch (err) {
      setError(err.message || 'Could not load ROI requests.');
    }
  }, [orgId, patientId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!purpose.trim()) return;
    try {
      await orgFetch('/api/orgs/health/roi', { method: 'POST', body: { orgId, patientId, purpose: purpose.trim(), recipient: { name: recipientName.trim() || undefined }, requestedRecordIds: [] } });
      setAdding(false); setPurpose(''); setRecipientName('');
      load();
    } catch (err) {
      setError(err.message || 'Could not create this request.');
    }
  }

  async function decide(roiRequestId, action) {
    try {
      await orgFetch('/api/orgs/health/roi', { method: 'PATCH', body: { orgId, roiRequestId, action } });
      load();
    } catch (err) {
      setError(err.message || 'Could not update this request.');
    }
  }

  return (
    <View style={[styles.card, { marginTop: spacing.md }]}>
      <SectionHeader title={`Release of information (${requests?.length ?? '…'})`} onAdd={() => setAdding((v) => !v)} adding={adding} />
      {adding && (
        <View style={{ marginBottom: spacing.sm }}>
          <TextInput style={styles.input} value={purpose} onChangeText={setPurpose} placeholder="Purpose (e.g. insurance claim)" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={recipientName} onChangeText={setRecipientName} placeholder="Recipient (optional)" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={styles.smallButton} onPress={create}><Text style={styles.smallButtonText}>Request</Text></TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!requests || requests.length === 0 ? <Text style={styles.emptyText}>None.</Text> : requests.map((r) => (
        <View key={r.id} style={styles.row}>
          <Text style={styles.rowLeft} numberOfLines={1}>{r.purpose}</Text>
          {r.status === 'REQUESTED' && <TouchableOpacity onPress={() => decide(r.id, 'authorize')}><Text style={styles.linkText}>Authorize</Text></TouchableOpacity>}
          {r.status === 'AUTHORIZED' && (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity onPress={() => decide(r.id, 'approve')}><Text style={[styles.linkText, { color: colors.success }]}>Approve</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => decide(r.id, 'reject')}><Text style={[styles.linkText, { color: colors.danger }]}>Reject</Text></TouchableOpacity>
            </View>
          )}
          {['APPROVED', 'REJECTED'].includes(r.status) && <Text style={styles.rowRight}>{r.status}</Text>}
        </View>
      ))}
    </View>
  );
}

function BillingSection({ orgId, patientId }) {
  const [invoices, setInvoices] = useState(null);
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setInvoices((await orgFetch(`/api/orgs/health/billing?orgId=${orgId}&patientId=${patientId}`)).invoices || []);
    } catch (err) {
      setError(err.message || 'Could not load invoices.');
    }
  }, [orgId, patientId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    const amountNum = parseFloat(amount);
    if (!description.trim() || !amountNum) return;
    try {
      await orgFetch('/api/orgs/health/billing', { method: 'POST', body: { orgId, patientId, lineItems: [{ amount: amountNum, quantity: 1, description: description.trim() }] } });
      setAdding(false); setDescription(''); setAmount('');
      load();
    } catch (err) {
      setError(err.message || 'Could not create this invoice.');
    }
  }

  return (
    <View style={[styles.card, { marginTop: spacing.md }]}>
      <SectionHeader title={`Billing (${invoices?.length ?? '…'})`} onAdd={() => setAdding((v) => !v)} adding={adding} />
      {adding && (
        <View style={{ marginBottom: spacing.sm }}>
          <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Line item description" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
          <TouchableOpacity style={styles.smallButton} onPress={create}><Text style={styles.smallButtonText}>Create invoice</Text></TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!invoices || invoices.length === 0 ? <Text style={styles.emptyText}>None.</Text> : invoices.map((inv) => <Row key={inv.id} left={inv.invoiceNumber} right={`$${inv.total} · ${inv.status}`} />)}
    </View>
  );
}

function CareTeamSection({ orgId, patientId }) {
  const [adding, setAdding] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [assigned, setAssigned] = useState(false);
  const [error, setError] = useState('');

  async function assign() {
    if (!memberEmail.trim()) return;
    try {
      await orgFetch('/api/orgs/health/care-team', { method: 'POST', body: { orgId, patientId, memberEmail: memberEmail.trim(), role: 'member' } });
      setMemberEmail(''); setAssigned(true);
      setTimeout(() => setAssigned(false), 3000);
    } catch (err) {
      setError(err.message || 'Could not assign this member.');
    }
  }

  return (
    <View style={[styles.card, { marginTop: spacing.md }]}>
      <SectionHeader title="Care team" onAdd={() => setAdding((v) => !v)} adding={adding} />
      {adding && (
        <View>
          <TextInput style={styles.input} value={memberEmail} onChangeText={setMemberEmail} placeholder="Member email" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" />
          <TouchableOpacity style={styles.smallButton} onPress={assign}><Text style={styles.smallButtonText}>Assign</Text></TouchableOpacity>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {assigned ? <Text style={styles.successText}>Assigned — they now have access to this patient.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl },
  metaText: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted },
  card: { ...glassCard, padding: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.sansExtraBold, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, gap: spacing.sm },
  rowLeft: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary },
  rowRight: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  emptyText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
  linkText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.cyan, textTransform: 'uppercase', letterSpacing: 0.4 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginBottom: spacing.xs },
  successText: { fontFamily: fonts.sans, fontSize: 11, color: colors.success },
  input: {
    fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  smallButton: { marginTop: spacing.xs, backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.xs, alignItems: 'center' },
  smallButtonText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.4 },
  button: { marginTop: spacing.lg, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  emergencyButton: { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  emergencyButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.warning, textTransform: 'uppercase', letterSpacing: 0.5 },
});
