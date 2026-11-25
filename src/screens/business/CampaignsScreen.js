// src/screens/business/CampaignsScreen.js
//
// Email campaigns on mobile (Mass Marketing Email SOW): results against the
// targets (open >= 25%, click-through >= 5%), the monthly allowance, every
// campaign's status and numbers, and approving or sending back campaigns and
// follow-up sequences waiting for approval, which is the action people most
// need on the go. Same /api/orgs/campaigns/* routes as the web CampaignsView.js;
// the server enforces the plan, the marketing roles and the rule that someone
// other than the submitter approves. Building campaigns is on the web.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, colors } from '../../theme';
import { orgFetch } from '../../utils/orgApi';
import { Chip, Badge, Stat, styles } from './VerticalList';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

export default function CampaignsScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState(null);
  const [sequences, setSequences] = useState([]);
  const [me, setMe] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Email campaigns` }); }, [navigation, orgName]);

  const load = useCallback(async () => {
    setError('');
    try {
      const o = await orgFetch(`/api/orgs/campaigns/options?orgId=${orgId}`);
      setMe(o.me || '');
      const [ov, cs, sq] = await Promise.all([
        orgFetch(`/api/orgs/campaigns/overview?orgId=${orgId}&days=30`),
        orgFetch(`/api/orgs/campaigns/campaigns?orgId=${orgId}`),
        orgFetch(`/api/orgs/campaigns/sequences?orgId=${orgId}`),
      ]);
      setOverview(ov); setCampaigns(cs.campaigns || []); setSequences(sq.sequences || []);
    } catch (err) { setError(err.message || 'Could not load campaigns.'); setCampaigns([]); }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const decide = (kind, id, approve) => {
    const run = async () => {
      try { await orgFetch(`/api/orgs/campaigns/${kind}/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', body: JSON.stringify({ orgId }) }); load(); }
      catch (err) { Alert.alert('Not changed', err.message || 'Please try again.'); }
    };
    Alert.alert(approve ? 'Approve and schedule?' : 'Send back for changes?', approve ? 'It will go out at its scheduled time.' : 'The person who submitted it is told.', [{ text: 'Back' }, { text: approve ? 'Approve' : 'Send back', onPress: run }]);
  };

  const pending = (campaigns || []).filter((c) => c.status === 'PENDING_APPROVAL');
  const pendingSeq = sequences.filter((s) => s.status === 'PENDING_APPROVAL');
  const mine = (x) => (x.approval?.requestedBy || '').toLowerCase() === me.toLowerCase();

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.cyan} />}>
      <View style={styles.tabRow}>
        <Chip label="Overview" active={tab === 'overview'} onPress={() => setTab('overview')} />
        <Chip label="Campaigns" active={tab === 'list'} onPress={() => setTab('list')} />
        <Chip label={`Approvals${pending.length + pendingSeq.length ? ` (${pending.length + pendingSeq.length})` : ''}`} active={tab === 'approvals'} onPress={() => setTab('approvals')} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!campaigns && !error ? <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} /> : null}

      {overview && tab === 'overview' && (
        <View>
          <View style={styles.statRow}>
            <Stat label="Open rate · target 25%" value={pct(overview.rates.open)} tone={overview.rates.open !== null && overview.rates.open >= 25 ? colors.success : undefined} />
            <Stat label="Click-through · target 5%" value={pct(overview.rates.click)} tone={overview.rates.click !== null && overview.rates.click >= 5 ? colors.success : undefined} />
            <Stat label="Bounce rate" value={pct(overview.rates.bounce)} />
            <Stat label="Emails sent (30 days)" value={overview.totals.sent.toLocaleString()} />
          </View>
          <View style={styles.card}><View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>This month: {overview.usage.used.toLocaleString()} of {overview.usage.limit.toLocaleString()} emails</Text>
            <Text style={styles.cardMeta}>{overview.pendingApproval} waiting for approval · {overview.scheduled} scheduled · {overview.suppressed} on the do-not-email list</Text>
          </View></View>
        </View>
      )}

      {campaigns && tab === 'list' && (campaigns.length === 0 ? <Text style={styles.emptyText}>No campaigns yet. Build one in the web Business Workspace.</Text> : campaigns.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{c.name}</Text>
            <Text style={styles.cardMeta}>{c.stats.sent ? `${c.stats.sent} sent · open ${pct(c.rates.open)} · click ${pct(c.rates.click)}` : c.status === 'SCHEDULED' ? `Sends ${new Date(c.nextRunAt).toLocaleString()}` : c.subject || 'No subject yet'}</Text>
          </View>
          <Badge value={c.status} />
        </View>
      )))}

      {tab === 'approvals' && (
        <View>
          {pending.length + pendingSeq.length === 0 ? <Text style={styles.emptyText}>Nothing is waiting for approval.</Text> : null}
          {[...pending.map((x) => ['campaigns', x]), ...pendingSeq.map((x) => ['sequences', x])].map(([kind, x]) => (
            <View key={x.id} style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
              <Text style={styles.cardTitle}>{kind === 'sequences' ? 'Sequence: ' : ''}{x.name}</Text>
              <Text style={styles.cardMeta}>{kind === 'campaigns' ? `Subject: ${x.subject} · ${x.audience?.description || ''}` : `${x.steps.length} emails`}</Text>
              <Text style={styles.cardMeta}>Submitted by {x.approval?.requestedBy}</Text>
              {mine(x) ? <Text style={styles.noteText}>Someone else must approve what you submitted.</Text> : (
                <View style={[styles.tabRow, { marginTop: spacing.sm }]}>
                  <TouchableOpacity style={[styles.chip, styles.chipActive]} onPress={() => decide(kind, x.id, true)}><Text style={[styles.chipText, styles.chipTextActive]}>Approve</Text></TouchableOpacity>
                  <Chip label="Send back" onPress={() => decide(kind, x.id, false)} />
                </View>
              )}
            </View>
          ))}
          <Text style={[styles.noteText, { marginTop: spacing.md }]}>To read the full email before approving, open it in the web Business Workspace (Campaigns → Review).</Text>
        </View>
      )}
    </ScrollView>
  );
}
