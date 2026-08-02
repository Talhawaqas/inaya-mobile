// src/screens/StakingScreen.js
//
// $INAYA staking — stake/unstake/claim, mirroring the web dApp's Staking
// tab (page.js: handleStakeInaya/handleUnstakeInaya/handleClaimStakingReward,
// refreshStakingOverview). Uses the SAME stakingABI/address page.js calls
// directly, NOT custody-sdk's InayaKernel.Staking — the SDK's
// INAYA_STAKING_ABI is stale (stake/unstake/stakedBalance/stakingTimestamp)
// relative to the actually-deployed contract at this address, which page.js
// calls with a different, lock-tier-aware ABI (stake(amount,lockPeriodDays),
// withdraw(amount), claimReward(), earned/getUserTier/userStakedBalance/
// lockExpiry). Matching page.js's real ABI directly avoids reverts.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { ethers } from 'ethers';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useWallet } from '../providers/WalletProvider';
import { colors, spacing, radius, fonts, glow } from '../theme';
import GradientButton from '../components/GradientButton';
import GlassCard from '../components/GlassCard';
import SegmentedToggle from '../components/SegmentedToggle';
import BackgroundGlow from '../components/BackgroundGlow';
import { waitForReceipt } from '../utils/waitForReceipt';

const INAYA_TOKEN_ADDRESS = '0x3966a3378c8d9e6bb34dd0b8458eef4b878ce94e';
const STAKING_ADDRESS = '0xc465279444Cb0E10c69D0769CDae31E457eA660f';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
];
const STAKING_ABI = [
  'function stake(uint256 amount, uint256 lockPeriodDays) external',
  'function withdraw(uint256 amount) external',
  'function claimReward() external',
  'function earned(address account) public view returns (uint256)',
  'function getUserTier(address account) external view returns (string memory)',
  'function totalStaked() public view returns (uint256)',
  'function rewardRate() public view returns (uint256)',
  'function userStakedBalance(address) public view returns (uint256)',
  'function lockExpiry(address) public view returns (uint256)',
];

const erc20 = new ethers.Interface(ERC20_ABI);
const staking = new ethers.Interface(STAKING_ABI);

const LOCK_TIERS = [
  { label: 'Flexible', sublabel: '1.0x', value: 0 },
  { label: '30 Days', sublabel: '1.25x', value: 30 },
  { label: '90 Days', sublabel: '1.50x', value: 90 },
];

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

