// src/screens/business/InsightsScreen.js
//
// Business Insights & KPI Dashboard (mobile) — KPI cards, period-over-
// period comparison, and business alerts, backed by GET /api/orgs/insights
// (same permission-scoped business-insights.js the web InsightsView uses).
// No charts on mobile for this pass — the numbers and alerts are the
// actionable part; trend charts stay web-only, same "core workflows on
// mobile, richer visuals on web" split FinanceScreen already documents.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const CURRENCY_KEYS = new Set(['revenue', 'expenses', 'pipelineValue']);
const SEVERITY_COLOR = { high: colors.danger, medium: colors.warning, low: colors.cyan };

function formatKpi(key, value) {
  if (CURRENCY_KEYS.has(key)) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (key === 'winRate' || key === 'taskCompletionRate') return `${value}%`;
  return value.toLocaleString();
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function InsightsScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [periodDays, setPeriodDays] = useState('30');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await orgFetch(`/api/orgs/insights?orgId=${orgId}&periodDays=${periodDays}`));
    } catch (err) {
      setError(err.message || 'Could not load insights.');
    }
  }, [orgId, periodDays]);

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Insights` }); }, [navigation, orgName]);
  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.chipRow}>
        {[['7', '7 days'], ['30', '30 days'], ['90', '90 days']].map(([value, label]) => (
          <Chip key={value} label={label} active={periodDays === value} onPress={() => setPeriodDays(value)} />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!data ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : (
        <>
          {data.alerts.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.sectionTitle}>Business Alerts</Text>
              {data.alerts.map((a, i) => (
                <View key={i} style={[styles.alertCard, { borderColor: SEVERITY_COLOR[a.severity] || colors.cyan }]}>
                  <Text style={[styles.alertText, { color: SEVERITY_COLOR[a.severity] || colors.textPrimary }]}>{a.message}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Key Metrics</Text>
          <View style={styles.kpiGrid}>
            {Object.entries(data.kpis).map(([key, kpi]) => (
              <View key={key} style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
                <Text style={styles.kpiValue}>{formatKpi(key, kpi.value)}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>vs. Prior Period</Text>
          {Object.entries(data.comparison).map(([key, c]) => {
            const up = c.changePct >= 0;
            return (
              <View key={key} style={styles.compareRow}>
                <Text style={styles.compareLabel}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</Text>
                <Text style={[styles.compareValue, { color: up ? colors.success : colors.danger }]}>{up ? '▲' : '▼'} {Math.abs(c.changePct)}%</Text>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  chipRow: { flexDirection: 'row', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: 'rgba(0,242,254,0.3)' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
  chipTextActive: { color: colors.cyan },
  sectionTitle: { fontFamily: fonts.sansExtraBold, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.sm },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: { ...glassCard, padding: spacing.md, width: '47%' },
  kpiLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  kpiValue: { fontFamily: fonts.sansExtraBold, fontSize: 18, color: colors.textPrimary, marginTop: 4 },
  compareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  compareLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary },
  compareValue: { fontFamily: fonts.monoBold, fontSize: 12 },
  alertCard: { ...glassCard, borderWidth: 1, padding: spacing.md, marginTop: spacing.xs },
  alertText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
});
