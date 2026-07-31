// src/screens/StorageDashboardScreen.js
//
// Home screen — mirrors the web dApp's "Network Home" + Dashboard blend:
// connection state, quick stats, and a real file upload flow (encrypt,
// shard, pin to IPFS via the existing dApp backend, register on-chain).

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { ethers } from 'ethers';
import { InayaKernel } from '@inaya-network/custody-sdk';
import { useWallet } from '../providers/WalletProvider';

// Same Custody address/ABI fragment the SDK and the web dApp both use.
const CUSTODY_ADDRESS = '0x7F5E6cF1353beEE4fc19FD46Dd6EaD0B3895a888';
const custodyInterface = new ethers.Interface([
  'function batchRegisterAssets(bytes32[] fileHashes, uint256[] fileSizes, string[] shardACIDs, string[] shardBCIDs) external',
]);

// Reuses the SAME /api/upload route the web dApp already calls to pin
// shards to Pinata — no separate mobile-specific pinning setup needed.
async function pinShardToIPFS(shardContent, filename, tag) {
  const res = await fetch('https://inayanetwork.com/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shard: shardContent, filename, tag }),
  });
  if (!res.ok) throw new Error(`Pinning failed for shard ${tag} (HTTP ${res.status})`);
  const data = await res.json();
  return data.cid ?? data.IpfsHash; // matches the response shape the web dApp's own upload flow expects
}

export default function StorageDashboardScreen({ navigation }) {
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
      // disperseAndSlice() needs .arrayBuffer(), .type, and .name — a plain
      // fetched Blob has the first two but not .name, so wrap it.
      const fileLike = {
        arrayBuffer: () => blob.arrayBuffer(),
        type: blob.type || picked.mimeType || 'application/octet-stream',
        name: picked.name,
      };

      const salt = InayaKernel.generateSecureSalt(16);
      const vaultKey = await InayaKernel.deriveVaultKey({ passkey, salt });
      const sharded = await InayaKernel.disperseAndSlice({ file: fileLike, encryptionKey: vaultKey });

      setStatus('Pinning shards to IPFS...');
      const [cidAlpha, cidBeta] = await Promise.all([
        pinShardToIPFS(sharded.shardAlpha, sharded.filename, 'Alpha'),
        pinShardToIPFS(sharded.shardBeta, sharded.filename, 'Beta'),
      ]);

      setStatus('Submitting on-chain registration...');
      const assetIdText = `${sharded.filename}-${Date.now()}`;
      const fileHash = ethers.id(assetIdText);
      const sizeBytes = picked.size ?? 0;

      const data = custodyInterface.encodeFunctionData('batchRegisterAssets', [
        [fileHash], [sizeBytes], [cidAlpha], [cidBeta],
      ]);
      const txHash = await invokeMethod({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: CUSTODY_ADDRESS, data }],
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
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Sovereign Data Storage</Text>
      <Text style={styles.subtitle}>Encrypted client-side. Split before it leaves your device.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>WALLET STATUS</Text>
        {isConnected ? (
          <>
            <Text style={styles.cardValue}>{address?.slice(0, 6)}...{address?.slice(-4)}</Text>
            <Text style={styles.cardSub}>
              {chainId === 97 ? 'BNB Chain Testnet ✓' : `Wrong network (chain ${chainId}) — switch to BNB Testnet`}
            </Text>
          </>
        ) : (
          <TouchableOpacity style={styles.connectButton} onPress={connect} disabled={connecting}>
            <Text style={styles.connectButtonText}>{connecting ? 'Connecting...' : 'Connect Wallet'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.row}>
        <View style={[styles.statCard, { marginRight: 8 }]}>
          <Text style={styles.statBig}>—</Text>
          <Text style={styles.statLabel}>Files Stored</Text>
        </View>
        <View style={[styles.statCard, { marginLeft: 8 }]}>
          <Text style={styles.statBig}>—</Text>
          <Text style={styles.statLabel}>Watcher Uptime</Text>
        </View>
      </View>

      {isConnected && (
        <TextInput
          style={styles.passkeyInput}
          placeholder="Encryption passkey (never leaves your device)"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={passkey}
          onChangeText={setPasskey}
        />
      )}

      <TouchableOpacity
        style={[styles.actionButton, !isConnected && styles.actionButtonDisabled]}
        disabled={!isConnected || isUploading}
        onPress={handleUpload}
      >
        {isUploading ? (
          <ActivityIndicator color="#0a0e14" />
        ) : (
          <Text style={styles.actionButtonText}>+ Upload a File</Text>
        )}
      </TouchableOpacity>
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
  root: { flex: 1, backgroundColor: '#0a0e14' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 8 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: '#111c33', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1c2a38', marginBottom: 16 },
  cardLabel: { fontSize: 10, color: '#22d3d0', fontWeight: '700', letterSpacing: 1.5 },
  cardValue: { fontSize: 18, color: '#fff', fontWeight: '700', marginTop: 6 },
  cardSub: { fontSize: 11, color: '#64748b', marginTop: 4 },
  connectButton: { backgroundColor: '#22d3d0', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  connectButtonText: { color: '#0a0e14', fontWeight: '800', fontSize: 13 },
  row: { flexDirection: 'row', marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#111c33', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1c2a38', alignItems: 'center' },
  statBig: { fontSize: 24, color: '#fff', fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#64748b', marginTop: 4 },
  actionButton: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  passkeyInput: { backgroundColor: '#111c33', borderWidth: 1, borderColor: '#1c2a38', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 13, marginBottom: 12 },
  statusText: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginBottom: 20, fontFamily: 'monospace' },
  actionButtonDisabled: { opacity: 0.4 },
  actionButtonText: { color: '#0a0e14', fontWeight: '800', fontSize: 13 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between' },
  navButton: { paddingVertical: 8 },
  navButtonText: { color: '#22d3d0', fontWeight: '700', fontSize: 13 },
});