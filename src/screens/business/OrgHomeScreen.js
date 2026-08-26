// src/screens/business/OrgHomeScreen.js
//
// Landing screen after sign-in: the list of companies the signed-in email
// is an active member of (GET /api/orgs/session already returned this at
// auth time — no separate fetch needed). Tapping a company drills into its
// departments; each card also has a secondary "Ask the AI Assistant"
// action, since the assistant is scoped to one org at a time.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { useBusinessSession } from './BusinessSessionContext';
import { orgFetch } from '../../utils/orgApi';

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' };

// A signed-in user with zero org memberships can now genuinely happen —
// magic-link logins only ever come from an existing member or an invite,
// but Google sign-in (BusinessAuthScreen) can be a brand-new identity with
// no company yet. /api/orgs/create infers ownerEmail from the existing
// session when one is present, so this only needs a company name.
function CreateCompanyForm({ onCreated }) {
  const [orgName, setOrgName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!orgName.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await orgFetch('/api/orgs/create', { method: 'POST', body: { orgName: orgName.trim() } });
      onCreated();
    } catch (err) {
      setError(err.message || 'Could not create the company.');
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.card, { marginTop: spacing.lg }]}>
      <Text style={styles.emptyText}>You're not an active member of any company yet — create one to get started, or ask an owner/admin to invite you.</Text>
      <TextInput
        style={[styles.input, { marginTop: spacing.md }]}
        value={orgName}
        onChangeText={setOrgName}
        placeholder="Company name"
        placeholderTextColor={colors.textMuted}
        editable={!submitting}
      />
      <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Create company</Text>}
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export default function OrgHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { session, signOut, refreshSession } = useBusinessSession();
  const orgs = session?.orgs || [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>Business Workspace</Text>
      <Text style={styles.subtitle}>Signed in as {session?.email}</Text>

      {orgs.length === 0 ? (
        <CreateCompanyForm onCreated={refreshSession} />
      ) : (
        orgs.map((org) => (
          <View key={org.orgId} style={[styles.card, { marginTop: spacing.md }]}>
            <TouchableOpacity
              style={styles.orgCard}
              onPress={() => navigation.navigate('Departments', { orgId: org.orgId, orgName: org.orgName, role: org.role, departmentIds: org.departmentIds })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.orgName}>{org.orgName}</Text>
                <Text style={styles.orgRole}>{ROLE_LABEL[org.role] || org.role}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.aiButton}
              onPress={() => navigation.navigate('Tasks', { orgId: org.orgId, orgName: org.orgName })}
            >
              <Ionicons name="checkbox-outline" size={14} color={colors.cyan} />
              <Text style={styles.aiButtonText}>Tasks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.aiButton}
              onPress={() => navigation.navigate('CRM', { orgId: org.orgId, orgName: org.orgName })}
            >
              <Ionicons name="people-outline" size={14} color={colors.cyan} />
              <Text style={styles.aiButtonText}>CRM</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.aiButton}
              onPress={() => navigation.navigate('Procurement', { orgId: org.orgId, orgName: org.orgName })}
            >
              <Ionicons name="cart-outline" size={14} color={colors.cyan} />
              <Text style={styles.aiButtonText}>Procurement</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.aiButton}
              onPress={() => navigation.navigate('Inventory', { orgId: org.orgId, orgName: org.orgName })}
            >
              <Ionicons name="cube-outline" size={14} color={colors.cyan} />
              <Text style={styles.aiButtonText}>Inventory</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.aiButton}
              onPress={() => navigation.navigate('Finance', { orgId: org.orgId, orgName: org.orgName })}
            >
              <Ionicons name="cash-outline" size={14} color={colors.cyan} />
              <Text style={styles.aiButtonText}>Finance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.aiButton}
              onPress={() => navigation.navigate('HR', { orgId: org.orgId, orgName: org.orgName })}
            >
              <Ionicons name="id-card-outline" size={14} color={colors.cyan} />
              <Text style={styles.aiButtonText}>HR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.aiButton}
              onPress={() => navigation.navigate('BusinessAI', { orgId: org.orgId, orgName: org.orgName })}
            >
              <Ionicons name="sparkles-outline" size={14} color={colors.cyan} />
              <Text style={styles.aiButtonText}>Ask the AI Assistant</Text>
            </TouchableOpacity>
          </View>
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
  orgCard: { flexDirection: 'row', alignItems: 'center' },
  orgName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.textPrimary },
  orgRole: { fontFamily: fonts.mono, fontSize: 10, color: colors.cyan, textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.5 },
  aiButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  aiButtonText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.cyan },
  emptyText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  signOutButton: { marginTop: spacing.xxl, alignItems: 'center', paddingVertical: spacing.sm },
  signOutText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.danger },
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
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
});
