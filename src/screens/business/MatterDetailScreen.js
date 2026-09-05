// src/screens/business/MatterDetailScreen.js
//
// Matter workspace — GET /api/orgs/legal/matters/:id returns
// {matter, team, deadlines, evidence}; holds/discovery/redaction/
// contracts/time-entries/trust-accounting are each fetched from their
// own route. Same section-tabs-inside-one-screen shape as the web
// MatterWorkspaceModal in LegalView.js, using a horizontal Chip row
// instead of the web's tab strip since there isn't room for ten tabs
// across a phone screen at once.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const SECTIONS = ['overview', 'team', 'deadlines', 'evidence', 'holds', 'discovery', 'redaction', 'contracts', 'time & billing', 'trust'];

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Row({ left, right }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLeft} numberOfLines={1}>{left}</Text>
      <Text style={styles.rowRight}>{right}</Text>
    </View>
  );
}

export default function MatterDetailScreen({ route, navigation }) {
  const { orgId, matterId, title } = route.params;
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState('overview');

  const load = useCallback(async () => {
    try {
      setDetail(await orgFetch(`/api/orgs/legal/matters/${matterId}?orgId=${orgId}`));
    } catch (err) {
      setError(err.message || 'Could not load this matter.');
    }
  }, [orgId, matterId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title }); }, [navigation, title]);

  if (error) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.error}>{error}</Text>
      </View>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {SECTIONS.map((s) => <Chip key={s} label={s} active={section === s} onPress={() => setSection(s)} />)}
      </ScrollView>

      {section === 'overview' && (
        <View style={styles.card}>
          <Text style={styles.metaText}>{detail.matter.type}{detail.matter.jurisdiction ? ` · ${detail.matter.jurisdiction}` : ''} · {detail.matter.responsiblePartnerEmail}</Text>
          <MatterStatusControl orgId={orgId} matterId={matterId} status={detail.matter.status} onChanged={load} />
        </View>
      )}
      {section === 'team' && <TeamSection orgId={orgId} matterId={matterId} team={detail.team} onChanged={load} />}
      {section === 'deadlines' && <DeadlinesSection orgId={orgId} matterId={matterId} deadlines={detail.deadlines} onChanged={load} />}
      {section === 'evidence' && <EvidenceSection orgId={orgId} matterId={matterId} evidence={detail.evidence} onChanged={load} />}
      {section === 'holds' && <HoldsSection orgId={orgId} matterId={matterId} />}
      {section === 'discovery' && <DiscoverySection orgId={orgId} matterId={matterId} />}
      {section === 'redaction' && <RedactionSection orgId={orgId} matterId={matterId} />}
      {section === 'contracts' && <ContractsSection orgId={orgId} matterId={matterId} />}
      {section === 'time & billing' && <TimeBillingSection orgId={orgId} matterId={matterId} />}
      {section === 'trust' && <TrustAccountingSection orgId={orgId} matterId={matterId} />}
    </ScrollView>
  );
}

