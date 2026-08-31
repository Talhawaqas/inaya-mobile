// src/screens/BridgeScreen.js
//
// Cross-chain $INAYA (SOW-1), mobile scope: bridge OUT from BSC Testnet to an EVM spoke, and
// view the combined cross-chain staking position. Mirrors the web dApp's /bridge page
// (inaya-network-dapp/src/app/bridge/page.js) and reuses its backend API.
//
// Deliberately scoped down vs. the web app: WalletProvider.js (see its header comment) only
// supports a single connect scope, eip155:97 (BSC Testnet) -- there is no multi-chain session or
// generalized chain-switch here, so this screen can only SIGN on BSC. That's fine for outbound
// transfers (bridgeOut is a home-chain-only call regardless of destination), but bridging FROM
// Sepolia/Amoy/Fuji/Solana, or staking directly from another chain, isn't possible from mobile
// yet -- would need WalletProvider extended with more scopes first. Solana is out of scope here
// entirely (recipient encoding differs, no Solana wallet integration on mobile).
//
// Multi-chain SOW, Phase 1: the destination-chain list used to be a hardcoded DEST_CHAINS/
// CHAIN_NAMES pair here -- the third of three places (alongside the dApp's chains.js and
// bridge-sdk's chains.js) that had to be manually kept in sync with whatever chains are actually
// deployed. Now fetched live from GET /api/bridge/supported-chains (the same endpoint the web
// /bridge page already uses) -- a chain added there shows up here automatically, no app update
// needed, and a chain that's removed/renamed can't silently drift out of sync either.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { ethers } from 'ethers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../providers/WalletProvider';
import { colors, spacing, radius, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import GlassCard from '../components/GlassCard';
import SegmentedToggle from '../components/SegmentedToggle';
import BackgroundGlow from '../components/BackgroundGlow';
import { waitForReceipt } from '../utils/waitForReceipt';

const API_BASE = 'https://www.inayanetwork.com';

const INAYA_TOKEN_ADDRESS = '0x3966a3378c8d9e6bb34dd0b8458eef4b878ce94e';
const BRIDGE_HOME_ADDRESS = '0xaF1341ea8a5284D561aD2F1287698DAFE180c484';
const TRANSFER_FEE = 100000000000000n; // 0.0001 INAYA, InayaToken's flat transfer fee

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
];
const BRIDGE_HOME_ABI = [
  'function bridgeOut(uint256 destChainId, bytes32 recipient, uint256 amount) external returns (bytes32 messageId)',
];
const erc20 = new ethers.Interface(ERC20_ABI);
const bridgeHome = new ethers.Interface(BRIDGE_HOME_ABI);

