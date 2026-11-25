// src/screens/business/AppointmentsScreen.js
//
// Appointments on mobile (Appointment Calendar SOW): the dashboard cards, the
// upcoming list with Join buttons, a day-by-day agenda (mine or the whole team
// for calendar managers), and the everyday actions: confirm, mark completed /
// no-show with an outcome note (which updates the CRM record), cancel.
// Same /api/orgs/appointments/* routes as the web AppointmentsView.js, so the
// plan gate (Business/Enterprise) and roles are enforced by the server.
// Setup (types, booking pages, availability, calendar sync) is on the web.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Linking, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, colors } from '../../theme';
import { orgFetch } from '../../utils/orgApi';
import { Chip, Badge, Stat, styles } from './VerticalList';

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDay = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const change = (v) => (v === null || v === undefined ? 'new' : `${v >= 0 ? '▲' : '▼'} ${Math.abs(v)}%`);

export default function AppointmentsScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('overview');
  const [scope, setScope] = useState('mine');
  const [options, setOptions] = useState(null);
  const [dash, setDash] = useState(null);
  const [agenda, setAgenda] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Appointments` }); }, [navigation, orgName]);

  const load = useCallback(async () => {
    setError('');
    try {
      const o = await orgFetch(`/api/orgs/appointments/options?orgId=${orgId}`);
      setOptions(o);
      const s = o.canManage ? scope : 'mine';
      const [d, a] = await Promise.all([
        orgFetch(`/api/orgs/appointments/dashboard?orgId=${orgId}&scope=${s}&period=month&timeZone=${encodeURIComponent(tz())}`),
        orgFetch(`/api/orgs/appointments/appointments?orgId=${orgId}&scope=${s}&from=${new Date(Date.now() - 86400000).toISOString()}&to=${new Date(Date.now() + 14 * 86400000).toISOString()}&status=PENDING,CONFIRMED,COMPLETED,NO_SHOW`),
      ]);
      setDash(d); setAgenda(a.appointments || []);
    } catch (err) { setError(err.message || 'Could not load appointments.'); setDash(null); setAgenda([]); }
  }, [orgId, scope]);

  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const byDay = {};
  for (const a of agenda || []) { const k = fmtDay(a.start); (byDay[k] = byDay[k] || []).push(a); }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.cyan} />}>
      <View style={styles.tabRow}>
        <Chip label="Overview" active={tab === 'overview'} onPress={() => setTab('overview')} />
        <Chip label="Agenda" active={tab === 'agenda'} onPress={() => setTab('agenda')} />
        {options?.canManage ? <Chip label={scope === 'team' ? 'Whole team' : 'My calendar'} active={scope === 'team'} onPress={() => setScope(scope === 'team' ? 'mine' : 'team')} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!dash && !error ? <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} /> : null}

      {dash && tab === 'overview' && (
        <View>
          <View style={styles.statRow}>
            <Stat label={`Total appointments · ${change(dash.cards.total.change)}`} value={dash.cards.total.value} />
            <Stat label={`Completed · ${change(dash.cards.completed.change)}`} value={dash.cards.completed.value} />
            <Stat label={`Upcoming today · ${change(dash.cards.upcomingToday.change)}`} value={dash.cards.upcomingToday.value} />
            <Stat label={`Customers engaged · ${change(dash.cards.customersEngaged.change)}`} value={dash.cards.customersEngaged.value} />
          </View>
          <Text style={styles.cardTitle}>Upcoming</Text>
          {dash.upcoming.length === 0 ? <Text style={styles.emptyText}>Nothing booked yet.</Text> : dash.upcoming.map((a) => <Row key={a.id} a={a} showStaff={scope === 'team'} onPress={() => setOpen(a)} />)}
          <View style={[styles.card, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={styles.cardTitle}>Calendar sync</Text>
            <Text style={styles.cardMeta}>{dash.sync.feedEnabled ? '✓ In your calendar app' : 'Not in your calendar app yet'} · {dash.sync.importConnected ? '✓ Busy times read from your calendar' : 'Own calendar not connected'}</Text>
            <Text style={styles.cardMeta}>Booking completion: {dash.rates.bookingCompletion === null ? '—' : `${dash.rates.bookingCompletion}%`} (target 80%)</Text>
          </View>
        </View>
      )}

      {dash && tab === 'agenda' && (
        Object.keys(byDay).length === 0 ? <Text style={styles.emptyText}>No appointments in the next two weeks.</Text> : Object.entries(byDay).map(([day, list]) => (
          <View key={day} style={{ marginTop: spacing.md }}>
            <Text style={styles.cardMeta}>{day}</Text>
            {list.map((a) => <Row key={a.id} a={a} showStaff={scope === 'team'} onPress={() => setOpen(a)} />)}
          </View>
        ))
      )}

      {open && <Actions orgId={orgId} a={open} onDone={() => { setOpen(null); load(); }} onClose={() => setOpen(null)} />}
      <Text style={[styles.noteText, { marginTop: spacing.lg }]}>Appointment types, booking pages, working hours and Google/Outlook sync are set up in the web Business Workspace.</Text>
    </ScrollView>
  );
}

function Row({ a, showStaff, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{fmtTime(a.start)} · {a.customer.name}</Text>
        <Text style={styles.cardMeta}>{a.typeName}{showStaff ? ` · ${a.staffEmail}` : ''}</Text>
      </View>
      {a.location?.joinLink && ['PENDING', 'CONFIRMED'].includes(a.status) ? (
        <TouchableOpacity onPress={() => Linking.openURL(a.location.joinLink)} style={[styles.chip, styles.chipActive]} accessibilityRole="link"><Text style={[styles.chipText, styles.chipTextActive]}>Join</Text></TouchableOpacity>
      ) : <Badge value={a.status} />}
    </TouchableOpacity>
  );
}

function Actions({ orgId, a, onDone, onClose }) {
  const [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState(false);
  const started = new Date(a.start) <= new Date();
  const go = async (status, extra = {}) => {
    setBusy(true);
    try { await orgFetch(`/api/orgs/appointments/appointments/${a.id}/status`, { method: 'POST', body: JSON.stringify({ orgId, status, ...extra }) }); onDone(); }
    catch (err) { Alert.alert('Not changed', err.message || 'Please try again.'); }
    finally { setBusy(false); }
  };
  return (
    <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch', marginTop: spacing.lg }]}>
      <Text style={styles.cardTitle}>{a.typeName} · {a.customer.name}</Text>
      <Text style={styles.cardMeta}>{fmtDay(a.start)} {fmtTime(a.start)}–{fmtTime(a.end)} · {a.customer.email}</Text>
      {a.status === 'CONFIRMED' && started ? (
        <TextInput style={[styles.input, { marginTop: spacing.sm }]} value={outcome} onChangeText={setOutcome} placeholder="Outcome (goes on the CRM record)" placeholderTextColor={colors.textMuted} multiline />
      ) : null}
      <View style={[styles.tabRow, { marginTop: spacing.sm }]}>
        {a.status === 'PENDING' ? <Chip label="Confirm" active onPress={() => !busy && go('CONFIRMED')} /> : null}
        {a.status === 'CONFIRMED' && started ? <Chip label="Completed" active onPress={() => !busy && go('COMPLETED', { outcome })} /> : null}
        {a.status === 'CONFIRMED' && started ? <Chip label="No-show" onPress={() => !busy && go('NO_SHOW')} /> : null}
        {['PENDING', 'CONFIRMED'].includes(a.status) ? <Chip label="Cancel" onPress={() => Alert.alert('Cancel this appointment?', 'The customer is told by email.', [{ text: 'Keep' }, { text: 'Cancel it', style: 'destructive', onPress: () => go('CANCELLED') }])} /> : null}
        <Chip label="Close" onPress={onClose} />
      </View>
    </View>
  );
}
