// src/screens/business/VerticalList.js
//
// Shared building blocks for the vertical-OS screens added for Business
// Workspace gap closure, Batch 4 (Regulated, Financial / Private Capital,
// Government) — same look as HealthScreen.js. Every list reads the same
// vertical-locked /api/orgs/* routes the web views use, so a wrong-vertical
// org or a member without the role gets the server's real 403 message.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const TONE = {
  good: colors.success, warn: '#f59e0b', bad: colors.danger, muted: colors.textMuted,
};

export function toneFor(value) {
  const v = String(value || '').toLowerCase();
  if (/(active|approved|passing|effective|closed_won|won|complete|completed|resolved|onboarded|invested|realized|closed$)/.test(v)) return TONE.good;
  if (/(critical|high|failing|ineffective|rejected|lost|expired|overdue|breach)/.test(v)) return TONE.bad;
  if (/(open|pending|review|draft|in_progress|medium|requested|screen|diligence|negotiation)/.test(v)) return TONE.warn;
  return TONE.muted;
}

export function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Badge({ value }) {
  if (!value) return null;
  const c = toneFor(value);
  return (
    <View style={[styles.badge, { borderColor: c }]}>
      <Text style={[styles.badgeText, { color: c }]}>{String(value).replace(/_/g, ' ')}</Text>
    </View>
  );
}

/**
 * Loads `path` (relative to /api/orgs, orgId added), reads `listKey` from the
 * response and renders one card per row via `title`, `meta` and `badge`.
 */
export function RemoteList({ orgId, path, listKey, title, meta, badge, empty, searchable }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const sep = path.includes('?') ? '&' : '?';
      const data = await orgFetch(`/api/orgs/${path}${sep}orgId=${encodeURIComponent(orgId)}`);
      setRows(data[listKey] || []);
    } catch (err) {
      setRows([]);
      setError(err.message || 'Could not load this list.');
    }
  }, [orgId, path, listKey]);

  useEffect(() => { setRows(null); load(); }, [load]);

  const q = search.trim().toLowerCase();
  const shown = (rows || []).filter((r) => !q || `${title(r)} ${meta ? meta(r) : ''}`.toLowerCase().includes(q));

  return (
    <View>
      {searchable && (
        <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Search…" placeholderTextColor={colors.textMuted} accessibilityLabel="Search" />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!rows ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.lg }} />
      ) : shown.length === 0 && !error ? (
        <Text style={styles.emptyText}>{q ? `Nothing matches "${search}".` : empty}</Text>
      ) : (
        shown.map((r, i) => (
          <View key={r.id || r._id || i} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{title(r)}</Text>
              {meta ? <Text style={styles.cardMeta}>{meta(r)}</Text> : null}
            </View>
            {badge ? <Badge value={badge(r)} /> : null}
          </View>
        ))
      )}
    </View>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export const money = (n, cur) => (n === null || n === undefined || n === '' ? '—' : `${cur ? `${cur} ` : ''}${Number(n).toLocaleString()}`);

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  card: { ...glassCard, padding: spacing.lg, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  noteText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: 'rgba(0,242,254,0.3)' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
  chipTextActive: { color: colors.cyan },
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.monoBold, fontSize: 8, letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    fontFamily: fonts.sans, fontSize: 13, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.xs,
  },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  stat: { ...glassCard, paddingVertical: spacing.md, paddingHorizontal: spacing.md, minWidth: '30%', flexGrow: 1 },
  statValue: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.textPrimary },
  statLabel: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, marginTop: 2 },
});
