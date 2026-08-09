// src/screens/business/ProjectsScreen.js
//
// GET /api/orgs/projects?orgId=...&departmentId=... — unlike departments,
// this 403s server-side if the caller can't access the department, so a
// department tapped from DepartmentsScreen that the member isn't assigned
// to surfaces a clear error here rather than an empty list.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

export default function ProjectsScreen({ route, navigation }) {
  const { orgId, orgName, departmentId, departmentName } = route.params;
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await orgFetch(`/api/orgs/projects?orgId=${orgId}&departmentId=${departmentId}`);
      setProjects(data.projects || []);
    } catch (err) {
      setError(err.message || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [orgId, departmentId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: departmentName }); }, [navigation, departmentName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>Projects</Text>

      {loading ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : projects.length === 0 ? (
        <Text style={styles.emptyText}>No projects yet.</Text>
      ) : (
        projects.map((proj) => (
          <TouchableOpacity
            key={proj.id}
            style={styles.card}
            onPress={() => navigation.navigate('Documents', { orgId, orgName, departmentId, projectId: proj.id, projectName: proj.name })}
          >
            <Ionicons name="folder-outline" size={18} color={colors.cyan} />
            <Text style={styles.cardTitle}>{proj.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: 16, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, marginBottom: spacing.md },
  card: { ...glassCard, padding: spacing.lg, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.lg },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginTop: spacing.lg },
});