export default function StakingScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { address, isConnected, invokeMethod, connect, connecting } = useWallet();
  const [overview, setOverview] = useState({
    totalStakedTVL: '0', estimatedAPY: '0.00', myStakedBalance: '0',
    claimableRewards: '0', lockExpiryTimestamp: 0, userTier: 'None',
  });
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [lockTier, setLockTier] = useState(0);
  const [log, setLog] = useState('');
  const [busy, setBusy] = useState(null); // 'stake' | 'unstake' | 'claim' | null

  const ethCall = useCallback((data) => invokeMethod({ method: 'eth_call', params: [{ to: STAKING_ADDRESS, data }, 'latest'] }), [invokeMethod]);

  // @metamask/connect-multichain requires an established transport/session
  // before invokeMethod will relay ANY call, reads included — unlike a
  // browser's window.ethereum, which usually allows eth_call before the
  // user has authorized account access. So unlike the web dApp (which can
  // show live TVL/APY to anyone with a wallet extension installed, connected
  // or not), these reads are only possible once a wallet is actually connected.
  const refreshOverview = useCallback(async () => {
    if (!isConnected || !address) return;
    try {
      const [totalStakedRaw, rateRaw, tierRaw, balanceRaw, earnedRaw, expiryRaw] = await Promise.all([
        ethCall(staking.encodeFunctionData('totalStaked', [])),
        ethCall(staking.encodeFunctionData('rewardRate', [])),
        ethCall(staking.encodeFunctionData('getUserTier', [address])),
        ethCall(staking.encodeFunctionData('userStakedBalance', [address])),
        ethCall(staking.encodeFunctionData('earned', [address])),
        ethCall(staking.encodeFunctionData('lockExpiry', [address])),
      ]);
      const [totalStaked] = staking.decodeFunctionResult('totalStaked', totalStakedRaw);
      const [rate] = staking.decodeFunctionResult('rewardRate', rateRaw);
      const [userTier] = staking.decodeFunctionResult('getUserTier', tierRaw);
      const [balance] = staking.decodeFunctionResult('userStakedBalance', balanceRaw);
      const [earned] = staking.decodeFunctionResult('earned', earnedRaw);
      const [expiry] = staking.decodeFunctionResult('lockExpiry', expiryRaw);

      let apyPercent = '0.00';
      if (totalStaked > 0n) {
        const annualRewardWei = rate * BigInt(SECONDS_PER_YEAR);
        const apyBps = (annualRewardWei * 10000n) / totalStaked;
        apyPercent = (Number(apyBps) / 100).toFixed(2);
      }

      setOverview({
        totalStakedTVL: ethers.formatUnits(totalStaked, 18),
        estimatedAPY: apyPercent,
        myStakedBalance: ethers.formatUnits(balance, 18),
        claimableRewards: ethers.formatUnits(earned, 18),
        lockExpiryTimestamp: Number(expiry) * 1000,
        userTier,
      });
    } catch (err) {
      console.warn('Staking overview fetch failed:', err);
    }
  }, [ethCall, isConnected, address]);

  useEffect(() => { refreshOverview(); }, [refreshOverview]);

  async function handleStake() {
    if (!isConnected || !address) { setLog('❌ Connect your wallet first.'); return; }
    const amount = parseFloat(stakeAmount);
    if (!amount || amount <= 0) { setLog('❌ Enter a valid amount to stake.'); return; }

    setBusy('stake');
    setLog(`🔄 Preparing to stake ${amount} $INAYA (${lockTier === 0 ? 'Flexible' : lockTier + '-day lock'})...`);
    try {
      const amountWei = ethers.parseUnits(stakeAmount, 18);

      const balanceRaw = await invokeMethod({ method: 'eth_call', params: [{ to: INAYA_TOKEN_ADDRESS, data: erc20.encodeFunctionData('balanceOf', [address]) }, 'latest'] });
      const [balance] = erc20.decodeFunctionResult('balanceOf', balanceRaw);
      if (balance < amountWei) {
        setLog(`❌ Insufficient $INAYA balance. You have ${ethers.formatUnits(balance, 18)}.`);
        return;
      }

      const allowanceRaw = await invokeMethod({ method: 'eth_call', params: [{ to: INAYA_TOKEN_ADDRESS, data: erc20.encodeFunctionData('allowance', [address, STAKING_ADDRESS]) }, 'latest'] });
      const [allowance] = erc20.decodeFunctionResult('allowance', allowanceRaw);
      if (allowance < amountWei) {
        setLog('✍️ Requesting $INAYA spending approval for the staking contract...');
        const approveData = erc20.encodeFunctionData('approve', [STAKING_ADDRESS, ethers.MaxUint256]);
        const approveTxHash = await invokeMethod({ method: 'eth_sendTransaction', params: [{ from: address, to: INAYA_TOKEN_ADDRESS, data: approveData }] });
        setLog('⏳ Mining approval transaction...');
        await waitForReceipt(invokeMethod, approveTxHash);
      }

      setLog(`✍️ Signing stake transaction for ${amount} $INAYA...`);
      const stakeData = staking.encodeFunctionData('stake', [amountWei, lockTier]);
      const txHash = await invokeMethod({ method: 'eth_sendTransaction', params: [{ from: address, to: STAKING_ADDRESS, data: stakeData }] });
      setLog('⏳ Mining stake transaction...');
      await waitForReceipt(invokeMethod, txHash);

      setLog(`✅ Staked ${amount} $INAYA — tx ${txHash.slice(0, 14)}...`);
      setStakeAmount('');
      refreshOverview();
    } catch (err) {
      console.error('Stake failed:', err);
      setLog(`❌ Stake failed: ${err?.message || err}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleUnstake() {
    if (!isConnected || !address) { setLog('❌ Connect your wallet first.'); return; }
    const amount = parseFloat(unstakeAmount);
    if (!amount || amount <= 0) { setLog('❌ Enter a valid amount to withdraw.'); return; }
    if (overview.lockExpiryTimestamp > Date.now()) {
      setLog(`❌ Locked until ${new Date(overview.lockExpiryTimestamp).toLocaleString()}.`);
      return;
    }

    setBusy('unstake');
    setLog(`🔄 Preparing to withdraw ${amount} $INAYA...`);
    try {
      const amountWei = ethers.parseUnits(unstakeAmount, 18);
      const data = staking.encodeFunctionData('withdraw', [amountWei]);
      const txHash = await invokeMethod({ method: 'eth_sendTransaction', params: [{ from: address, to: STAKING_ADDRESS, data }] });
      setLog('⏳ Mining withdrawal transaction...');
      await waitForReceipt(invokeMethod, txHash);

      setLog(`✅ Withdrew ${amount} $INAYA — tx ${txHash.slice(0, 14)}...`);
      setUnstakeAmount('');
      refreshOverview();
    } catch (err) {
      console.error('Withdrawal failed:', err);
      setLog(`❌ Withdrawal failed: ${err?.message || err}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleClaim() {
    if (!isConnected || !address) { setLog('❌ Connect your wallet first.'); return; }
    setBusy('claim');
    setLog('🔄 Preparing to claim rewards...');
    try {
      const data = staking.encodeFunctionData('claimReward', []);
      const txHash = await invokeMethod({ method: 'eth_sendTransaction', params: [{ from: address, to: STAKING_ADDRESS, data }] });
      setLog('⏳ Mining claim transaction...');
      await waitForReceipt(invokeMethod, txHash);

      setLog(`✅ Rewards claimed — tx ${txHash.slice(0, 14)}...`);
      refreshOverview();
    } catch (err) {
      console.error('Claim failed:', err);
      setLog(`❌ Claim failed: ${err?.message || err}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.root}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
        <Text style={styles.title}>Staking</Text>
        <Text style={styles.subtitle}>
          Stake $INAYA to earn passive APY from the 8,000,000 INAYA Staking Rewards Pool and unlock priority bandwidth tiers.
        </Text>

        {!!log && <Text style={styles.logText}>{log}</Text>}

        {!isConnected && (
          <GlassCard style={{ marginBottom: spacing.lg }}>
            <Text style={styles.connectBannerText}>Connect your wallet to see live staking data and stake/unstake/claim.</Text>
            <GradientButton title="Connect Wallet" onPress={connect} loading={connecting} style={{ marginTop: spacing.md }} />
          </GlassCard>
        )}

        <GlassCard style={styles.tvlCard}>
          <Text style={styles.tvlLabel}>Total Value Locked</Text>
          <Text style={styles.tvlValue}>{isConnected ? Number(overview.totalStakedTVL).toLocaleString() : '—'} <Text style={styles.tvlUnit}>INAYA</Text></Text>
        </GlassCard>

        <View style={styles.metricsRow}>
          <GlassCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Est. APY</Text>
            <Text style={[styles.metricValue, { color: colors.success }]}>{isConnected ? `${overview.estimatedAPY}%` : '—'}</Text>
          </GlassCard>
          <GlassCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Your Staked</Text>
            <Text style={styles.metricValue}>{isConnected ? Number(overview.myStakedBalance).toLocaleString() : '—'}</Text>
          </GlassCard>
        </View>

        <GlassCard style={{ marginBottom: spacing.lg }}>
          <Text style={styles.metricLabel}>Claimable Rewards</Text>
          <Text style={[styles.claimValue, { color: colors.warning }]}>{isConnected ? Number(overview.claimableRewards).toFixed(4) : '—'}</Text>
          <GradientButton
            title="Claim Rewards"
            onPress={handleClaim}
            loading={busy === 'claim'}
            disabled={!isConnected || busy !== null || parseFloat(overview.claimableRewards) <= 0}
            style={{ marginTop: spacing.md }}
          />
        </GlassCard>

        {isConnected && overview.userTier === 'Enterprise Priority' && (
          <View style={styles.tierBanner}>
            <Text style={styles.tierBannerText}>⚡ Tier 1 Priority Node — High API Bandwidth Active</Text>
          </View>
        )}

        <GlassCard style={{ marginBottom: spacing.lg }}>
          <Text style={styles.panelTitle}>Stake</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Amount to stake"
            placeholderTextColor={colors.textMuted}
            value={stakeAmount}
            onChangeText={setStakeAmount}
          />
          <Text style={styles.lockTierLabel}>Lock Tier</Text>
          <SegmentedToggle options={LOCK_TIERS} value={lockTier} onChange={setLockTier} style={{ marginBottom: spacing.lg }} />
          <GradientButton title="Stake Now" onPress={handleStake} loading={busy === 'stake'} disabled={!isConnected || busy !== null} />
        </GlassCard>

        <GlassCard style={{ marginBottom: spacing.lg }}>
          <Text style={styles.panelTitle}>Unstake</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Amount to withdraw"
            placeholderTextColor={colors.textMuted}
            value={unstakeAmount}
            onChangeText={setUnstakeAmount}
          />
          {overview.lockExpiryTimestamp > Date.now() && (
            <Text style={styles.lockNotice}>🔒 Locked until {new Date(overview.lockExpiryTimestamp).toLocaleString()}</Text>
          )}
          <TouchableOpacity
            style={[styles.withdrawButton, (busy !== null || !isConnected) && styles.disabled]}
            onPress={handleUnstake}
            disabled={!isConnected || busy !== null}
          >
            <Text style={styles.withdrawButtonText}>{busy === 'unstake' ? 'WITHDRAWING...' : 'WITHDRAW'}</Text>
          </TouchableOpacity>
        </GlassCard>
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
  tvlCard: { marginBottom: spacing.md, ...glow(colors.cyan, 0.1, 14) },
  tvlLabel: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary },
  tvlValue: { fontFamily: fonts.monoBold, fontSize: 26, color: colors.textPrimary, marginTop: spacing.sm },
  tvlUnit: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textSecondary },
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  metricCard: { flex: 1 },
  metricLabel: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.textSecondary },
  metricValue: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.textPrimary, marginTop: spacing.xs },
  claimValue: { fontFamily: fonts.sansExtraBold, fontSize: 26, marginTop: spacing.xs },
  tierBanner: { backgroundColor: 'rgba(52,211,153,0.06)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  tierBannerText: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.success },
  panelTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.md },
  input: {
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, color: colors.textPrimary,
    fontFamily: fonts.mono, fontSize: 13, marginBottom: spacing.md,
  },
  lockTierLabel: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: colors.textSecondary, marginBottom: spacing.sm },
  lockNotice: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.warning, marginBottom: spacing.md },
  withdrawButton: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  withdrawButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary },
  disabled: { opacity: 0.4 },
});
