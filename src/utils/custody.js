// src/utils/custody.js
//
// Shared Custody contract + IPFS pinning/fetching helpers, extracted out of
// StorageDashboardScreen.js so the Upload/Download/My Files screens (split
// apart for the V2 UI's dedicated action-grid routing) don't each duplicate
// the same contract wiring.

import { ethers } from 'ethers';

// Same Custody address/ABI fragment the SDK and the web dApp both use.
export const CUSTODY_ADDRESS = '0x7F5E6cF1353beEE4fc19FD46Dd6EaD0B3895a888';
export const custodyInterface = new ethers.Interface([
  'function batchRegisterAssets(bytes32[] fileHashes, uint256[] fileSizes, string[] shardACIDs, string[] shardBCIDs) external',
]);

// Same BNB Testnet RPC WalletProvider.js uses for the wallet bridge — reading
// assets(bytes32) is a plain view call, so retrieval deliberately uses its own
// plain ethers.JsonRpcProvider instead of going through the connected wallet
// at all. There's no private key on this device to construct an ethers.Wallet
// with (MetaMask Mobile holds it), and MetaMask Connect Multichain's
// invokeMethod requires an active session even for reads — a public RPC read
// needs neither.
export const RPC_URL = 'https://data-seed-prebsc-1-s1.binance.org:8545';
const CUSTODY_READ_ABI = ['function assets(bytes32) view returns (address owner, string shardACID, string shardBCID, uint256 timestamp)'];

export function getReadOnlyCustody() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.Contract(CUSTODY_ADDRESS, CUSTODY_READ_ABI, provider);
}

// Mirrors InayaKernel's own defaultFetchShard() — the pinning route
// (api/upload/route.js) stores { shard, element } as the pinned JSON, so
// retrieval reads back the same `.shard` field.
export async function fetchShardFromIPFS(cid) {
  const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  if (!res.ok) throw new Error(`Failed to fetch shard ${cid} (HTTP ${res.status})`);
  const json = await res.json();
  return json.shard;
}

export const MIME_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf', 'text/plain': 'txt' };

// Reuses the SAME /api/upload route the web dApp already calls to pin
// shards to Pinata — no separate mobile-specific pinning setup needed.
// Payload keys (encryptedShard/elementTag) must match src/app/api/upload/route.js
// exactly, same as the web dApp's own call in page.js — the route destructures
// those specific names, not shard/tag. www. avoids a redirect hop off the apex
// domain (inayanetwork.com -> www.inayanetwork.com).
export async function pinShardToIPFS(shardContent, filename, tag, walletAddress) {
  const res = await fetch('https://www.inayanetwork.com/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ encryptedShard: shardContent, filename, elementTag: tag, walletAddress }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || data.pinata || `Pinning failed for shard ${tag} (HTTP ${res.status})`);
  return data.IpfsHash;
}
