// src/screens/business/GovernmentScreen.js
//
// Government OS on mobile (Business Workspace gap closure, Batch 4): cases
// and citizen records, read through the same vertical-locked
// /api/orgs/government/* routes the web GovernmentView.js uses — the server
// applies Government OS access and record classification, so a member
// without access gets its real message here too. Read-only on mobile.

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { Chip, RemoteList, styles } from './VerticalList';

export default function GovernmentScreen({ route, navigation }) {
  const { orgId, orgName } = route.params;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('cases');

  useEffect(() => { navigation.setOptions({ title: `${orgName} · Government OS` }); }, [navigation, orgName]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.tabRow}>
        <Chip label="Cases" active={tab === 'cases'} onPress={() => setTab('cases')} />
        <Chip label="Citizen records" active={tab === 'records'} onPress={() => setTab('records')} />
      </View>
      {tab === 'cases' && (
        <RemoteList orgId={orgId} path="government/cases" listKey="cases" searchable
          title={(c) => c.title} meta={(c) => `${String(c.category || '—').replace(/_/g, ' ')} · priority ${c.priority || '—'}`}
          badge={(c) => c.status} empty="No cases you can see." />
      )}
      {tab === 'records' && (
        <RemoteList orgId={orgId} path="government/citizen-records" listKey="records" searchable
          title={(r) => r.legalName} meta={(r) => `${r.department || '—'} · ${r.classification || 'unclassified'}`}
          badge={(r) => r.status} empty="No citizen records you can see." />
      )}
      <Text style={[styles.noteText, { marginTop: spacing.lg }]}>Opening, assigning and closing cases, and the policy knowledge base, are in the web Business Workspace.</Text>
    </ScrollView>
  );
}
