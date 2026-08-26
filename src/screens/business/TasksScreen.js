// src/screens/business/TasksScreen.js
//
// GET /api/orgs/tasks?orgId=... — with no department/project given, this
// returns the caller's full accessible scope (department-permission
// filtered server-side, same as every other list route here), so this
// screen is a true "my company's tasks" view, not scoped to one project.
// Filter chips (All/Mine/Overdue) just add query params; status badge
// colors mirror the web app's STATUS_STYLES
// (inaya-network-dapp/src/components/business/TasksView.js) so both
// clients read as the same product.
//
// Creating a task needs a two-step department -> project pick, same
// pattern as DepartmentsScreen -> ProjectsScreen's own drill-down, just
// collapsed into one inline form here instead of two screens.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';
import { useBusinessSession } from './BusinessSessionContext';

const STATUS_LABELS = { TODO: 'To do', IN_PROGRESS: 'In progress', BLOCKED: 'Blocked', DONE: 'Done', CANCELLED: 'Cancelled' };
const STATUS_COLORS = {
  TODO: colors.textMuted,
  IN_PROGRESS: colors.cyan,
  BLOCKED: colors.warning,
  DONE: colors.success,
  CANCELLED: colors.violet,
};
const PRIORITY_COLORS = { LOW: colors.textMuted, MEDIUM: colors.cyan, HIGH: colors.warning, URGENT: colors.danger };

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.TODO;
  return (
    <View style={[badgeStyles.badge, { borderColor: color }]}>
      <Text style={[badgeStyles.text, { color }]}>{STATUS_LABELS[status] || status}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  text: { fontFamily: fonts.monoBold, fontSize: 8, letterSpacing: 0.4, textTransform: 'uppercase' },
});

function isOverdue(task) {
  return task.dueDate && new Date(task.dueDate).getTime() < Date.now() && !['DONE', 'CANCELLED'].includes(task.status);
}

function CreateTaskForm({ orgId, onCreated, onCancel }) {
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    orgFetch(`/api/orgs/departments?orgId=${orgId}`).then((d) => setDepartments(d.departments || [])).catch(() => {});
  }, [orgId]);

  useEffect(() => {
    if (!departmentId) { setProjects([]); setProjectId(null); return; }
    orgFetch(`/api/orgs/projects?orgId=${orgId}&departmentId=${departmentId}`).then((d) => setProjects(d.projects || [])).catch(() => setProjects([]));
    setProjectId(null);
  }, [orgId, departmentId]);

  async function handleSubmit() {
    if (!projectId || !title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/tasks', { method: 'POST', body: { orgId, projectId, title: title.trim() } });
      onCreated();
    } catch (err) {
      setError(err.message || 'Could not create the task.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginTop: spacing.md }]}>
      <Text style={styles.cardTitle}>New task</Text>
      <View style={styles.chipRow}>
        {departments.map((d) => (
          <TouchableOpacity key={d.id} style={[styles.chip, departmentId === d.id && styles.chipActive]} onPress={() => setDepartmentId(d.id)}>
            <Text style={[styles.chipText, departmentId === d.id && styles.chipTextActive]}>{d.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {departmentId && (
        <View style={styles.chipRow}>
          {projects.map((p) => (
            <TouchableOpacity key={p.id} style={[styles.chip, projectId === p.id && styles.chipActive]} onPress={() => setProjectId(p.id)}>
              <Text style={[styles.chipText, projectId === p.id && styles.chipTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
          {projects.length === 0 && <Text style={styles.emptyText}>No projects in this department yet.</Text>}
        </View>
      )}
      <TextInput
        style={[styles.input, { marginTop: spacing.md }]}
        value={title}
        onChangeText={setTitle}
        placeholder="Task title"
        placeholderTextColor={colors.textMuted}
        editable={!submitting}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={submitting}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { flex: 1 }, (submitting || !projectId || !title.trim()) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !projectId || !title.trim()}
        >
          {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Create</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TasksScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const { session } = useBusinessSession();
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'mine' | 'overdue'
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ orgId });
      if (filter === 'mine') params.set('assigneeEmail', session?.email || '');
      if (filter === 'overdue') params.set('overdue', 'true');
      const data = await orgFetch(`/api/orgs/tasks?${params.toString()}`);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.message || 'Could not load tasks.');
    }
  }, [orgId, filter, session?.email]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: `${orgName} · Tasks` }); }, [navigation, orgName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add-circle-outline'} size={22} color={colors.cyan} />
        </TouchableOpacity>
      </View>

      {creating && <CreateTaskForm orgId={orgId} onCreated={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />}

      <View style={styles.chipRow}>
        {[['all', 'All'], ['mine', 'Mine'], ['overdue', 'Overdue']].map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.chip, filter === key && styles.chipActive]} onPress={() => setFilter(key)}>
            <Text style={[styles.chipText, filter === key && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!tasks ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : tasks.length === 0 ? (
        <Text style={styles.emptyText}>No tasks match this filter.</Text>
      ) : (
        tasks.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.card}
            onPress={() => navigation.navigate('TaskDetail', { orgId, taskId: t.id, title: t.title })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[t.priority] }]} />
              <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {t.departmentName || 'Unknown'} · {t.assigneeEmail || 'Unassigned'}
                {t.dueDate ? ` · ${isOverdue(t) ? 'Overdue' : 'Due'} ${new Date(t.dueDate).toLocaleDateString()}` : ''}
              </Text>
              <StatusBadge status={t.status} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: 16, fontFamily: fonts.sansExtraBold, color: colors.textPrimary },
  card: { ...glassCard, padding: spacing.lg, marginTop: spacing.sm },
  cardTitle: { flex: 1, fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.sm },
  cardMeta: { flex: 1, fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted, textTransform: 'uppercase' },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.lg },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginTop: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderColor: 'rgba(0,242,254,0.3)' },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
  chipTextActive: { color: colors.cyan },
  input: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  button: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  cancelButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  cancelButtonText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textMuted },
});
