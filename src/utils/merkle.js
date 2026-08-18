// src/utils/merkle.js
// Client-side chunking + Merkle tree helper for Inaya Proof of Storage — direct port of
// inaya-network-dapp/src/lib/merkle.js, kept algorithmically identical (same chunk size,
// same sorted-pair hashing) so a mobile-registered root is structurally interchangeable with
// a web-registered one and verifies against the same contracts/InayaProofRegistry.sol
// (OpenZeppelin's MerkleProof.sol) without modification. Duplicated rather than shared because
// this repo doesn't share source files with inaya-network-dapp anywhere else either (API_BASE,
// theme tokens, etc. are all duplicated the same way) — see that file's own header for the
// pre-mainnet note about swapping to merkletreejs + keccak256.

import { ethers } from 'ethers';

export const CHUNK_SIZE = 256 * 1024; // 256 KB

/**
 * Splits a ciphertext string into fixed-size chunks.
 * @param {string} cipherTextString
 * @returns {string[]} chunks, in order (this order = leaf order)
 */
export function chunkCipherText(cipherTextString) {
  const chunks = [];
  for (let i = 0; i < cipherTextString.length; i += CHUNK_SIZE) {
    chunks.push(cipherTextString.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

/** keccak256 hash of a single chunk -> Merkle leaf */
export function hashChunk(chunk) {
  return ethers.keccak256(ethers.toUtf8Bytes(chunk));
}

/**
 * Builds a Merkle tree from an array of leaf hashes (sorted-pair, OZ-compatible).
 * @param {string[]} leaves
 * @returns {{ root: string, layers: string[][] }}
 */
export function buildMerkleTree(leaves) {
  if (leaves.length === 0) throw new Error('Cannot build a Merkle tree with zero leaves');
  let level = leaves;
  const layers = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i]; // duplicate last if odd
      const pair = [left, right].sort();
      next.push(ethers.keccak256(ethers.concat(pair)));
    }
    layers.push(next);
    level = next;
  }
  return { root: level[0], layers };
}

/**
 * Convenience: full pipeline from raw ciphertext to { root, layers, leaves, chunks, chunkCount }.
 */
export function buildProofOfStoragePayload(cipherTextString) {
  const chunks = chunkCipherText(cipherTextString);
  const leaves = chunks.map(hashChunk);
  const { root, layers } = buildMerkleTree(leaves);
  return { chunks, leaves, root, layers, chunkCount: chunks.length };
}
