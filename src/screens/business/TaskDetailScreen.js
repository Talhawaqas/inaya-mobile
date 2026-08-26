// src/screens/business/TaskDetailScreen.js
//
// Task detail + status transitions + history, mirroring the relationship
// DocumentDetailScreen has to the web app's DocumentColumn: every action
// button here just calls POST /api/orgs/tasks/:id/transition — all real
// enforcement (department access, current state, atomicity) happens
// server-side in src/lib/task-workflow.js, these buttons are shown for UX
// clarity only.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STATUS_LABELS = { TODO: 'To do', IN_PROGRESS: 'In progress', BLOCKED: 'Blocked', DONE: 'Done', CANCELLED: 'Cancelled' };
const STATUS_COLORS = {
  TODO: colors.textMuted,
  IN_PROGRESS: colors.cyan,
  BLOCKED: colors.warning,
  DONE: colors.success,
  CANCELLED: colors.violet,
};
const PRIORITY_COLORS = { LOW: colors.textMuted, MEDIUM: colors.cyan, HIGH: colors.warning, URGENT: colors.danger };
// [action, label] — no requiresManage in task-workflow.js, so every
// active-member-with-department-access sees the same set.
const ACTIONS_BY_STATUS = {
  TODO: [['start', 'Start'], ['cancel', 'Cancel']],
  IN_PROGRESS: [['block', 'Block'], ['complete', 'Complete'], ['cancel', 'Cancel']],
  BLOCKED: [['resume', 'Resume'], ['cancel', 'Cancel']],
  DONE: [['reopen', 'Reopen']],
  CANCELLED: [],
};

function isOverdue(task) {
  return task.dueDate && new Date(task.dueDate).getTime() < Date.now() && !['DONE', 'CANCELLED'].includes(task.status);
}

export default function TaskDetailScreen({ route, navigation }) {
  const { orgId, taskId, title } = route.params;
  const insets = useSafeAreaInsets();

  const [task, setTask] = useState(null);
  const [error, setError] = useState('');
  const [activity, setActivity] = useState(null);
  const [acting, setActing] = useState('');

  const loadTask = useCallback(async () => {
    setError('');
    try {
      const data = await orgFetch(`/api/orgs/tasks/${taskId}?orgId=${orgId}`);
      setTask(data);
    } catch (err) {
      setError(err.message || 'Could not load this task.');
    }
  }, [orgId, taskId]);

  const loadActivity = useCallback(async () => {
    try {
      const data = await orgFetch(`/api/orgs/tasks/${taskId}/activity?orgId=${orgId}`);
      setActivity(data.activity || []);
    } catch {
      setActivity([]);
    }
  }, [orgId, taskId]);

  useEffect(() => { loadTask(); }, [loadTask]);
  useEffect(() => { loadActivity(); }, [loadActivity]);
  useEffect(() => { navigation.setOptions({ title }); }, [navigation, title]);

  async function handleAction(action) {
    setActing(action);
    setError('');
    try {
      await orgFetch(`/api/orgs/tasks/${taskId}/transition`, { method: 'POST', body: { orgId, action } });
      await loadTask();
      loadActivity();
    } catch (err) {
      setError(err.message || 'Could not update this task.');
    } finally {
      setActing('');
    }
  }

  if (!task) {
    return (
      <View style={[styles.root, styles.centered]}>
        {error ? <Text style={[styles.error, { padding: spacing.xl }]}>{error}</Text> : <ActivityIndicator color={colors.cyan} />}
      </View>
    );
  }

  const overdue = isOverdue(task);
  const availableActions = ACTIONS_BY_STATUS[task.status] || [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
      <View style={styles.metaRow}>
        <View style={[badgeStyles.badge, { borderColor: STATUS_COLORS[task.status] }]}>
          <Text style={[badgeStyles.text, { color: STATUS_COLORS[task.status] }]}>{STATUS_LABELS[task.status]}</Text>
        </View>
        <Text style={[styles.priorityText, { color: PRIORITY_COLORS[task.priority] }]}>{task.priority}</Text>
        {task.dueDate && (
          <Text style={[styles.dueText, overdue && { color: colors.danger }]}>
            {overdue ? 'Overdue — ' : 'Due '}{new Date(task.dueDate).toLocaleDateString()}
          </Text>
        )}
      </View>

      {task.description ? <Text style={styles.description}>{task.description}</Text> : null}

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.metaLine}>Assignee: {task.assigneeEmail || 'Unassigned'}</Text>
        <Text style={styles.metaLine}>Created by {task.createdByEmail}</Text>
      </View>

      {availableActions.length > 0 && (
        <View style={styles.actionRow}>
          {availableActions.map(([action, label]) => (
            <TouchableOpacity
              key={action}
              style={[styles.actionButton, !!acting && styles.buttonDisabled]}
              onPress={() => handleAction(action)}
              disabled={!!acting}
            >
              <Text style={styles.actionButtonText}>{acting === action ? '…' : label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.cardTitle}>History</Text>
        {!activity ? (
          <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.sm }} />
        ) : activity.length === 0 ? (
          <Text style={styles.emptyText}>No activity yet.</Text>
        ) : (
          activity.map((e) => (
            <View key={e.eventId} style={styles.activityRow}>
              <Text style={styles.activityAction}>{e.action.replaceAll('_', ' ').toLowerCase()}</Text>
              {e.previousState && (
                <Text style={styles.activityTransition}>{e.previousState} → {e.newState}</Text>
              )}
              <Text style={styles.activityMeta}>{e.actorEmail} · {new Date(e.timestamp).toLocaleString()}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  text: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 0.4, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl },
  title: { fontSize: 17, fontFamily: fonts.sansExtraBold, color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  priorityText: { fontFamily: fonts.monoBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  dueText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  description: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 19 },
  card: { ...glassCard, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.xs },
  metaLine: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  actionButton: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  actionButtonText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  buttonDisabled: { opacity: 0.4 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.md },
  emptyText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  activityRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  activityAction: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textPrimary, textTransform: 'capitalize' },
  activityTransition: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  activityMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },
});
