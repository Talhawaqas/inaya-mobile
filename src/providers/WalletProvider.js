// src/providers/WalletProvider.js
//
// Direct MetaMask connection via MetaMask Connect Multichain — no relay
// server, communicates directly with the MetaMask Mobile app via deeplink.
// This replaced an earlier Reown AppKit (WalletConnect) integration after
// persistent "couldn't load wallet" errors that dashboard configuration
// (Domain + App ID) didn't resolve.
//
// Configured for BNB Chain Testnet specifically (eip155:97) — NOT the
// Ethereum/Polygon/Solana multichain example in MetaMask's own docs, since
// Inaya Network only needs a single EVM testnet.

import { Buffer } from 'buffer';
import { Linking } from 'react-native';
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createMultichainClient } from '@metamask/connect-multichain';

const BNB_TESTNET_SCOPE = 'eip155:97';
const BNB_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = createMultichainClient({
      dapp: {
        name: 'Inaya Network',
        url: 'https://inayanetwork.com',
      },
      api: {
        // Manually specified RPC map instead of MetaMask's getInfuraRpcUrls()
        // helper — that helper needs a separate Infura account/API key we
        // don't have set up, and BNB Testnet isn't one of Infura's supported
        // networks anyway. This is the same shape that helper would produce:
        // a plain map of CAIP-2 chain ID -> RPC URL string.
        supportedNetworks: {
          [BNB_TESTNET_SCOPE]: BNB_TESTNET_RPC,
        },
      },
      mobile: {
        preferredOpenLink: (deeplink) => Linking.openURL(deeplink),
      },
    });
  }
  return clientPromise;
}

const WalletContext = createContext(null);

export function WalletProviderRoot({ children }) {
  const clientRef = useRef(null);
  const [session, setSession] = useState(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const client = await getClient();
      if (!mounted) return;
      clientRef.current = client;
      client.on('wallet_sessionChanged', (newSession) => {
        if (mounted) setSession(newSession);
      });
    })();
    return () => { mounted = false; };
  }, []);

  const connect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    setConnecting(true);
    try {
      await client.connect([BNB_TESTNET_SCOPE], []);
      const newSession = await client.provider.getSession();
      setSession(newSession);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    await client.disconnect();
    setSession(null);
  }, []);

  const invokeMethod = useCallback(async (request) => {
    const client = clientRef.current;
    if (!client) throw new Error('Wallet client not ready yet.');
    return client.invokeMethod({ scope: BNB_TESTNET_SCOPE, request });
  }, []);

  // Derive a simple, flat {address, isConnected, chainId} shape from the
  // raw multichain session — matches what the three screens already expect,
  // so they didn't need rewriting, just this provider swapped underneath.
  const accounts = session?.sessionScopes?.[BNB_TESTNET_SCOPE]?.accounts ?? [];
  const address = accounts[0] ? accounts[0].split(':').pop() : null;
  const isConnected = !!address;

  const value = {
    address,
    isConnected,
    chainId: 97,
    connecting,
    connect,
    disconnect,
    invokeMethod,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Replaces Reown's useAppKit()/useAccount() with one combined hook. */
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProviderRoot.');
  return ctx;
}