// src/screens/MyDashboardScreen.js
//
// Mirrors the web dApp's My Dashboard tab (page.js, currentPage === 'My
// Dashboard'): layout and copy match, but the live data itself (PAYG
// transaction history from event logs, corporate/card-customer plan
// status) is a follow-up pass, per the earlier scoping decision — this
// tab specifically was called out as UI/content first. Placeholders are
// labeled honestly rather than shown as if they were real numbers.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useWallet } from '../providers/WalletProvider';
import { colors, spacing, radius, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import StatTile from '../components/StatTile';

export default function MyDashboardScreen() {
  const { address, isConnected, connecting, connect } = useWallet();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Dashboard</Text>
      <Text style={styles.subtitle}>
        A live read of your on-chain billing activity, storage allocation, and total spend across Pay-As-You-Go
        and Corporate Reserve.
      </Text>

      {!isConnected ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Connect your wallet to load dashboard data.</Text>
          <GradientButton title="Connect Wallet" onPress={connect} loading={connecting} style={{ marginTop: spacing.lg }} />
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            <StatTile label="Total Space Allocated" value="—" style={styles.gridItem} />
            <StatTile label="Total PAYG Spent (USDT)" value="—" valueColor={colors.success} style={styles.gridItem} />
            <StatTile label="Total PAYG Spent (INAYA)" value="—" valueColor="#a78bfa" style={styles.gridItem} />
            <StatTile label="PAYG Transactions Logged" value="—" valueColor={colors.warning} style={styles.gridItem} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>🗄️ Storage Space Allocation</Text>
            <Text style={styles.panelNote}>Live PAYG + Corporate Reserve allocation reads are coming in a follow-up update.</Text>
            <Text style={styles.walletLine}>Connected wallet: {address?.slice(0, 6)}...{address?.slice(-4)}</Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>🧾 Pay-As-You-Go Transactions</Text>
            <Text style={styles.emptyState}>// Transaction history reads aren't wired up yet — coming in a follow-up update.</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + 8 },
  title: { fontSize: 22, fontFamily: fonts.sansExtraBold, color: colors.textPrimary },
  subtitle: { fontSize: 13, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl, lineHeight: 18 },
  emptyCard: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xxl, alignItems: 'center' },
  emptyText: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  gridItem: { minWidth: '46%', flex: 1 },
  panel: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  panelTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm },
  panelNote: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, lineHeight: 15 },
  walletLine: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.cyan, marginTop: spacing.md },
  emptyState: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: spacing.lg },
});
