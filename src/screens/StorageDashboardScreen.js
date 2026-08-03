// src/screens/StorageDashboardScreen.js
//
// V2 dashboard — a lightweight launcher rather than a screen that does
// everything itself: wallet balance, the 3x2 action grid (each tile routes
// to its own dedicated screen — see Upload/Download/MyFiles/NodeStatus
// screens and the Staking/Dashboard tabs), storage utilization, and node
// status. The actual upload/download/staking logic all moved to their own
// screens; this one only reads summary state.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { ethers } from 'ethers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../providers/WalletProvider';
import { useUploadsHistory } from '../hooks/useUploadsHistory';
import { colors, spacing, radius, fonts, glassCard } from '../theme';
import GradientButton from '../components/GradientButton';
import GlassCard from '../components/GlassCard';
import ActionTile from '../components/ActionTile';
import StorageMeter from '../components/StorageMeter';
import BackgroundGlow from '../components/BackgroundGlow';

const INAYA_TOKEN_ADDRESS = '0x3966a3378c8d9e6bb34dd0b8458eef4b878ce94e';
const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];
const erc20Interface = new ethers.Interface(ERC20_BALANCE_ABI);

const ACTIONS = [
  { key: 'Upload', icon: 'cloud-upload-outline', label: 'Upload' },
  { key: 'Download', icon: 'cloud-download-outline', label: 'Download' },
  { key: 'MyFiles', icon: 'folder-outline', label: 'My Files' },
  { key: 'NodeStatus', icon: 'radio-outline', label: 'Watcher Node' },
  { key: 'Staking', icon: 'trending-up-outline', label: 'Staking' },
  { key: 'Dashboard', icon: 'grid-outline', label: 'Dashboard' },
];

export default function StorageDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom;
  const { connect, address, isConnected, connecting, invokeMethod, isSignedUp } = useWallet();
  const { totalUsedBytes } = useUploadsHistory();
  const [inayaBalance, setInayaBalance] = useState(null);

  const fetchBalance = useCallback(async () => {
    if (!isConnected || !address) { setInayaBalance(null); return; }
    try {
      const data = erc20Interface.encodeFunctionData('balanceOf', [address]);
      const result = await invokeMethod({ method: 'eth_call', params: [{ to: INAYA_TOKEN_ADDRESS, data }, 'latest'] });
      const [balance] = erc20Interface.decodeFunctionResult('balanceOf', result);
      setInayaBalance(parseFloat(ethers.formatUnits(balance, 18)).toFixed(2));
    } catch (err) {
      console.warn('Balance fetch failed:', err);
    }
  }, [isConnected, address, invokeMethod]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Navigate() bubbles up to the parent Drawer.Navigator for route names not
  // found in this stack (Staking, Dashboard are sibling drawer items, not
  // HomeStack screens) -- same call works for both stack-local and
  // drawer-level routes.
  const goTo = (routeName) => navigation.navigate(routeName);

  return (
    <View style={styles.root}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: tabBarHeight + spacing.xl }]}>
        <View style={styles.header}>
          {/* This screen's own Stack.Screen has headerShown: false (see App.js) --
              the Drawer's automatic hamburger+header shows on every other screen,
              but Home needs its own since HomeStack's header is hidden here to
              avoid a double header when nested inside the drawer. */}
          <TouchableOpacity
            onPress={() => navigation.getParent()?.openDrawer()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="menu" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
            <View>
              <Text style={styles.brandTitle}>INAYA</Text>
              <Text style={styles.brandSubtitle}>NETWORK</Text>
            </View>
          </View>
        </View>

        <GlassCard style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          {!isConnected ? (
            <GradientButton title={connecting ? 'Connecting...' : 'Connect Wallet'} onPress={connect} loading={connecting} style={{ marginTop: spacing.md }} />
          ) : (
            <>
              <Text style={styles.balanceValue}>
                {inayaBalance ?? '—'} <Text style={styles.balanceUnit}>INAYA</Text>
              </Text>
              {/* No live INAYA/USD price feed exists anywhere in this codebase yet --
                  showing a fabricated conversion would be worse than not showing one. */}
              <Text style={styles.balanceAddress}>{address?.slice(0, 6)}...{address?.slice(-4)}</Text>
            </>
          )}
        </GlassCard>

        <View style={styles.grid}>
          {ACTIONS.map((action) => (
            <ActionTile key={action.key} icon={action.icon} label={action.label} onPress={() => goTo(action.key)} />
          ))}
        </View>

        <StorageMeter usedBytes={totalUsedBytes} style={styles.widget} />

        <GlassCard style={styles.widget}>
          <View style={styles.nodeRow}>
            <Text style={styles.nodeLabel}>Node Status</Text>
            <View style={[styles.liveBadge, !isConnected && styles.liveBadgeIdle]}>
              <View style={[styles.liveDot, !isConnected && styles.liveDotIdle]} />
              <Text style={[styles.liveBadgeText, !isConnected && styles.liveBadgeTextIdle]}>
                {isConnected ? 'LIVE' : 'IDLE'}
              </Text>
            </View>
          </View>
          <Text style={styles.nodeSub}>
            {isConnected
              ? isSignedUp
                ? 'Your watcher node is active and securing the network.'
                : 'Wallet connected — verify from the Watcher Node tile to go fully live.'
              : 'Connect your wallet to activate this device as a node.'}
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: { width: 38, height: 38, borderRadius: radius.sm },
  brandTitle: { fontFamily: fonts.sansExtraBold, fontSize: 22, color: colors.textPrimary, letterSpacing: 1 },
  brandSubtitle: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.cyan, letterSpacing: 2, marginTop: -2 },
  balanceCard: { marginBottom: spacing.lg },
  balanceLabel: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary },
  balanceValue: { fontFamily: fonts.monoBold, fontSize: 28, color: colors.textPrimary, marginTop: spacing.sm },
  balanceUnit: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textSecondary },
  balanceAddress: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  widget: { marginBottom: spacing.lg },
  nodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nodeLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.textPrimary },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)',
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4,
  },
  liveBadgeIdle: { backgroundColor: 'rgba(148,163,184,0.08)', borderColor: colors.border },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveDotIdle: { backgroundColor: colors.textMuted },
  liveBadgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.success, letterSpacing: 0.5 },
  liveBadgeTextIdle: { color: colors.textMuted },
  nodeSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
});
