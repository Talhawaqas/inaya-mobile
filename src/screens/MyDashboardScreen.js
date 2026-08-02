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
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useWallet } from '../providers/WalletProvider';
import { useCardCustomer } from '../providers/CardCustomerProvider';
import { colors, spacing, radius, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import StatTile from '../components/StatTile';

export default function MyDashboardScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { address, isConnected, connecting, connect } = useWallet();
  const { email: cardCustomerEmail, plan: cardCustomerPlan, polling: planPolling, timedOut: planTimedOut } = useCardCustomer();

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
      <Text style={styles.title}>My Dashboard</Text>
      <Text style={styles.subtitle}>
        A live read of your on-chain billing activity, storage allocation, and total spend across Pay-As-You-Go
        and Corporate Reserve.
      </Text>

      {/* Card customers (Stripe checkout, no wallet) previously had no branch
          here at all -- this screen only ever checked isConnected, so paying
          via card and landing back here showed "Connect your wallet" with no
          sign the payment did anything. Mirrors page.js's equivalent branches. */}
      {!isConnected && cardCustomerPlan ? (
        <View style={styles.planStatusCard}>
          <Text style={styles.planStatusLabel}>CORPORATE RESERVE PLAN</Text>
          <Text style={styles.planStatusTier}>{cardCustomerPlan.tier}</Text>
          <Text style={styles.planStatusLine}>
            <Text style={styles.planStatusActive}>ACTIVE</Text> · valid until {new Date(cardCustomerPlan.expiresAt).toLocaleDateString()}
          </Text>
          <Text style={styles.planStatusMeta}>Signed in as {cardCustomerEmail} · no wallet connected.</Text>
        </View>
      ) : !isConnected && cardCustomerEmail && planTimedOut ? (
        <View style={styles.planTimedOutCard}>
          <Text style={styles.planTimedOutText}>
            ⚠️ Payment received, but activation is taking longer than expected. This usually means the settlement step failed server-side — contact support with email: {cardCustomerEmail}
          </Text>
        </View>
      ) : !isConnected && cardCustomerEmail && planPolling ? (
        <View style={styles.planPendingCard}>
          <Text style={styles.planPendingText}>⏳ Activating your plan on-chain — this can take up to a minute.</Text>
        </View>
      ) : !isConnected ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Connect your wallet to load dashboard data, or pay with card from the Business tab.</Text>
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
  planStatusCard: { backgroundColor: 'rgba(52,211,153,0.06)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  planStatusLabel: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.success, letterSpacing: 1 },
  planStatusTier: { fontFamily: fonts.sansExtraBold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.xs },
  planStatusLine: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs },
  planStatusActive: { color: colors.success, fontFamily: fonts.monoBold },
  planStatusMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  planPendingCard: { backgroundColor: 'rgba(0,242,254,0.06)', borderWidth: 1, borderColor: colors.borderAccent, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  planPendingText: { fontFamily: fonts.mono, fontSize: 11, color: colors.cyan, lineHeight: 16 },
  planTimedOutCard: { backgroundColor: 'rgba(245,158,11,0.06)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  planTimedOutText: { fontFamily: fonts.mono, fontSize: 11, color: colors.warning, lineHeight: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  gridItem: { minWidth: '46%', flex: 1 },
  panel: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  panelTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm },
  panelNote: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, lineHeight: 15 },
  walletLine: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.cyan, marginTop: spacing.md },
  emptyState: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', paddingVertical: spacing.lg },
});
