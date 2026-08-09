// src/screens/business/OrgHomeScreen.js
//
// Landing screen after sign-in: the list of companies the signed-in email
// is an active member of (GET /api/orgs/session already returned this at
// auth time — no separate fetch needed). Tapping one drills into its
// departments.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { useBusinessSession } from './BusinessSessionContext';

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' };

export default function OrgHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useBusinessSession();
  const orgs = session?.orgs || [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>Business Workspace</Text>
      <Text style={styles.subtitle}>Signed in as {session?.email}</Text>

      {orgs.length === 0 ? (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={styles.emptyText}>You're not an active member of any company yet — ask an owner or admin to invite you.</Text>
        </View>
      ) : (
        orgs.map((org) => (
          <TouchableOpacity
            key={org.orgId}
            style={[styles.card, styles.orgCard]}
            onPress={() => navigation.navigate('Departments', { orgId: org.orgId, orgName: org.orgName, role: org.role, departmentIds: org.departmentIds })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.orgName}>{org.orgName}</Text>
              <Text style={styles.orgRole}>{ROLE_LABEL[org.role] || org.role}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: 20, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, letterSpacing: 0.5 },
  subtitle: { fontSize: 12, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs },
  card: { ...glassCard, padding: spacing.lg },
  orgCard: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center' },
  orgName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary },
  orgRole: { fontFamily: fonts.mono, fontSize: 10, color: colors.cyan, textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.5 },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  signOutButton: { marginTop: spacing.xxl, alignItems: 'center', paddingVertical: spacing.sm },
  signOutText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.danger },
});
