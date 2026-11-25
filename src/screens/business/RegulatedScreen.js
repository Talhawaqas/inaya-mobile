// src/screens/business/RegulatedScreen.js
//
// Regulated Enterprise OS on mobile (Business Workspace gap closure, Batch 4):
// compliance health, controls, findings and exceptions — the same
// /api/orgs/regulated/* routes the web RegulatedView.js uses. Read-only on
// mobile; creating controls, evidence and audits stays on the web.

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { orgFetch } from '../../utils/orgApi';
import { Chip, RemoteList, Stat, Badge, styles } from './VerticalList';

export default function RegulatedScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('health');

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Regulated OS` }); }, [navigation, orgName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.tabRow}>
        <Chip label="Health" active={tab === 'health'} onPress={() => setTab('health')} />
        <Chip label="Controls" active={tab === 'controls'} onPress={() => setTab('controls')} />
        <Chip label="Findings" active={tab === 'findings'} onPress={() => setTab('findings')} />
        <Chip label="Exceptions" active={tab === 'exceptions'} onPress={() => setTab('exceptions')} />
      </View>
      {tab === 'health' && <HealthTab orgId={orgId} />}
      {tab === 'controls' && (
        <RemoteList orgId={orgId} path="regulated/controls" listKey="controls" searchable
          title={(c) => c.name} meta={(c) => `${c.frequency || 'No frequency'} · owner ${c.ownerEmail || '—'}${c.nextTestDueAt ? ` · next test ${c.nextTestDueAt.slice(0, 10)}` : ''}`}
          badge={(c) => c.effectiveness || c.status} empty="No controls yet." />
      )}
      {tab === 'findings' && (
        <RemoteList orgId={orgId} path="regulated/findings" listKey="findings" searchable
          title={(f) => f.description} meta={(f) => `${f.severity} · ${f.source || 'internal'} · owner ${f.ownerEmail || '—'}`}
          badge={(f) => f.status} empty="No findings." />
      )}
      {tab === 'exceptions' && (
        <RemoteList orgId={orgId} path="regulated/exceptions" listKey="exceptions"
          title={(e) => e.justification} meta={(e) => `Requested by ${e.requestedByEmail || '—'}${e.expiresAt ? ` · expires ${e.expiresAt.slice(0, 10)}` : ''}`}
          badge={(e) => e.status} empty="No exceptions." />
      )}
      <Text style={[styles.noteText, { marginTop: spacing.lg }]}>Creating controls, evidence, audits and examinations is done in the web Business Workspace.</Text>
    </ScrollView>
  );
}

function HealthTab({ orgId }) {
  const [h, setH] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    orgFetch(`/api/orgs/regulated/dashboard?orgId=${encodeURIComponent(orgId)}`).then(setH).catch((err) => setError(err.message || 'Could not load compliance health.'));
  }, [orgId]);
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!h) return <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />;
  return (
    <View>
      <View style={[styles.card, { marginBottom: spacing.md }]}>
        <Text style={[styles.cardTitle, { flex: 1 }]}>Overall status</Text>
        <Badge value={h.overallStatus} />
      </View>
      <View style={styles.statRow}>
        <Stat label="Controls" value={h.totalControls} />
        <Stat label="Passing" value={h.controlsPassing} tone={colors.success} />
        <Stat label="Failing" value={h.controlsFailing} tone={h.controlsFailing ? colors.danger : undefined} />
        <Stat label="Open findings" value={h.openFindings} />
        <Stat label="Critical findings" value={h.criticalFindings} tone={h.criticalFindings ? colors.danger : undefined} />
        <Stat label="Overdue reviews" value={h.overdueReviews} />
        <Stat label="Evidence expiring" value={h.evidenceExpiringSoon} />
        <Stat label="Remediation" value={h.remediationProgress ? `${h.remediationProgress.percentComplete}%` : '—'} />
      </View>
    </View>
  );
}
