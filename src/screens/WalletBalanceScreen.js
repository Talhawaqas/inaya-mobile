// src/screens/WalletBalanceScreen.js
//
// Read-only balance display — pulls INAYA/USDT/tBNB balances for the
// connected wallet. No signing happens here; this screen only ever reads.
//
// Uses invokeMethod() (raw JSON-RPC via MetaMask Connect Multichain)
// instead of an ethers provider object — that architecture doesn't expose
// one directly. ethers.Interface is still used, but purely for encoding/
// decoding function calls locally, not for network access.

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { ethers } from 'ethers';
import { useWallet } from '../providers/WalletProvider';

const INAYA_TOKEN_ADDRESS = '0x3966a3378c8d9e6bb34dd0b8458eef4b878ce94e';
const USDT_TOKEN_ADDRESS = '0x6f16E2d169B5F2c7141c2b46dD864f8daE01745D';
const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];
const erc20Interface = new ethers.Interface(ERC20_BALANCE_ABI);

async function readTokenBalance(invokeMethod, tokenAddress, address) {
  const data = erc20Interface.encodeFunctionData('balanceOf', [address]);
  const result = await invokeMethod({
    method: 'eth_call',
    params: [{ to: tokenAddress, data }, 'latest'],
  });
  const [balance] = erc20Interface.decodeFunctionResult('balanceOf', result);
  return balance;
}

export default function WalletBalanceScreen() {
  const { address, isConnected, invokeMethod } = useWallet();
  const [balances, setBalances] = useState({ bnb: null, inaya: null, usdt: null });
  const [refreshing, setRefreshing] = useState(false);

  const fetchBalances = async () => {
    if (!isConnected || !address) return;
    setRefreshing(true);
    try {
      const [bnbHex, inaya, usdt] = await Promise.all([
        invokeMethod({ method: 'eth_getBalance', params: [address, 'latest'] }),
        readTokenBalance(invokeMethod, INAYA_TOKEN_ADDRESS, address),
        readTokenBalance(invokeMethod, USDT_TOKEN_ADDRESS, address),
      ]);
      setBalances({
        bnb: parseFloat(ethers.formatEther(BigInt(bnbHex))).toFixed(4),
        inaya: parseFloat(ethers.formatUnits(inaya, 18)).toFixed(2),
        usdt: parseFloat(ethers.formatUnits(usdt, 18)).toFixed(2),
      });
    } catch (err) {
      console.error('Balance fetch failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBalances(); }, [isConnected, address]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchBalances} tintColor="#22d3d0" />}
    >
      <Text style={styles.title}>Wallet Balance</Text>
      <Text style={styles.subtitle}>Read-only — no signing happens on this screen.</Text>

      {!isConnected ? (
        <View style={styles.card}>
          <Text style={styles.cardSub}>Connect a wallet from the Storage Dashboard to see balances here.</Text>
        </View>
      ) : (
        <>
          <BalanceRow label="tBNB (gas)" value={balances.bnb} />
          <BalanceRow label="INAYA" value={balances.inaya} />
          <BalanceRow label="mUSDT" value={balances.usdt} />
        </>
      )}
    </ScrollView>
  );
}

function BalanceRow({ label, value }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.cardValue}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0e14' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 8 },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: '#111c33', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1c2a38', marginBottom: 12 },
  cardLabel: { fontSize: 10, color: '#22d3d0', fontWeight: '700', letterSpacing: 1.5 },
  cardValue: { fontSize: 22, color: '#fff', fontWeight: '800', marginTop: 6 },
  cardSub: { fontSize: 12, color: '#64748b', lineHeight: 18 },
});