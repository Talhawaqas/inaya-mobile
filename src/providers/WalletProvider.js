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
import { ethers } from 'ethers';
import { suspendAppLock, resumeAppLock } from '../utils/appLockSuspend';

const BNB_TESTNET_SCOPE = 'eip155:97';
const BNB_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545';

// Same params the web dApp already uses successfully (page.js's
// ensureCorrectNetwork()) — kept in sync deliberately, not re-derived.
// Requesting a session for eip155:97 (client.connect() below) only asks
// MetaMask to GRANT that scope if the wallet already knows about it; it
// does NOT add the network to a wallet that's never seen BSC Testnet
// before, which is exactly what users were getting stuck on. This is what
// wallet_addEthereumChain is for.
const BSC_TESTNET_PARAMS = {
  chainId: '0x61',
  chainName: 'BNB Smart Chain Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: ['https://rpc.ankr.com/bsc_testnet', 'https://data-seed-prebsc-1-s1.binance.org:8545/'],
  blockExplorerUrls: ['https://testnet.bscscan.com'],
};

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

// wallet_switchEthereumChain / wallet_addEthereumChain go through
// connect-multichain's EIP1193_PASSTHROUGH_METHODS — the exact same
// forwarding path already used for personal_sign/eth_sendTransaction below,
// confirmed against the installed package's own source, not assumed. A
// 4902 error code is the wallet's documented way of saying "I don't have
// that chain configured" (see connect-multichain's own error classifier,
// which has a dedicated "unrecognized_chain" bucket for it) — that's the
// exact signal to fall back to wallet_addEthereumChain.
async function ensureBscTestnet(client) {
  try {
    await client.invokeMethod({
      scope: BNB_TESTNET_SCOPE,
      request: { method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_TESTNET_PARAMS.chainId }] },
    });
  } catch (switchErr) {
    if (switchErr?.code === 4902) {
      await client.invokeMethod({
        scope: BNB_TESTNET_SCOPE,
        request: { method: 'wallet_addEthereumChain', params: [BSC_TESTNET_PARAMS] },
      });
    } else {
      throw switchErr;
    }
  }
}

// Same wording the web dApp's handleWeb3SignUp() uses (page.js) — a plain
// wallet_sign, no server round-trip. Node "sign-up" is proof of wallet
// ownership only, not a capacity/heartbeat registration.
function buildVerificationMessage(address) {
  return `[INAYA CUSTODY NETWORK - NODE REGISTRATION]\n\nAuthorize client-side encrypted data fragmentation access routines for this host station.\n\nNode Index: ${address.toLowerCase()}\nTimestamp Hash: ${Date.now()}`;
}

export function WalletProviderRoot({ children }) {
  const clientRef = useRef(null);
  const [session, setSession] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

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

  const [networkError, setNetworkError] = useState('');

  const connect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    setConnecting(true);
    setNetworkError('');
    // Every step below hands off to the MetaMask app via deep link, which
    // backgrounds Inaya the same way actually leaving it would — without
    // this, App.js's AppLockGate re-locks the instant MetaMask opens and
    // unmounts the whole app tree mid-request, which can orphan the
    // in-flight request itself (MetaMask reporting "Request failed") on
    // top of dropping the user back on Home once they unlock again. See
    // appLockSuspend.js's header comment; this is the same fix already
    // applied to Google sign-in, now covering every wallet interaction
    // centrally instead of per-screen.
    suspendAppLock();
    try {
      await client.connect([BNB_TESTNET_SCOPE], []);
      const newSession = await client.provider.getSession();
      setSession(newSession);

      // Best-effort: the connection itself already succeeded above, so a
      // failure here shouldn't undo that or block the user — just surface
      // it so the UI can point them at manually switching if this ever
      // doesn't work (e.g. the user dismisses MetaMask's own prompt).
      try {
        await ensureBscTestnet(client);
      } catch (networkErr) {
        console.warn('Could not auto-switch/add BNB Chain Testnet:', networkErr);
        setNetworkError('Please switch your wallet to BNB Chain Testnet to continue.');
      }
    } finally {
      setConnecting(false);
      resumeAppLock();
    }
  }, []);

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    await client.disconnect();
    setSession(null);
    setIsSignedUp(false);
  }, []);

  const invokeMethod = useCallback(async (request) => {
    const client = clientRef.current;
    if (!client) throw new Error('Wallet client not ready yet.');
    // Same reasoning as connect() above — this is the shared path every
    // screen uses for personal_sign/eth_sendTransaction/etc, all of which
    // open MetaMask via deep link.
    suspendAppLock();
    try {
      return await client.invokeMethod({ scope: BNB_TESTNET_SCOPE, request });
    } finally {
      resumeAppLock();
    }
  }, []);

  // Mirrors the web dApp's handleWeb3SignUp() (page.js) — signs a
  // verification message with the connected wallet via personal_sign.
  // Purely local proof-of-ownership; no backend call, no persistence
  // across app restarts, matching the web dApp's own (non-persisted)
  // isSignedUp behavior.
  const signUp = useCallback(async () => {
    const client = clientRef.current;
    const accounts = session?.sessionScopes?.[BNB_TESTNET_SCOPE]?.accounts ?? [];
    const signAddress = accounts[0] ? accounts[0].split(':').pop() : null;
    if (!client || !signAddress) throw new Error('Connect a wallet first.');

    setIsSigning(true);
    suspendAppLock(); // same deep-link-backgrounds-the-app reasoning as connect()/invokeMethod() above
    try {
      const message = buildVerificationMessage(signAddress);
      await client.invokeMethod({
        scope: BNB_TESTNET_SCOPE,
        request: {
          method: 'personal_sign',
          params: [ethers.hexlify(ethers.toUtf8Bytes(message)), signAddress],
        },
      });
      setIsSignedUp(true);
    } finally {
      setIsSigning(false);
      resumeAppLock();
    }
  }, [session]);

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
    isSignedUp,
    isSigning,
    signUp,
    networkError,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Replaces Reown's useAppKit()/useAccount() with one combined hook. */
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProviderRoot.');
  return ctx;
}