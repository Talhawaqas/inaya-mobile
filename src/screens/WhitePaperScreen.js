// src/screens/WhitePaperScreen.js
//
// Static content port of the web dApp's White Paper tab (page.js,
// currentPage === 'White Paper') — same section text, roadmap, and
// tokenomics breakdown. No wallet dependency, nothing on-chain.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts } from '../theme';

const SECTIONS = ['Abstract', 'The Problem', 'Architecture', 'Vision', 'Tokenomics Matrix'];

const ROADMAP_STATUS = {
  completed: { label: 'Completed', emoji: '✅', color: colors.success },
  in_progress: { label: 'In Progress', emoji: '🚧', color: colors.warning },
  planned: { label: 'Planned', emoji: '⏳', color: '#38bdf8' },
  future: { label: 'Future', emoji: '🔮', color: '#a78bfa' },
};

const ROADMAP_PHASES = [
  {
    phase: 'Phase 1 — Foundation',
    status: 'completed',
    items: [
      'Core DePIN architecture designed', 'Client-side AES-256 encryption', 'Binary Sharding engine',
      'Smart contract deployment', 'AI Documentation Assistant', 'Official website launch',
      'BNB Chain DappBay listing', 'Testnet live', 'Genesis tokenomics finalized',
    ],
  },
  {
    phase: 'Phase 2 — Ecosystem Growth',
    status: 'in_progress',
    items: [
      'Strategic partnerships', 'Open-source components', 'Regional communities',
      'Community governance preparation', 'SDK — Delete files', 'SDK — Rename files',
      'SDK — Move files', 'SDK — Folder management', 'SDK — Share files',
      'SDK — Better error handling', 'SDK — Retry mechanisms', 'SDK — Upload progress callbacks',
      'SDK — Event listeners', 'SDK — Better TypeScript typings', 'Docs — More examples',
      'Docs — React examples', 'Docs — Next.js examples', 'Docs — Node.js examples',
    ],
  },
  {
    phase: 'Phase 3 — Mainnet Readiness',
    status: 'planned',
    items: [
      'Security audit', 'Protocol stress testing', 'Node software release', 'Staking launch',
      'Explorer launch', 'Governance framework', 'Enterprise dashboard', 'Production infrastructure',
      'Storage analytics', 'File statistics', 'Team workspaces', 'Organization management',
      'Multi-user permissions', 'Shared storage',
    ],
  },
  {
    phase: 'Phase 4 — Mainnet Launch',
    status: 'future',
    items: [
      'Mainnet deployment', 'Node reward activation', 'Enterprise storage onboarding',
      'Decentralized governance rollout', 'Ecosystem grants', 'Community incentive programs',
    ],
  },
  {
    phase: 'Phase 5 — Beyond Mainnet',
    status: 'future',
    items: [
      'AI-powered storage intelligence', 'Decentralized Identity (DID)', 'Cross-chain interoperability',
      'Enterprise APIs', 'Mobile applications', 'Global node expansion',
      'Developer ecosystem grants', 'DAO governance evolution',
    ],
  },
];

const TOKENOMICS = [
  { label: 'Swarm Reserve (Strategic/Nodes)', pct: 40.0, tokens: '12M', color: colors.blue, emoji: '🛸' },
  { label: 'Staking Rewards Pool', pct: 26.7, tokens: '8M', color: '#a78bfa', emoji: '🥩' },
  { label: 'Liquidity Pool Allocation', pct: 21.7, tokens: '6.5M', color: colors.cyan, emoji: '💧' },
  { label: 'Team Runway Core', pct: 5.0, tokens: '1.5M', color: '#818cf8', emoji: '👥' },
  { label: 'Ecosystem Fund', pct: 3.3, tokens: '1M', color: colors.warning, emoji: '🌱' },
  { label: 'Genesis Airdrop Portals', pct: 3.3, tokens: '1M', color: colors.success, emoji: '🎁' },
];