export default function BridgeScreen() {
  const tabBarHeight = useSafeAreaInsets().bottom;
  const { address, isConnected, invokeMethod, connect, connecting } = useWallet();
  const [chains, setChains] = useState(null); // full list from the API, incl. home + Solana
  const [chainsError, setChainsError] = useState('');
  const [destChainId, setDestChainId] = useState(null);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [position, setPosition] = useState(null);
  const [log, setLog] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/bridge/supported-chains`);
        const data = await res.json();
        if (!data.success) throw new Error('Could not load supported chains.');
        setChains(data.chains);
        const destChains = data.chains.filter((c) => !c.isHome && c.isEvm !== false);
        if (destChains[0]) setDestChainId(destChains[0].chainId);
      } catch (err) {
        console.warn('Bridge chain list fetch failed:', err);
        setChainsError('Could not load the list of destination chains — pull to retry.');
      }
    })();
  }, []);

  useEffect(() => {
    if (address) setRecipient((r) => r || address);
  }, [address]);

  // Mobile only ever SIGNS on BSC Testnet (see header comment) -- destChains is
  // everywhere the outbound bridgeOut() call can target; chainNames covers every
  // chain (incl. home + Solana) for display purposes like the origin-chain breakdown.
  const destChains = (chains || []).filter((c) => !c.isHome && c.isEvm !== false)
    .map((c) => ({ label: c.name, value: c.chainId }));
  const chainNames = Object.fromEntries((chains || []).map((c) => [c.chainId, c.name]));

  const refreshPosition = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`${API_BASE}/api/bridge/staking-position/${address}`);
      const data = await res.json();
      if (data.success) setPosition(data.position);
    } catch (err) {
      console.warn('Bridge position fetch failed:', err);
    }
  }, [address]);

  useEffect(() => { refreshPosition(); }, [refreshPosition]);

  async function handleBridge() {
    if (!isConnected || !address) { setLog('❌ Connect your wallet first.'); return; }
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) { setLog('❌ Enter a valid amount.'); return; }
    if (!ethers.isAddress(recipient)) { setLog('❌ Enter a valid recipient address.'); return; }

    setBusy(true);
    setLog(`🔄 Preparing to bridge ${amountNum} $INAYA to ${chainNames[destChainId]}...`);
    try {
      const amountWei = ethers.parseUnits(amount, 18);
      const recipientBytes32 = ethers.zeroPadValue(recipient, 32);

      setLog('✍️ Approving $INAYA for the bridge...');
      const approveData = erc20.encodeFunctionData('approve', [BRIDGE_HOME_ADDRESS, amountWei + TRANSFER_FEE]);
      const approveTxHash = await invokeMethod({ method: 'eth_sendTransaction', params: [{ from: address, to: INAYA_TOKEN_ADDRESS, data: approveData }] });
      setLog('⏳ Mining approval transaction...');
      await waitForReceipt(invokeMethod, approveTxHash);

      setLog(`✍️ Signing bridge transaction to ${chainNames[destChainId]}...`);
      const bridgeData = bridgeHome.encodeFunctionData('bridgeOut', [destChainId, recipientBytes32, amountWei]);
      const txHash = await invokeMethod({ method: 'eth_sendTransaction', params: [{ from: address, to: BRIDGE_HOME_ADDRESS, data: bridgeData }] });
      setLog('⏳ Mining bridge transaction...');
      await waitForReceipt(invokeMethod, txHash);

      setLog(`✅ Bridged ${amountNum} $INAYA to ${chainNames[destChainId]} — tx ${txHash.slice(0, 14)}... The relayer will deliver it shortly; track status on the web app's /bridge page.`);
      setAmount('');
      refreshPosition();
    } catch (err) {
      console.error('Bridge failed:', err);
      setLog(`❌ Bridge failed: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
        <Text style={styles.title}>Cross-Chain Bridge</Text>
        <Text style={styles.subtitle}>
          Move $INAYA from BSC Testnet to another network. Same token everywhere, one unified staking position.
        </Text>

        {!!log && <Text style={styles.logText}>{log}</Text>}

        {!isConnected && (
          <GlassCard style={{ marginBottom: spacing.lg }}>
            <Text style={styles.connectBannerText}>Connect your wallet to bridge $INAYA and view your position.</Text>
            <GradientButton title="Connect Wallet" onPress={connect} loading={connecting} style={{ marginTop: spacing.md }} />
          </GlassCard>
        )}

        <GlassCard style={{ marginBottom: spacing.lg }}>
          <Text style={styles.panelTitle}>Bridge from BSC Testnet</Text>
          <Text style={styles.lockTierLabel}>Destination</Text>
          {!chains && !chainsError && <ActivityIndicator color={colors.cyan} style={{ marginBottom: spacing.lg }} />}
          {!!chainsError && <Text style={[styles.logText, { marginBottom: spacing.lg }]}>{chainsError}</Text>}
          {destChains.length > 0 && (
            <SegmentedToggle options={destChains} value={destChainId} onChange={setDestChainId} style={{ marginBottom: spacing.lg }} />
          )}
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Amount (INAYA)"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={setAmount}
          />
          <TextInput
            style={styles.input}
            placeholder="Recipient address (0x...)"
            placeholderTextColor={colors.textMuted}
            value={recipient}
            onChangeText={setRecipient}
            autoCapitalize="none"
          />
          <GradientButton title="Bridge" onPress={handleBridge} loading={busy} disabled={!isConnected || busy || !destChainId} />
        </GlassCard>

        {position && (
          <GlassCard style={{ marginBottom: spacing.lg }}>
            <Text style={styles.panelTitle}>Your Unified Staking Position</Text>
            <Text style={styles.metricLabel}>Staked</Text>
            <Text style={styles.metricValue}>{Number(ethers.formatUnits(position.userStakedBalance, 18)).toLocaleString()} INAYA</Text>
            <Text style={[styles.metricLabel, { marginTop: spacing.md }]}>Claimable rewards</Text>
            <Text style={styles.metricValue}>{Number(ethers.formatUnits(position.earned, 18)).toFixed(4)} INAYA</Text>
            {position.byOriginChain?.length > 0 && (
              <>
                <Text style={[styles.lockTierLabel, { marginTop: spacing.md }]}>By origin network (lifetime)</Text>
                {position.byOriginChain.map((b) => (
                  <Text key={b.chainId} style={styles.originLine}>
                    {chainNames[b.chainId] || `Chain ${b.chainId}`}: {Number(ethers.formatUnits(b.lifetimeStaked, 18)).toLocaleString()} INAYA
                  </Text>
                ))}
              </>
            )}
          </GlassCard>
        )}

        <Text style={styles.footnote}>
          Staking directly from another chain isn't available in the app yet — bridge to BSC Testnet first, then stake from the Staking tab.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + 8 },
  title: { fontSize: 24, fontFamily: fonts.sansExtraBold, color: colors.textPrimary },
  subtitle: { fontSize: 13, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 18 },
  logText: { fontFamily: fonts.mono, fontSize: 11, color: colors.cyan, backgroundColor: 'rgba(0,242,254,0.06)', borderWidth: 1, borderColor: colors.borderAccent, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  connectBannerText: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  panelTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.md },
  lockTierLabel: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, color: colors.textPrimary,
    fontFamily: fonts.mono, fontSize: 13, marginBottom: spacing.md,
  },
  metricLabel: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.textSecondary },
  metricValue: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.textPrimary, marginTop: spacing.xs },
  originLine: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  footnote: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.sm },
});
