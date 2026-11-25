// src/screens/business/MyJobsScreen.js -- Manage Orders SOW §10.1-10.3: the technician's day in the Inaya app.
// Attendance (clock in/out, breaks) uses the existing Time & Rota API (/api/orgs/workforce/time/*); jobs come from
// /api/orgs/ops/day. Every tap sends a request key; a failed request keeps the SAME key so "Try again" can never record
// twice. Nothing is shown as done until the server confirms it. Online-first: with no connection nothing is saved and
// the screen says so (no silent offline queue).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';
import { flushQueue, onQueueChange } from '../../utils/jobQueue';

export const reqKey = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
export const human = (s) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (x) => x.toUpperCase());
export const when = (iso) => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not scheduled');
const PUNCH = { CLOCK_IN: 'Clock in', BREAK_START: 'Start break', BREAK_END: 'End break', CLOCK_OUT: 'Clock out' };
const STATE = { WORKING: 'Clocked in', ON_BREAK: 'On break', OFF: 'Not clocked in' };

export default function MyJobsScreen({ route, navigation }) {
  const { orgId } = route.params;
  const [day, setDay] = useState(null); const [branches, setBranches] = useState([]); const [err, setErr] = useState('');
  const [pending, setPending] = useState(null); // { type, key } of an unconfirmed punch
  const [busy, setBusy] = useState(false); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { const [d, l] = await Promise.all([orgFetch(`/api/orgs/ops/day?orgId=${orgId}`), orgFetch(`/api/orgs/workforce/me/locations?orgId=${orgId}`)]); setDay(d); setBranches(l.locations || []); setErr(''); }
    catch (e) { setErr(e.message || 'Could not load your day.'); }
  }, [orgId]);
  useEffect(() => { load(); const unsub = navigation.addListener('focus', load); return unsub; }, [load, navigation]);
  const [queue, setQueue] = useState([]);
  useEffect(() => onQueueChange(setQueue), []);
  useEffect(() => { const t = setInterval(() => flushQueue().then((r) => { if (r.sent) load(); }), 30000); return () => clearInterval(t); }, [load]);

  const branchId = day?.attendance?.locationId || day?.shifts?.[0]?.locationId || branches[0]?.id;
  const punch = async (type, keyToUse) => {
    const k = keyToUse || reqKey(); setPending({ type, key: k }); setBusy(true); setErr('');
    try { await orgFetch('/api/orgs/workforce/time/punch', { method: 'POST', body: { orgId, type, locationId: branchId, idempotencyKey: k } }); setPending(null); await load(); }
    catch (e) { setErr(e.status ? e.message : 'No connection. Nothing was saved. Tap "Try again".'); if (e.status && e.status < 500) setPending(null); }
    finally { setBusy(false); }
  };

  if (!day && !err) return <View style={styles.center}><ActivityIndicator color={colors.cyan} /></View>;
  const att = day?.attendance;
  const Job = ({ j }) => (
    <TouchableOpacity style={styles.job} onPress={() => navigation.navigate('Job', { orgId, jobId: j.id, title: j.number })} accessibilityRole="button" accessibilityLabel={`${j.number} ${j.title}`}>
      <View style={{ flex: 1 }}>
        <Text style={styles.jobTitle}>{j.number} · {j.title}</Text>
        <Text style={styles.muted}>{when(j.mySlot?.start)} · {human(j.status)}{j.priority === 'URGENT' || j.priority === 'HIGH' ? ` · ${j.priority}` : ''}</Text>
        {!j.myAck && <Text style={styles.warn}>New: tap to acknowledge</Text>}
      </View>
      <Text style={[styles.badge, j.myState === 'ACTIVE' && { color: colors.success, borderColor: colors.success }, j.myState === 'PAUSED' && { color: colors.warning, borderColor: colors.warning }]}>{human(j.myState)}</Text>
    </TouchableOpacity>
  );
  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.cyan} />}>
      {!!err && <Text style={styles.error} accessibilityLiveRegion="polite">{err}</Text>}
      {!!queue.length && <TouchableOpacity style={[styles.card, { borderColor: colors.warning }]} onPress={() => flushQueue().then(load)} accessibilityRole="button">
        <Text style={styles.warn}>{queue.filter((x) => x.status === 'pending').length} job update(s) waiting on this phone{queue.some((x) => x.status === 'failed') ? ', some failed' : ''}{queue.some((x) => x.status === 'review') ? ', some need manager review' : ''}. Tap to send now.</Text>
      </TouchableOpacity>}
      {att && <View style={styles.card}>
        <Text style={styles.h}>Attendance</Text>
        <Text style={styles.big}>{STATE[att.state] || att.state}</Text>
        {att.since && <Text style={styles.muted}>Since {when(att.since)}</Text>}
        {day.shifts.map((s) => <Text key={s.id} style={styles.muted}>Shift {when(s.start)} – {new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>)}
        {!branchId && <Text style={styles.warn}>You have no branch yet. Ask your manager.</Text>}
        <View style={styles.row}>{(att.next || []).map((t) => (
          <TouchableOpacity key={t} style={[styles.btn, t === 'CLOCK_IN' && styles.primary]} disabled={busy || !branchId} onPress={() => punch(t)} accessibilityRole="button">
            <Text style={[styles.btnText, t === 'CLOCK_IN' && styles.primaryText]}>{PUNCH[t]}</Text>
          </TouchableOpacity>))}</View>
        {pending && <View style={styles.row}><Text style={styles.warn}>{busy ? `Sending "${PUNCH[pending.type]}"…` : `"${PUNCH[pending.type]}" was not confirmed.`}</Text>{!busy && <TouchableOpacity style={styles.btn} onPress={() => punch(pending.type, pending.key)}><Text style={styles.btnText}>Try again</Text></TouchableOpacity>}</View>}
        <Text style={styles.tiny}>Being clocked in is separate from working on a job: start each job from its screen.</Text>
      </View>}
      {day?.current && <View style={[styles.card, { borderColor: colors.success }]}><Text style={styles.h}>Working on now</Text><Job j={day.current} /></View>}
      <View style={styles.card}><Text style={styles.h}>Today ({day?.today?.length || 0})</Text>{(day?.today || []).map((j) => <Job key={j.id} j={j} />)}{!day?.today?.length && <Text style={styles.muted}>No jobs scheduled today.</Text>}</View>
      <View style={styles.card}><Text style={styles.h}>Upcoming ({day?.upcoming?.length || 0})</Text>{(day?.upcoming || []).map((j) => <Job key={j.id} j={j} />)}{!day?.upcoming?.length && <Text style={styles.muted}>Nothing else assigned.</Text>}</View>
      {!!day?.notifications?.length && <View style={styles.card}><Text style={styles.h}>Updates</Text>{day.notifications.map((n) => <View key={n.id || n._id} style={{ marginBottom: spacing.sm }}><Text style={styles.jobTitle}><Ionicons name="notifications-outline" size={13} color={colors.cyan} /> {n.title}</Text><Text style={styles.muted}>{n.body}</Text></View>)}</View>}
    </ScrollView>
  );
}

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  card: { ...glassCard, padding: spacing.lg, marginBottom: spacing.lg, borderRadius: radius.lg },
  h: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  big: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  muted: { color: colors.textSecondary, fontSize: 13 },
  tiny: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  warn: { color: colors.warning, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14, marginBottom: spacing.md, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  btn: { minHeight: 52, minWidth: 120, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderAccent, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  btnText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  primary: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  primaryText: { color: '#001018' },
  danger: { borderColor: colors.danger },
  job: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 56 },
  jobTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  badge: { color: colors.textSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.textPrimary, paddingHorizontal: spacing.md, backgroundColor: colors.surface, fontSize: 15, marginTop: spacing.sm },
});
void fonts;