export default function WhitePaperScreen() {
  const tabBarHeight = useSafeAreaInsets().bottom;
  const [section, setSection] = useState('Abstract');

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
      <Text style={styles.title}>THE INAYA PROTOCOL</Text>
      <Text style={styles.subtitle}>A Decentralized Sovereign Custody Network for High-Value Assets</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={{ gap: spacing.sm }}>
        {SECTIONS.map((sec) => (
          <TouchableOpacity
            key={sec}
            onPress={() => setSection(sec)}
            style={[styles.tabButton, section === sec && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, section === sec && styles.tabButtonTextActive]}>{sec}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.panel}>
        {section === 'Abstract' && (
          <>
            <Text style={styles.heading}>// 1.0 ABSTRACT SUMMARY</Text>
            <Text style={styles.body}>
              Inaya Custody Network represents a paradigm shift in decentralized object storage management.
              Traditional layouts suffer from localized single-point failures and third-party infrastructure exposures.
            </Text>
          </>
        )}

        {section === 'The Problem' && (
          <>
            <Text style={styles.heading}>// 2.0 CENTRALIZED CUSTODY LIABILITY</Text>
            <Text style={styles.body}>
              Modern cloud architectures rely on corporate server frameworks that compromise raw sovereignty.
              Governments and massive data monopolizers maintain deep vector tracking capabilities that can
              intercept client data objects mid-transit.
            </Text>
          </>
        )}

        {section === 'Architecture' && (
          <>
            <Text style={styles.heading}>// 3.0 SYSTEM FRAGMENTATION TECHNOLOGY</Text>
            <Text style={styles.body}>
              When a node initiates a data store action within the Inaya core framework, shards are pushed via
              separate network pipes into isolated decentralized storage vaults, and their tracking metadata
              hashes are cryptographically anchored to public EVM contract ledgers.
            </Text>
          </>
        )}

        {section === 'Vision' && (
          <View style={{ gap: spacing.lg }}>
            <Text style={styles.heading}>// 3.5 STRATEGIC VISION</Text>
            <View style={styles.visionBox}>
              <Text style={styles.visionLabel}>MISSION</Text>
              <Text style={styles.visionText}>
                To build the world's most trusted decentralized digital infrastructure where individuals,
                businesses, and AI systems own, protect, and control their data without relying on centralized
                cloud providers.
              </Text>
              <Text style={[styles.visionLabel, { marginTop: spacing.md }]}>VISION STATEMENT</Text>
              <Text style={styles.visionText}>
                Inaya Network aims to become the decentralized trust layer for the internet — where files,
                identities, AI, and digital assets remain private, verifiable, and permanently under user control.
              </Text>
            </View>

            <Text style={styles.roadmapHeading}>Tactical Project Development Roadmap</Text>
            {ROADMAP_PHASES.map((p) => {
              const s = ROADMAP_STATUS[p.status];
              return (
                <View key={p.phase} style={[styles.roadmapCard, { borderLeftColor: s.color }]}>
                  <View style={styles.roadmapHeader}>
                    <Text style={styles.roadmapPhase}>{p.phase}</Text>
                    <View style={[styles.roadmapBadge, { borderColor: s.color }]}>
                      <Text style={[styles.roadmapBadgeText, { color: s.color }]}>{s.emoji} {s.label}</Text>
                    </View>
                  </View>
                  {p.items.map((item) => (
                    <Text key={item} style={styles.roadmapItem}>· {item}</Text>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {section === 'Tokenomics Matrix' && (
          <View style={{ gap: spacing.lg }}>
            <Text style={styles.heading}>// 4.0 ALLOCATION DISPOSAL DATA</Text>
            <Text style={styles.bodyMuted}>
              Verified against the Strategic Business Model & Financial Architecture (INAYA-EXEC-2026-V1).
            </Text>
            <View style={styles.tokenomicsBar}>
              {TOKENOMICS.map((t) => (
                <View key={t.label} style={{ flex: t.pct, backgroundColor: t.color }} />
              ))}
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.tokenomicsTotal}>Total Hard Cap: 30,000,000 $INAYA</Text>
              {TOKENOMICS.map((t) => (
                <View key={t.label} style={styles.tokenomicsRow}>
                  <Text style={styles.tokenomicsLabel}>{t.emoji} {t.label}</Text>
                  <Text style={[styles.tokenomicsValue, { color: t.color }]}>{t.pct}% ({t.tokens})</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + 8 },
  title: { fontSize: 22, fontFamily: fonts.sansExtraBold, color: colors.textPrimary },
  subtitle: { fontSize: 11, fontFamily: fonts.sansBold, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: 0.6 },
  tabRow: { marginBottom: spacing.lg, flexGrow: 0 },
  tabButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.03)' },
  tabButtonActive: { backgroundColor: 'rgba(0,242,254,0.1)', borderWidth: 1, borderColor: colors.cyan },
  tabButtonText: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.textMuted },
  tabButtonTextActive: { color: colors.cyan },
  panel: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  heading: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, lineHeight: 19 },
  bodyMuted: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, fontStyle: 'italic' },
  visionBox: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg },
  visionLabel: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.cyan, letterSpacing: 1, textTransform: 'uppercase' },
  visionText: { fontFamily: fonts.sans, fontSize: 12, color: '#cbd5e1', fontStyle: 'italic', marginTop: spacing.xs, lineHeight: 18 },
  roadmapHeading: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  roadmapCard: { backgroundColor: 'rgba(0,0,0,0.2)', borderLeftWidth: 2, borderRadius: radius.sm, padding: spacing.md },
  roadmapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, flexWrap: 'wrap', gap: spacing.xs },
  roadmapPhase: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary },
  roadmapBadge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  roadmapBadgeText: { fontFamily: fonts.monoBold, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  roadmapItem: { fontFamily: fonts.sans, fontSize: 11, color: '#cbd5e1', marginTop: 2 },
  tokenomicsBar: { flexDirection: 'row', height: 28, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  tokenomicsTotal: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.05)', padding: spacing.sm, borderRadius: radius.sm },
  tokenomicsRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs },
  tokenomicsLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.textSecondary, flexShrink: 1 },
  tokenomicsValue: { fontFamily: fonts.monoBold, fontSize: 11 },
});
