// src/screens/business/DocumentsScreen.js
//
// GET /api/orgs/documents?orgId=...&departmentId=...&projectId=... — the
// list route (metadata only, never cidAlpha/cidBeta — see that route's own
// comment). Status colors mirror the web app's STATUS_STYLES
// (inaya-network-dapp/src/app/business/page.js) so the two clients read as
// the same product.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';

const STATUS_COLORS = {
  DRAFT: colors.textMuted,
  PENDING: colors.warning,
  UNDER_REVIEW: colors.cyan,
  APPROVED: colors.success,
  REJECTED: colors.danger,
  ARCHIVED: colors.violet,
};

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
  return (
    <View style={[badgeStyles.badge, { borderColor: color }]}>
      <Text style={[badgeStyles.text, { color }]}>{status.replace('_', ' ')}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  text: { fontFamily: fonts.monoBold, fontSize: 8, letterSpacing: 0.4, textTransform: 'uppercase' },
});

export default function DocumentsScreen({ route, navigation }) {
  const { orgId, orgName, departmentId, projectId, projectName } = route.params;
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await orgFetch(`/api/orgs/documents?orgId=${orgId}&departmentId=${departmentId}&projectId=${projectId}`);
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message || 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  }, [orgId, departmentId, projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { navigation.setOptions({ title: projectName }); }, [navigation, projectName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>Documents</Text>

      {loading ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : documents.length === 0 ? (
        <Text style={styles.emptyText}>No documents visible to you in this project.</Text>
      ) : (
        documents.map((doc) => (
          <TouchableOpacity
            key={doc.id}
            style={styles.card}
            onPress={() => navigation.navigate('DocumentDetail', { orgId, orgName, documentId: doc.id, filename: doc.filename })}
          >
            <Ionicons name="document-lock-outline" size={20} color={colors.cyan} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{doc.filename}</Text>
              <Text style={styles.cardMeta}>
                {doc.accessLevel} · your access: {doc.yourAccessLevel}
              </Text>
            </View>
            <StatusBadge status={doc.status} />
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
  card: { ...glassCard, padding: spacing.lg, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted, marginTop: 2, textTransform: 'uppercase' },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.lg },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginTop: spacing.lg },
});
