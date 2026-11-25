// src/utils/chunkedDocument.js
//
// Opens Business Workspace documents stored in the chunked large-file format ("inaya-chunked" v1, Nov 2026).
// MIRROR of the reading half of inaya-network-dapp/src/lib/chunkedFile.js: same key derivation
// (PBKDF2-SHA256, 100,000 rounds), same AES-256-GCM per piece with the same additional data
// ("inaya-chunked/1|<uploadId>|<index>|<count>"), same alpha/beta half split. React Native has no
// Web Crypto, so this uses the noble libraries the custody SDK already ships with.
//
// The retrieve endpoint returns `chunked: { alpha, beta }` (both manifests, every piece with a short-lived
// signed download link) for these documents; older documents keep the original two-shard format.
// Pieces are decrypted one at a time and appended to the output file, so a large file never has to fit in memory.

import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import { gcm } from '@noble/ciphers/aes';

const FORMAT = 'inaya-chunked';
const FORMAT_VERSION = 1;

const utf8 = (s) => new TextEncoder().encode(s);
function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const aad = (uploadId, index, count) => utf8(`${FORMAT}/${FORMAT_VERSION}|${uploadId}|${index}|${count}`);

function decryptPiece(key, blob, uploadId, index, count) {
  if (blob.length < 28) throw new Error('A piece of this file is damaged.');
  try {
    return gcm(key, blob.subarray(0, 12), aad(uploadId, index, count)).decrypt(blob.subarray(12));
  } catch {
    throw new Error(index < 0 ? 'Could not decrypt this document. Check the passkey and try again.' : 'A piece of this file failed its integrity check.');
  }
}

function checkPair(alpha, beta) {
  const ok = (m) => m && m.format === FORMAT && Array.isArray(m.pieces);
  if (!ok(alpha) || !ok(beta)) throw new Error("This file's storage records are not readable.");
  if (alpha.version !== FORMAT_VERSION || beta.version !== FORMAT_VERSION) throw new Error('This file was stored in a newer format. Update the app to open it.');
  if (alpha.uploadId !== beta.uploadId || alpha.count !== beta.count || alpha.salt !== beta.salt || alpha.role !== 'alpha' || beta.role !== 'beta') throw new Error("This file's storage records do not match.");
  if (alpha.pieces.length !== alpha.count || beta.pieces.length !== beta.count) throw new Error("This file's storage records are incomplete.");
}

async function download(piece) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(piece.url);
      if (!res.ok) throw new Error(`(${res.status})`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= 3) throw new Error(`A piece of this file could not be downloaded ${err.message}. Try again.`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

/** Decrypts a chunked document into `file` (an expo-file-system File). Returns { mimeType }. */
export async function openChunkedToFile({ alpha, beta, passkey, file, onProgress = () => {} }) {
  checkPair(alpha, beta);
  const { uploadId, count } = alpha;
  const key = await pbkdf2Async(sha256, utf8(passkey), fromBase64(alpha.salt), { c: 100000, dkLen: 32 });
  const meta = JSON.parse(new TextDecoder().decode(decryptPiece(key, fromBase64(alpha.header), uploadId, -1, count)));
  file.create({ overwrite: true });
  const handle = file.open();
  try {
    for (let i = 0; i < count; i++) {
      const [a, b] = await Promise.all([download(alpha.pieces[i]), download(beta.pieces[i])]);
      const blob = new Uint8Array(a.length + b.length);
      blob.set(a, 0); blob.set(b, a.length);
      handle.writeBytes(decryptPiece(key, blob, uploadId, i, count));
      onProgress({ done: i + 1, count });
    }
  } finally {
    handle.close();
  }
  return { mimeType: meta.type || 'application/octet-stream' };
}
