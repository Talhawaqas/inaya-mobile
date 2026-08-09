// src/screens/business/DepartmentsScreen.js
//
// GET /api/orgs/departments?orgId=... — department names are visible
// org-wide (see that route's own comment), but tapping into one whose
// projects you can't access will surface a clear 403 on the next screen
// rather than being hidden here, matching the web app's own behavior.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

export default function DepartmentsScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await orgFetch(`/api/orgs/departments?orgId=${orgId}`);
      setDepartments(data.departments || []);
    } catch (err) {
      setError(err.message || 'Could not load departments.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: orgName }); }, [navigation, orgName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>Departments</Text>

      {loading ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : departments.length === 0 ? (
        <Text style={styles.emptyText}>No departments yet.</Text>
      ) : (
        departments.map((dept) => (
          <TouchableOpacity
            key={dept.id}
            style={styles.card}
            onPress={() => navigation.navigate('Projects', { orgId, orgName, departmentId: dept.id, departmentName: dept.name })}
          >
            <Ionicons name="business-outline" size={18} color={colors.cyan} />
            <Text style={styles.cardTitle}>{dept.name}</Text>
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
