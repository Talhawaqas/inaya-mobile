// src/screens/UploadScreen.js
//
// Dedicated Upload route (split out of the old StorageDashboardScreen so
// the dashboard's action grid has a real destination for this tile) —
// encrypt, shard, pin to IPFS, anchor on-chain.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ethers } from 'ethers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InayaKernel } from '@inaya-network/custody-sdk';
import { useWallet } from '../providers/WalletProvider';
import { useUploadsHistory } from '../hooks/useUploadsHistory';
import { colors, spacing, radius, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import BackgroundGlow from '../components/BackgroundGlow';
import { CUSTODY_ADDRESS, custodyInterface, pinShardToIPFS } from '../utils/custody';
import { waitForReceipt } from '../utils/waitForReceipt';
import { qualifyViaUpload } from '../utils/watcherApi';
import { suspendAppLock, resumeAppLock } from '../utils/appLockSuspend';

export default function UploadScreen() {
  const tabBarHeight = useSafeAreaInsets().bottom;
  const { address, isConnected, invokeMethod } = useWallet();
  const { persistUpload } = useUploadsHistory();
  const [passkey, setPasskey] = useState('');
  const [status, setStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload() {
    if (!isConnected) return;
    if (!passkey) { setStatus('Enter a passkey first.'); return; }

    setIsUploading(true);
    try {
      setStatus('Picking a file...');
      // The native document picker backgrounds the app the same way the
      // Google sign-in browser / MetaMask requests do — without this,
      // AppLockGate re-locks mid-pick and unmounts this whole screen,
      // dropping the typed passkey and the pick itself. See appLockSuspend.js.
      suspendAppLock();
      let result;
      try {
        result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      } finally {
        resumeAppLock();
      }
      if (result.canceled || !result.assets?.[0]) { setStatus(''); setIsUploading(false); return; }
      const picked = result.assets[0];

      setStatus('Encrypting...');
      const blob = await (await fetch(picked.uri)).blob();
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

      // Previously this screen declared success the instant the tx was
      // merely SUBMITTED, before confirming it actually mined — a reverted
      // transaction would still show "Uploaded ✅". Waiting for the receipt
      // (StakingScreen.js already does this for its own on-chain actions)
      // fixes that and gives the Watcher Pioneer Program hook below a real
      // proof-of-success to report, not just a hopeful txHash.
      setStatus('Mining registration transaction...');
      await waitForReceipt(invokeMethod, txHash);

      setStatus(`Uploaded — tx ${txHash.slice(0, 14)}...`);
      await persistUpload({ fileHash, filename: sharded.filename, sizeBytes, uploadedAt: Date.now() });

      // Fire-and-forget: never blocks or breaks the upload flow above if
      // this fails, and the backend simply no-ops for wallets that aren't
      // enrolled in the program — see watcherPioneer.js's startSession.
      try {
        const result = await qualifyViaUpload(invokeMethod, address, txHash);
        if (result?.started) setStatus((prev) => `${prev} · Watcher session started 🎉`);
      } catch (watcherErr) {
        console.warn('Watcher Pioneer qualification skipped:', watcherErr?.message);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setStatus(`${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <View style={styles.root}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
        <Text style={styles.title}>Upload a File</Text>
        <Text style={styles.subtitle}>Encrypted client-side. Split before it leaves your device.</Text>

        {!isConnected ? (
          <Text style={styles.hint}>Connect your wallet from the Dashboard tab first.</Text>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Encryption passkey (never leaves your device)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={passkey}
              onChangeText={setPasskey}
            />
            <GradientButton
              title="+ Upload a File"
              onPress={handleUpload}
              disabled={!isConnected}
              loading={isUploading}
            />
          </>
        )}
        {!!status && <Text style={styles.statusText}>{status}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: 24, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { fontSize: 13, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
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
  statusText: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: spacing.lg, fontFamily: fonts.mono },
});
