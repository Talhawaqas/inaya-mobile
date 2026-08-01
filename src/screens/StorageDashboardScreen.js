// src/screens/StorageDashboardScreen.js
//
// Home screen — mirrors the web dApp's "Network Home" + Dashboard blend:
// connection state, quick stats, and a real file upload flow (encrypt,
// shard, pin to IPFS via the existing dApp backend, register on-chain).

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ethers } from 'ethers';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { InayaKernel } from '@inaya-network/custody-sdk';
import { useWallet } from '../providers/WalletProvider';
import { colors, spacing, radius, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import StatTile from '../components/StatTile';
import StatusDot from '../components/StatusDot';

// Same Custody address/ABI fragment the SDK and the web dApp both use.
const CUSTODY_ADDRESS = '0x7F5E6cF1353beEE4fc19FD46Dd6EaD0B3895a888';
const custodyInterface = new ethers.Interface([
  'function batchRegisterAssets(bytes32[] fileHashes, uint256[] fileSizes, string[] shardACIDs, string[] shardBCIDs) external',
]);

// Reuses the SAME /api/upload route the web dApp already calls to pin
// shards to Pinata — no separate mobile-specific pinning setup needed.
// Payload keys (encryptedShard/elementTag) must match src/app/api/upload/route.js
// exactly, same as the web dApp's own call in page.js — the route destructures
// those specific names, not shard/tag. www. avoids a redirect hop off the apex
// domain (inayanetwork.com -> www.inayanetwork.com).
async function pinShardToIPFS(shardContent, filename, tag, walletAddress) {
  const res = await fetch('https://www.inayanetwork.com/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedShard: shardContent, filename, elementTag: tag, walletAddress }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || data.pinata || `Pinning failed for shard ${tag} (HTTP ${res.status})`);
  return data.IpfsHash;
}

export default function StorageDashboardScreen({ navigation }) {
  const tabBarHeight = useBottomTabBarHeight();
  const { connect, address, isConnected, chainId, connecting, invokeMethod } = useWallet();
  const [passkey, setPasskey] = useState('');
  const [status, setStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload() {
    if (!isConnected) return;
    if (!passkey) { setStatus('Enter a passkey first.'); return; }

    setIsUploading(true);
    try {
      setStatus('Picking a file...');
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) { setStatus(''); setIsUploading(false); return; }
      const picked = result.assets[0];

      setStatus('Encrypting...');
      const blob = await (await fetch(picked.uri)).blob();
      // disperseAndSlice() hands the file straight to FileReader.readAsDataURL(),
      // which requires a real Blob instance — a plain {arrayBuffer, type, name}
      // lookalike fails with "parameter 1 is not of type 'Blob'". A fetched Blob
      // just lacks .name, so attach it directly rather than replacing the Blob.
      blob.name = picked.name;

      const salt = InayaKernel.generateSecureSalt(16);
      const vaultKey = await InayaKernel.deriveVaultKey({ passkey, salt });
      const sharded = await InayaKernel.disperseAndSlice({ file: blob, encryptionKey: vaultKey });

      setStatus('Pinning shards to IPFS...');
      const [cidAlpha, cidBeta] = await Promise.all([
        pinShardToIPFS(sharded.shardAlpha, sharded.filename, 'Alpha', address),
        pinShardToIPFS(sharded.shardBeta, sharded.filename, 'Beta', address),
      ]);

      const assetIdText = `${sharded.filename}-${Date.now()}`;
      const fileHash = ethers.id(assetIdText);
      const sizeBytes = picked.size ?? 0;

      const data = custodyInterface.encodeFunctionData('batchRegisterAssets', [
        [fileHash], [sizeBytes], [cidAlpha], [cidBeta],
      ]);
      const txParams = { from: address, to: CUSTODY_ADDRESS, data };

      // Same approach the web dApp uses (page.js) — without an explicit gas
      // limit, MetaMask Mobile's Multichain API bridge picks its own, far
      // more conservative default (observed ~0.03 tBNB vs. ~0.0001 tBNB for
      // the identical call from the web dApp, which always estimates and
      // caps it itself). 30% buffer over the raw estimate matches the web
      // dApp's own margin; the 360,000 fallback matches its estimateGas()
      // failure fallback too (one file per mobile upload, vs. its
      // per-file × count for batched uploads).
      setStatus('Estimating gas...');
      let gasLimit;
      try {
        const estimatedGasHex = await invokeMethod({ method: 'eth_estimateGas', params: [txParams] });
        gasLimit = (BigInt(estimatedGasHex) * 130n) / 100n;
      } catch (gasErr) {
        console.warn('Gas estimation failed, using safety fallback:', gasErr);
        gasLimit = 360000n;
      }

      setStatus('Submitting on-chain registration...');
      const txHash = await invokeMethod({
        method: 'eth_sendTransaction',
        params: [{ ...txParams, gas: ethers.toBeHex(gasLimit) }],
      });

      setStatus(`✅ Uploaded — tx ${txHash.slice(0, 14)}...`);
    } catch (err) {
      console.error('Upload failed:', err);
      setStatus(`❌ ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
      <Text style={styles.title}>Sovereign Data Storage</Text>
      <Text style={styles.subtitle}>Encrypted client-side. Split before it leaves your device.</Text>

      <View style={styles.card}>
        <View style={styles.statusHeader}>
          <StatusDot active={isConnected} />
          <Text style={styles.cardLabel}>WALLET STATUS</Text>
        </View>
        {isConnected ? (
          <>
            <Text style={styles.cardValue}>{address?.slice(0, 6)}...{address?.slice(-4)}</Text>
            <Text style={styles.cardSub}>
              {chainId === 97 ? 'BNB Chain Testnet ✓' : `Wrong network (chain ${chainId}) — switch to BNB Testnet`}
            </Text>
          </>
        ) : (
          <GradientButton
            title={connecting ? 'Connecting...' : 'Connect Wallet'}
            onPress={connect}
            loading={connecting}
            style={{ marginTop: spacing.md }}
          />
        )}
      </View>

      <View style={styles.row}>
        <StatTile label="Files Stored" value="—" style={{ marginRight: spacing.sm }} />
        <StatTile label="Watcher Uptime" value="—" style={{ marginLeft: spacing.sm }} />
      </View>

      {isConnected && (
        <TextInput
          style={styles.passkeyInput}
          placeholder="Encryption passkey (never leaves your device)"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={passkey}
          onChangeText={setPasskey}
        />
      )}

      <GradientButton
        title="+ Upload a File"
        onPress={handleUpload}
        disabled={!isConnected}
        loading={isUploading}
        style={styles.uploadButton}
      />
      {!!status && <Text style={styles.statusText}>{status}</Text>}

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('NodeStatus')}>
          <Text style={styles.navButtonText}>Watcher Node →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('WalletBalance')}>
          <Text style={styles.navButtonText}>Wallet Balance →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + 8 },
  title: { fontSize: 26, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { fontSize: 13, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardLabel: { fontSize: 10, fontFamily: fonts.sansBold, color: colors.cyan, letterSpacing: 1.5 },
  cardValue: { fontSize: 18, fontFamily: fonts.monoBold, color: colors.textPrimary, marginTop: spacing.sm },
  cardSub: { fontSize: 11, fontFamily: fonts.sans, color: colors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', marginBottom: spacing.lg },
  passkeyInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  uploadButton: { marginBottom: spacing.sm },
  statusText: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginBottom: spacing.xl, fontFamily: fonts.mono },
  navRow: { flexDirection: 'row', justifyContent: 'space-between' },
  navButton: { paddingVertical: spacing.sm },
  navButtonText: { color: colors.cyan, fontFamily: fonts.sansBold, fontSize: 13 },
});