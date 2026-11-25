// src/screens/BusinessModelScreen.js
//
// Mirrors the web dApp's Business Model tab (page.js, currentPage ===
// 'Business Model'): PAYG pricing summary, market comparison, Corporate
// Reserve plans, professional fundamentals. Card checkout is wired for
// real via an in-app WebView (create-checkout-session -> Stripe Checkout).
// The wallet-based PAYG payments (storage/egress/maintenance) and the
// Corporate Reserve crypto checkout are intentionally left as a follow-up
// pass — this is the UI/content layer first, per the earlier scoping
// decision on this tab specifically.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../providers/WalletProvider';
import { useCardCustomer } from '../providers/CardCustomerProvider';
import { colors, spacing, radius, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import CheckoutWebView from '../components/CheckoutWebView';
import { PLAY_EDITION } from '../utils/edition';

const SUMMARY_CARDS = [
  { value: '6.49 USDT', label: 'Baseline Storage / TB / Month', color: colors.cyan },
  { value: 'Included', label: 'Retrieval up to stored volume / month', color: colors.success },
  { value: '12 USDT', label: 'Flat Annual Maintenance', color: colors.warning },
  { value: '26.7%', label: 'Staking Rewards Pool APY Source', color: '#a78bfa' },
];

const MARKET_COMPARISON = [
  // Competitor list prices in USD as of November 2026 (same table as the web app's src/lib/dappPricing.js).
  { provider: 'Amazon S3 (Standard)', storage: '~23.00 USDT', egress: '~90 USDT', duration: 'None' },
  { provider: 'Google Cloud Storage', storage: '~20.00 USDT', egress: '~120 USDT', duration: 'None' },
  { provider: 'Cloudflare R2', storage: '15.00 USDT', egress: 'Free', duration: 'None' },
  { provider: 'Wasabi', storage: '~7.99 USDT', egress: 'Free within limits', duration: '1 TB, 90 days' },
  { provider: 'Storj', storage: '7.00 USDT', egress: '7 USDT', duration: '5 USDT / month' },
  { provider: 'Backblaze B2', storage: '6.95 USDT', egress: 'Free to 3x stored, then 10 USDT', duration: 'None' },
  { provider: 'Inaya Network (DePIN)', storage: '6.49 USDT', egress: 'Included to 1x stored, then 10 INAYA / 0.5 TB', duration: 'None', highlight: true },
];

const CORPORATE_TIERS = [
  // aws / b2: a year of storage only at list price (S3 Standard tiers 23/22/21 USD per TB; B2 6.95).
  { tier: '250 TB / Year', aws: '66,600 USDT/yr', b2: '20,850 USDT/yr', inaya: '17,970 USDT/Year', maintenance: '500 USDT-eq/yr' },
  { tier: '500 TB / Year', aws: '132,600 USDT/yr', b2: '41,700 USDT/yr', inaya: '34,740 USDT/Year', maintenance: '1,000 USDT-eq/yr' },
  { tier: '1000 TB / Year', aws: '258,600 USDT/yr', b2: '83,400 USDT/yr', inaya: '65,880 USDT/Year', maintenance: '2,000 USDT-eq/yr' },
];

const FUNDAMENTALS = [
  { title: 'Always-Hot Performance Storage', body: 'Data shards stay permanently ready for concurrent retrieval — no cold-archive latency gaps.' },
  { title: 'Zero Minimum File Size Penalties', body: 'Tiny configs or massive video assets settle under the same uniform rate framework.' },
  { title: 'Zero Storage Duration Constraints', body: 'Delete or cycle files freely — no contractual early-termination penalties.' },
  { title: 'Free Core API Calls', body: 'Configure, query, and monitor storage routes without unexpected micro-charges.' },
];

export default function BusinessModelScreen() {
  const tabBarHeight = useSafeAreaInsets().bottom;
  const { address } = useWallet();
  const { email: cardCustomerEmail, plan: cardCustomerPlan, polling: planPolling, timedOut: planTimedOut, resolveFromCheckout } = useCardCustomer();
  const [selectedTier, setSelectedTier] = useState('250 TB / Year');
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');

  async function handleCardCheckout() {
    setIsStartingCheckout(true);
    setCheckoutMessage('');
    try {
      const res = await fetch('https://www.inayanetwork.com/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selectedTier }),
      });
      const data = await res.json();
      if (!data.url) throw new Error(data.error || 'Checkout failed to start.');
      setCheckoutUrl(data.url);
    } catch (err) {
      setCheckoutMessage(`❌ ${err.message}`);
    } finally {
      setIsStartingCheckout(false);
    }
  }

  async function handleCheckoutResult({ status, tier, sessionId }) {
    setCheckoutUrl(null);
    if (status === 'success') {
      setCheckoutMessage(`✅ Payment received for ${tier || selectedTier} — activating on-chain, this can take up to a minute.`);
      // Resolves the Stripe session to the customer's email and starts the
      // corporate-plan-status poll below -- this is the step that was
      // missing entirely before: checkout success was detected, but nothing
      // ever confirmed activation or showed it anywhere in the app.
      await resolveFromCheckout(sessionId);
    } else if (status === 'cancelled') {
      setCheckoutMessage('Checkout cancelled.');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
      <Text style={styles.title}>Strategic Business Model & Financial Architecture</Text>
      <Text style={styles.subtitle}>
        Retail and developer accounts run on transparent Pay-As-You-Go pricing settled in stablecoins, while
        institutional clients can lock in a fixed-cost Corporate Reserve annual plan.
      </Text>

      <View style={styles.grid}>
        {SUMMARY_CARDS.map((c) => (
          <View key={c.label} style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: c.color }]}>{c.value}</Text>
            <Text style={styles.summaryLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* PAYG live billing — content/layout now, real on-chain wiring is a follow-up pass */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>💵 Pay-As-You-Go Live Billing</Text>
        <Text style={styles.panelNote}>
          Wallet-based PAYG payments (storage, egress, maintenance) are coming in a follow-up update — shown here for reference.
        </Text>
        <View style={styles.payggrid}>
          <View style={styles.paygCard}>
            <Text style={styles.paygLabel}>Storage Subscription (30 Days)</Text>
            <Text style={styles.paygPrice}>6.49 USDT / TB</Text>
            <TouchableOpacity style={styles.disabledButton} disabled>
              <Text style={styles.disabledButtonText}>💵 PAY STORAGE (PAYG)</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.paygCard}>
            <Text style={styles.paygLabel}>Retrieval Beyond Monthly Allowance</Text>
            <Text style={styles.paygPrice}>10 INAYA / 0.5 TB</Text>
            <TouchableOpacity style={styles.disabledButton} disabled>
              <Text style={styles.disabledButtonText}>💵 PAY EGRESS (PAYG)</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.paygCard}>
            <Text style={styles.paygLabel}>Annual Maintenance</Text>
            <Text style={styles.paygPrice}>12 USDT / Year</Text>
            <TouchableOpacity style={styles.disabledButton} disabled>
              <Text style={styles.disabledButtonText}>💵 PAY MAINTENANCE (PAYG)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* MARKET PRICING COMPARISON */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>📉 Market Pricing Comparison</Text>
        {MARKET_COMPARISON.map((row) => (
          <View key={row.provider} style={[styles.comparisonRow, row.highlight && styles.comparisonRowHighlight]}>
            <Text style={[styles.comparisonProvider, row.highlight && styles.comparisonHighlightText]}>{row.provider}</Text>
            <View style={styles.comparisonStats}>
              <Text style={[styles.comparisonStat, row.highlight && styles.comparisonHighlightText]}>Storage: {row.storage}</Text>
              <Text style={[styles.comparisonStat, row.highlight && styles.comparisonHighlightText]}>Egress: {row.egress}</Text>
              <Text style={[styles.comparisonStat, row.highlight && styles.comparisonHighlightText]}>Min: {row.duration}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.panelNote}>Competitor figures are list prices in USD as of November 2026; figures marked ~ are widely reported list prices. Retrieval up to your stored volume is included each month; the INAYA fee beyond that applies from mainnet.</Text>
      </View>

      {/* CARD CUSTOMER PLAN STATUS -- the piece that was missing entirely: checkout
          success used to just show a one-time toast and never actually confirmed
          or displayed activation anywhere. */}
      {cardCustomerPlan ? (
        <View style={styles.planStatusCard}>
          <Text style={styles.planStatusLabel}>YOUR CORPORATE RESERVE PLAN</Text>
          <Text style={styles.planStatusTier}>{cardCustomerPlan.tier}</Text>
          <Text style={styles.planStatusLine}>
            <Text style={styles.planStatusActive}>ACTIVE</Text> · valid until {new Date(cardCustomerPlan.expiresAt).toLocaleDateString()}
          </Text>
          <Text style={styles.planStatusEmail}>Signed in as {cardCustomerEmail}</Text>
        </View>
      ) : planPolling ? (
        <View style={styles.planPendingCard}>
          <Text style={styles.planPendingText}>⏳ Activating your plan on-chain — this can take up to a minute. Feel free to keep browsing, this updates automatically.</Text>
        </View>
      ) : planTimedOut ? (
        <View style={styles.planTimedOutCard}>
          <Text style={styles.planTimedOutText}>
            ⚠️ Payment received, but activation is taking longer than expected. This usually means the settlement step failed server-side — contact support with email: {cardCustomerEmail}
          </Text>
        </View>
      ) : null}

      {/* CORPORATE RESERVE */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>🏢 Corporate Reserve Plans (Annual)</Text>
        <Text style={styles.panelNote}>Fixed annual allocation, billed in USDT, with system maintenance settled natively in INAYA.</Text>
        {CORPORATE_TIERS.map((row) => (
          <TouchableOpacity
            key={row.tier}
            onPress={() => setSelectedTier(row.tier)}
            style={[styles.tierCard, selectedTier === row.tier && styles.tierCardSelected]}
          >
            <Text style={styles.tierCardTitle}>{row.tier}</Text>
            <Text style={styles.tierCardLine}>Inaya Fee: <Text style={styles.tierCardHighlight}>{row.inaya}</Text></Text>
            <Text style={styles.tierCardLine}>AWS S3 Standard (storage only): {row.aws}</Text>
            <Text style={styles.tierCardLine}>Backblaze B2 (storage only): {row.b2}</Text>
            <Text style={styles.tierCardLine}>Maintenance: {row.maintenance}</Text>
          </TouchableOpacity>
        ))}

        {!PLAY_EDITION && (
        <View style={styles.checkoutBox}>
          <Text style={styles.checkoutLabel}>// READY FOR ACTIVATION</Text>
          <Text style={styles.checkoutTier}>Selected Allocation: {selectedTier}</Text>
          <GradientButton
            title={isStartingCheckout ? 'REDIRECTING...' : '💳 PAY WITH CARD (NO WALLET)'}
            onPress={handleCardCheckout}
            loading={isStartingCheckout}
            style={{ marginTop: spacing.md }}
          />
          <View style={styles.testModeNotice}>
            <Text style={styles.testModeText}>⚠️ TEST MODE — use card 4242 4242 4242 4242, any future expiry, any CVC/ZIP.</Text>
          </View>
          {!!checkoutMessage && <Text style={styles.checkoutMessage}>{checkoutMessage}</Text>}
        </View>
        )}
      </View>

      {/* FUNDAMENTALS */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>✅ Professional Network Fundamentals</Text>
        {FUNDAMENTALS.map((f) => (
          <View key={f.title} style={styles.fundamentalCard}>
            <Text style={styles.fundamentalTitle}>{f.title}</Text>
            <Text style={styles.fundamentalBody}>{f.body}</Text>
          </View>
        ))}
      </View>

      {!PLAY_EDITION && <CheckoutWebView
        visible={!!checkoutUrl}
        url={checkoutUrl}
        onClose={() => setCheckoutUrl(null)}
        onResult={handleCheckoutResult}
      />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + 8 },
  title: { fontSize: 18, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.3 },
  subtitle: { fontSize: 12, fontFamily: fonts.mono, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  summaryCard: { minWidth: '46%', flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  summaryValue: { fontFamily: fonts.monoBold, fontSize: 16 },
  summaryLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted, marginTop: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  panel: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  panelTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm },
  panelNote: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 15 },
  payggrid: { gap: spacing.md },
  paygCard: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  paygLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  paygPrice: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.sm },
  disabledButton: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.sm, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  disabledButtonText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.textMuted },
  comparisonRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  comparisonRowHighlight: { backgroundColor: 'rgba(34,211,238,0.06)', borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  comparisonProvider: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary },
  comparisonStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  comparisonStat: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary },
  comparisonHighlightText: { color: colors.success },
  tierCard: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  tierCardSelected: { borderColor: colors.cyan, backgroundColor: 'rgba(0,242,254,0.05)' },
  tierCardTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.xs },
  tierCardLine: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  tierCardHighlight: { color: colors.warning, fontFamily: fonts.monoBold },
  checkoutBox: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderAccent, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm },
  checkoutLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.cyan },
  checkoutTier: { fontFamily: fonts.sansExtraBold, fontSize: 14, color: colors.textPrimary, marginTop: spacing.xs },
  testModeNotice: { backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md },
  testModeText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.warning },
  checkoutMessage: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, marginTop: spacing.md },
  planStatusCard: { backgroundColor: 'rgba(52,211,153,0.06)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  planStatusLabel: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.success, letterSpacing: 1 },
  planStatusTier: { fontFamily: fonts.sansExtraBold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.xs },
  planStatusLine: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs },
  planStatusActive: { color: colors.success, fontFamily: fonts.monoBold },
  planStatusEmail: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  planPendingCard: { backgroundColor: 'rgba(0,242,254,0.06)', borderWidth: 1, borderColor: colors.borderAccent, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  planPendingText: { fontFamily: fonts.mono, fontSize: 11, color: colors.cyan, lineHeight: 16 },
  planTimedOutCard: { backgroundColor: 'rgba(245,158,11,0.06)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  planTimedOutText: { fontFamily: fonts.mono, fontSize: 11, color: colors.warning, lineHeight: 16 },
  fundamentalCard: { backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  fundamentalTitle: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.cyan },
  fundamentalBody: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 15 },
});
