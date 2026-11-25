// src/screens/business/FinancialScreen.js
//
// Financial Services OS and Private Capital OS on mobile (Business Workspace
// gap closure, Batch 4). One screen for both verticals, like the web
// FinancialView.js: shared tabs (funds, entities, counterparties, investment
// committee) plus private-capital tabs (deals, portfolio, fundraising,
// exits). Read-only on mobile; every list uses the same /api/orgs/financial/*
// and /api/orgs/private-capital/* routes as the web.

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { Chip, RemoteList, money, styles } from './VerticalList';

export default function FinancialScreen({ route, navigation }) {
  const { orgId, orgName, vertical } = route.params;
  const insets = useSafeAreaInsets();
  const isPrivateCapital = vertical === 'private_capital';
  const [tab, setTab] = useState(isPrivateCapital ? 'deals' : 'funds');

  useEffect(() => { navigation.setOptions({ title: `${orgName} · ${isPrivateCapital ? 'Private Capital OS' : 'Financial OS'}` }); }, [navigation, orgName, isPrivateCapital]);

  const tabs = [
    ...(isPrivateCapital ? [['deals', 'Deals'], ['portfolio', 'Portfolio'], ['fundraising', 'Fundraising'], ['exits', 'Exits']] : []),
    ['funds', 'Funds'], ['entities', 'Entities'], ['counterparties', 'Counterparties'], ['committee', 'Committee'],
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <View style={styles.tabRow}>
        {tabs.map(([k, l]) => <Chip key={k} label={l} active={tab === k} onPress={() => setTab(k)} />)}
      </View>
      {tab === 'funds' && (
        <RemoteList orgId={orgId} path="financial/funds" listKey="funds" searchable
          title={(f) => f.shortName || f.legalName} meta={(f) => [f.fundType, f.strategy, f.baseCurrency, f.domicile].filter(Boolean).join(' · ')}
          badge={(f) => f.status} empty="No funds yet." />
      )}
      {tab === 'entities' && (
        <RemoteList orgId={orgId} path="financial/entities" listKey="entities" searchable
          title={(e) => e.name} meta={(e) => e.type} badge={(e) => e.status} empty="No entities yet." />
      )}
      {tab === 'counterparties' && (
        <RemoteList orgId={orgId} path="financial/counterparties" listKey="counterparties" searchable
          title={(c) => c.name} meta={(c) => `${c.type || '—'} · risk ${c.riskRating || '—'}${c.renewalDate ? ` · renews ${String(c.renewalDate).slice(0, 10)}` : ''}`}
          badge={(c) => c.onboardingStatus} empty="No counterparties yet." />
      )}
      {tab === 'committee' && (
        <RemoteList orgId={orgId} path="financial/ic-cases" listKey="cases"
          title={(c) => c.opportunity} meta={(c) => `${c.proposedPosition || ''}${c.proposedAllocation ? ` · allocation ${c.proposedAllocation}` : ''}`}
          badge={(c) => c.status} empty="No investment committee cases." />
      )}
      {tab === 'deals' && (
        <RemoteList orgId={orgId} path="private-capital/deals" listKey="deals" searchable
          title={(d) => d.company} meta={(d) => [d.sector, d.round, d.checkSize ? `check ${money(d.checkSize)}` : null, d.nextAction ? `next: ${d.nextAction}` : null].filter(Boolean).join(' · ')}
          badge={(d) => d.stage} empty="No deals in the pipeline." />
      )}
      {tab === 'portfolio' && (
        <RemoteList orgId={orgId} path="private-capital/portfolio-companies" listKey="portfolioCompanies" searchable
          title={(p) => p.name} meta={(p) => [p.sector, p.geography].filter(Boolean).join(' · ')}
          badge={(p) => p.status} empty="No portfolio companies yet." />
      )}
      {tab === 'fundraising' && (
        <RemoteList orgId={orgId} path="private-capital/fundraising" listKey="prospects" searchable
          title={(p) => p.legalName} meta={(p) => `target ${money(p.targetCommitment)}${p.source ? ` · ${p.source}` : ''}`}
          badge={(p) => p.stage} empty="No fundraising prospects." />
      )}
      {tab === 'exits' && (
        <RemoteList orgId={orgId} path="private-capital/exits" listKey="exits"
          title={(e) => `${String(e.exitType || 'Exit').replace(/_/g, ' ')}`} meta={(e) => `${(e.bids || []).length} bid(s)${e.distributionAmount ? ` · distribution ${money(e.distributionAmount)}` : ''}`}
          badge={(e) => e.status} empty="No exits yet." />
      )}
      <Text style={[styles.noteText, { marginTop: spacing.lg }]}>Creating and approving records, valuations and committee decisions is done in the web Business Workspace.</Text>
    </ScrollView>
  );
}