function MatterStatusControl({ orgId, matterId, status, onChanged }) {
  const [error, setError] = useState('');
  const ACTIONS = { OPEN: [['activate', 'Activate']], ACTIVE: [['putOnHold', 'Put on hold'], ['close', 'Close']], ON_HOLD: [['resume', 'Resume']], CLOSED: [] };

  async function act(action) {
    try {
      await orgFetch('/api/orgs/legal/matters', { method: 'PATCH', body: { orgId, matterId, action } });
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not update this matter.');
    }
  }

  return (
    <View style={{ marginTop: spacing.sm }}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(ACTIONS[status] || []).map(([action, label]) => (
          <TouchableOpacity key={action} style={styles.actionButton} onPress={() => act(action)}>
            <Text style={styles.actionButtonText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function TeamSection({ orgId, matterId, team, onChanged }) {
  const [memberEmail, setMemberEmail] = useState('');
  const [role, setRole] = useState('associate');
  const [error, setError] = useState('');
  const ROLES = ['partner', 'associate', 'paralegal'];

  async function assign() {
    if (!memberEmail.trim()) return;
    try {
      await orgFetch('/api/orgs/legal/matter-team', { method: 'POST', body: { orgId, matterId, memberEmail: memberEmail.trim(), role } });
      setMemberEmail('');
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not assign this member.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Team ({team.length})</Text>
      <TextInput style={styles.input} value={memberEmail} onChangeText={setMemberEmail} placeholder="Member email" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" />
      <View style={[styles.chipRow, { marginTop: spacing.xs }]}>
        {ROLES.map((r) => <Chip key={r} label={r} active={role === r} onPress={() => setRole(r)} />)}
      </View>
      <TouchableOpacity style={styles.smallButton} onPress={assign}><Text style={styles.smallButtonText}>Assign</Text></TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {team.length === 0 ? <Text style={styles.emptyText}>None.</Text> : team.map((t, i) => <Row key={i} left={t.email} right={t.role} />)}
    </View>
  );
}

function DeadlinesSection({ orgId, matterId, deadlines, onChanged }) {
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');

  async function create() {
    if (!description.trim() || !dueAt.trim()) return;
    try {
      await orgFetch('/api/orgs/legal/deadlines', { method: 'POST', body: { orgId, matterId, description: description.trim(), dueAt: new Date(dueAt.trim()).toISOString(), source: 'manual' } });
      setDescription(''); setDueAt('');
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not add this deadline.');
    }
  }

  async function confirm(deadlineId) {
    try {
      await orgFetch('/api/orgs/legal/deadlines', { method: 'PATCH', body: { orgId, deadlineId } });
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not confirm this deadline.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Deadlines ({deadlines.length})</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.textMuted} />
      <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={dueAt} onChangeText={setDueAt} placeholder="Due (YYYY-MM-DD HH:MM)" placeholderTextColor={colors.textMuted} />
      <TouchableOpacity style={styles.smallButton} onPress={create}><Text style={styles.smallButtonText}>Add</Text></TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {deadlines.length === 0 ? <Text style={styles.emptyText}>None.</Text> : deadlines.map((d) => (
        <View key={d.id} style={styles.row}>
          <Text style={styles.rowLeft} numberOfLines={1}>{d.description} · {d.dueAt?.slice(0, 10)}</Text>
          {!d.manualConfirmation ? <TouchableOpacity onPress={() => confirm(d.id)}><Text style={[styles.linkText, { color: colors.warning }]}>Confirm</Text></TouchableOpacity> : <Text style={[styles.rowRight, { color: colors.success }]}>Confirmed</Text>}
        </View>
      ))}
    </View>
  );
}

function EvidenceSection({ orgId, matterId, evidence, onChanged }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');

  async function acquire() {
    if (!source.trim()) return;
    try {
      await orgFetch('/api/orgs/legal/evidence', { method: 'POST', body: { orgId, matterId, source: source.trim() } });
      setSource('');
      onChanged();
    } catch (err) {
      setError(err.message || 'Could not acquire this evidence item.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Evidence ({evidence.length})</Text>
      <TextInput style={styles.input} value={source} onChangeText={setSource} placeholder="Source (e.g. seized laptop)" placeholderTextColor={colors.textMuted} />
      <TouchableOpacity style={styles.smallButton} onPress={acquire}><Text style={styles.smallButtonText}>Acquire</Text></TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {evidence.length === 0 ? <Text style={styles.emptyText}>None.</Text> : evidence.map((e) => <Row key={e.id} left={`${e.source} · custodian: ${e.custodian}`} right="" />)}
    </View>
  );
}

function HoldsSection({ orgId, matterId }) {
  const [holds, setHolds] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await orgFetch(`/api/orgs/legal/holds?orgId=${orgId}`);
      setHolds((data.holds || []).filter((h) => h.matterId === matterId));
    } catch (err) {
      setError(err.message || 'Could not load holds.');
    }
  }, [orgId, matterId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!reason.trim()) return;
    try {
      await orgFetch('/api/orgs/legal/holds', { method: 'POST', body: { orgId, matterId, scope: 'matter', custodianEmails: [], reason: reason.trim() } });
      setReason('');
      load();
    } catch (err) {
      setError(err.message || 'Could not create this hold.');
    }
  }

  async function act(holdId, action) {
    try {
      await orgFetch('/api/orgs/legal/holds', { method: 'PATCH', body: { orgId, holdId, action } });
      load();
    } catch (err) {
      setError(err.message || 'Could not update this hold.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Legal holds ({holds?.length ?? '…'})</Text>
      <Text style={styles.noteText}>A hold on this matter blocks deletion of related records until released.</Text>
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={reason} onChangeText={setReason} placeholder="Reason for hold" placeholderTextColor={colors.textMuted} />
      <TouchableOpacity style={styles.smallButton} onPress={create}><Text style={styles.smallButtonText}>Create hold</Text></TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!holds || holds.length === 0 ? <Text style={styles.emptyText}>None.</Text> : holds.map((h) => (
        <View key={h.id} style={styles.row}>
          <Text style={styles.rowLeft} numberOfLines={1}>{h.reason}</Text>
          {h.status === 'ACTIVE' ? (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity onPress={() => act(h.id, 'acknowledge')}><Text style={styles.linkText}>Ack</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => act(h.id, 'release')}><Text style={[styles.linkText, { color: colors.danger }]}>Release</Text></TouchableOpacity>
            </View>
          ) : <Text style={styles.rowRight}>{h.status}</Text>}
        </View>
      ))}
    </View>
  );
}

function DiscoverySection({ orgId, matterId }) {
  const [requestingParty, setRequestingParty] = useState('');
  const [respondingParty, setRespondingParty] = useState('');
  const [created, setCreated] = useState(null);
  const [docIds, setDocIds] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function create() {
    if (!requestingParty.trim() || !respondingParty.trim()) return;
    try {
      const data = await orgFetch('/api/orgs/legal/discovery', { method: 'POST', body: { orgId, matterId, requestingParty: requestingParty.trim(), respondingParty: respondingParty.trim() } });
      setCreated(data.discovery);
      setStatus(data.discovery.status);
    } catch (err) {
      setError(err.message || 'Could not create this request.');
    }
  }

  async function addDocs() {
    const ids = docIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return;
    try {
      const data = await orgFetch('/api/orgs/legal/discovery', { method: 'PATCH', body: { orgId, discoveryId: created.id, action: 'addDocuments', documentIds: ids } });
      setDocIds('');
      setStatus(`${data.added} document(s) added`);
    } catch (err) {
      setError(err.message || 'Could not add these documents.');
    }
  }

  async function produce() {
    try {
      const data = await orgFetch('/api/orgs/legal/discovery', { method: 'PATCH', body: { orgId, discoveryId: created.id, action: 'produce' } });
      setStatus(`Produced — ${data.discovery.productionCount} document(s) in production set`);
    } catch (err) {
      setError(err.message || 'Could not produce this set.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Discovery</Text>
      {!created ? (
        <View style={{ marginTop: spacing.sm }}>
          <TextInput style={styles.input} value={requestingParty} onChangeText={setRequestingParty} placeholder="Requesting party" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { marginTop: spacing.xs }]} value={respondingParty} onChangeText={setRespondingParty} placeholder="Responding party" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={styles.smallButton} onPress={create}><Text style={styles.smallButtonText}>Create request</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={styles.rowLeft}>{created.requestingParty} ↔ {created.respondingParty} — {created.status}</Text>
          <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={docIds} onChangeText={setDocIds} placeholder="Document IDs, comma-separated" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity onPress={addDocs} style={{ marginTop: spacing.xs }}><Text style={styles.linkText}>Add documents</Text></TouchableOpacity>
          <Text style={styles.noteText}>The production step excludes anything tagged privileged even if responsive.</Text>
          <TouchableOpacity style={styles.smallButton} onPress={produce}><Text style={styles.smallButtonText}>Produce</Text></TouchableOpacity>
          {status ? <Text style={styles.successText}>{status}</Text> : null}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function RedactionSection({ orgId, matterId }) {
  const [originalDocumentId, setOriginalDocumentId] = useState('');
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');

  async function create() {
    if (!originalDocumentId.trim()) return;
    try {
      const data = await orgFetch('/api/orgs/legal/redaction', { method: 'POST', body: { orgId, matterId, originalDocumentId: originalDocumentId.trim() } });
      setCreated(data.request);
      setOriginalDocumentId('');
    } catch (err) {
      setError(err.message || 'Could not create this redaction request.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Redaction</Text>
      <Text style={styles.noteText}>Redacting a document never mutates the original — it produces a new, separately-linked redacted document.</Text>
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={originalDocumentId} onChangeText={setOriginalDocumentId} placeholder="Original document ID" placeholderTextColor={colors.textMuted} />
      <TouchableOpacity style={styles.smallButton} onPress={create}><Text style={styles.smallButtonText}>Request redaction</Text></TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {created ? <Text style={styles.successText}>Redaction request {created.id} created — status {created.status}.</Text> : null}
    </View>
  );
}

function ContractsSection({ orgId, matterId }) {
  const [contracts, setContracts] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const NEXT_ACTION = { INTAKE: 'startDrafting', DRAFT: 'submitForReview', REVIEW: 'approve', APPROVED: 'sendForNegotiation', NEGOTIATION: 'sign' };

  const load = useCallback(async () => {
    try {
      setContracts((await orgFetch(`/api/orgs/legal/contracts?orgId=${orgId}&matterId=${matterId}`)).contracts || []);
    } catch (err) {
      setError(err.message || 'Could not load contracts.');
    }
  }, [orgId, matterId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!name.trim()) return;
    try {
      await orgFetch('/api/orgs/legal/contracts', { method: 'POST', body: { orgId, matterId, name: name.trim() } });
      setName('');
      load();
    } catch (err) {
      setError(err.message || 'Could not create this contract.');
    }
  }

  async function advance(contractId, status) {
    const action = NEXT_ACTION[status];
    if (!action) return;
    try {
      await orgFetch('/api/orgs/legal/contracts', { method: 'PATCH', body: { orgId, contractId, action } });
      load();
    } catch (err) {
      setError(err.message || 'Could not advance this contract.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Contracts ({contracts?.length ?? '…'})</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Contract name" placeholderTextColor={colors.textMuted} />
      <TouchableOpacity style={styles.smallButton} onPress={create}><Text style={styles.smallButtonText}>Create</Text></TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!contracts || contracts.length === 0 ? <Text style={styles.emptyText}>None.</Text> : contracts.map((c) => (
        <View key={c.id} style={styles.row}>
          <Text style={styles.rowLeft} numberOfLines={1}>{c.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.rowRight}>{c.status}</Text>
            {NEXT_ACTION[c.status] && <TouchableOpacity onPress={() => advance(c.id, c.status)}><Text style={styles.linkText}>Advance</Text></TouchableOpacity>}
          </View>
        </View>
      ))}
    </View>
  );
}

function TimeBillingSection({ orgId, matterId }) {
  const [entries, setEntries] = useState(null);
  const [minutes, setMinutes] = useState('');
  const [rate, setRate] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [billResult, setBillResult] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setEntries((await orgFetch(`/api/orgs/legal/time-entries?orgId=${orgId}&matterId=${matterId}`)).timeEntries || []);
    } catch (err) {
      setError(err.message || 'Could not load time entries.');
    }
  }, [orgId, matterId]);

  useEffect(() => { load(); }, [load]);

  async function logTime() {
    const min = parseInt(minutes, 10);
    if (!min || !taskDescription.trim()) return;
    try {
      await orgFetch('/api/orgs/legal/time-entries', { method: 'POST', body: { orgId, matterId, minutes: min, rate: parseFloat(rate) || 0, taskDescription: taskDescription.trim() } });
      setMinutes(''); setRate(''); setTaskDescription('');
      load();
    } catch (err) {
      setError(err.message || 'Could not log this time entry.');
    }
  }

  async function advance(timeEntryId, action) {
    try {
      await orgFetch('/api/orgs/legal/time-entries', { method: 'PATCH', body: { orgId, timeEntryId, action } });
      load();
    } catch (err) {
      setError(err.message || 'Could not update this time entry.');
    }
  }

  async function generateBill() {
    try {
      const data = await orgFetch('/api/orgs/legal/billing', { method: 'POST', body: { orgId, matterId, arrangement: 'hourly' } });
      setBillResult(`Generated bill for $${data.billing.total}`);
      load();
    } catch (err) {
      setError(err.message || 'Could not generate this bill.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Time & billing ({entries?.length ?? '…'})</Text>
      <TextInput style={styles.input} value={taskDescription} onChangeText={setTaskDescription} placeholder="Task" placeholderTextColor={colors.textMuted} />
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={minutes} onChangeText={setMinutes} placeholder="Minutes" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
        <TextInput style={[styles.input, { flex: 1 }]} value={rate} onChangeText={setRate} placeholder="Rate/hr" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
      </View>
      <TouchableOpacity style={styles.smallButton} onPress={logTime}><Text style={styles.smallButtonText}>Log</Text></TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!entries || entries.length === 0 ? <Text style={styles.emptyText}>None.</Text> : entries.map((t) => (
        <View key={t.id} style={styles.row}>
          <Text style={styles.rowLeft} numberOfLines={1}>{t.taskDescription} · {t.minutes}min</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.rowRight}>{t.status}</Text>
            {t.status === 'DRAFT' && <TouchableOpacity onPress={() => advance(t.id, 'submit')}><Text style={styles.linkText}>Submit</Text></TouchableOpacity>}
            {t.status === 'SUBMITTED' && <TouchableOpacity onPress={() => advance(t.id, 'approve')}><Text style={[styles.linkText, { color: colors.success }]}>Approve</Text></TouchableOpacity>}
          </View>
        </View>
      ))}
      <TouchableOpacity onPress={generateBill} style={{ marginTop: spacing.sm }}><Text style={styles.linkText}>Generate hourly bill from approved time</Text></TouchableOpacity>
      {billResult ? <Text style={styles.successText}>{billResult}</Text> : null}
    </View>
  );
}

function TrustAccountingSection({ orgId, matterId }) {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await orgFetch(`/api/orgs/legal/trust-accounting?orgId=${orgId}&matterId=${matterId}`);
      setBalance(data.balance);
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err.message || 'Could not load the trust ledger.');
    }
  }, [orgId, matterId]);

  useEffect(() => { load(); }, [load]);

  async function transact(type) {
    const amt = parseFloat(amount);
    if (!amt) return;
    setError('');
    try {
      await orgFetch('/api/orgs/legal/trust-accounting', { method: 'POST', body: { orgId, matterId, type, amount: amt } });
      setAmount('');
      load();
    } catch (err) {
      setError(err.message || 'Could not record this transaction.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Trust accounting — balance: {balance === null ? '…' : `$${balance}`}</Text>
      <Text style={styles.noteText}>A withdrawal can never exceed this matter's real trust balance — enforced server-side, not just in this form.</Text>
      <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        <TouchableOpacity style={[styles.smallButton, { flex: 1 }]} onPress={() => transact('deposit')}><Text style={styles.smallButtonText}>Deposit</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.smallButton, styles.withdrawButton, { flex: 1 }]} onPress={() => transact('withdrawal')}><Text style={[styles.smallButtonText, { color: colors.danger }]}>Withdraw</Text></TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {transactions.length === 0 ? <Text style={styles.emptyText}>None.</Text> : transactions.map((t) => <Row key={t.id} left={`${t.type} — $${t.amount}`} right={t.createdAt?.slice(0, 10)} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl },
  tabScroll: { marginBottom: spacing.md },
  tabRow: { flexDirection: 'row', gap: spacing.xs },
  card: { ...glassCard, padding: spacing.lg },
  sectionTitle: { fontFamily: fonts.sansExtraBold, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.xs },
  metaText: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted },
  noteText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, lineHeight: 16, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, gap: spacing.sm },
  rowLeft: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary },
  rowRight: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  emptyText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  linkText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.cyan, textTransform: 'uppercase', letterSpacing: 0.4 },
  successText: { fontFamily: fonts.sans, fontSize: 11, color: colors.success, marginTop: spacing.xs },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.xs },
  input: {
    fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.xs,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: 'rgba(0,242,254,0.3)' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary, textTransform: 'capitalize' },
  chipTextActive: { color: colors.cyan },
  smallButton: { marginTop: spacing.sm, backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  smallButtonText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.4 },
  withdrawButton: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  actionButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionButtonText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
});
