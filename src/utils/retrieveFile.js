// src/utils/retrieveFile.js
//
// The full retrieve-decrypt-save-share flow, shared by the Download screen
// (retrieve by pasted fileHash) and My Files screen (retrieve by tapping a
// known upload) — extracted so neither screen duplicates the same ~30 lines.

import { ethers } from 'ethers';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { InayaKernel } from '@inaya-network/custody-sdk';
import { getReadOnlyCustody, fetchShardFromIPFS, MIME_EXTENSIONS } from './custody';
import { suspendAppLock, resumeAppLock } from './appLockSuspend';

/**
 * Reads the on-chain record, fetches both encrypted shards from IPFS,
 * decrypts locally, writes the result to the device, then hands off to the
 * native share sheet — there's no browser download bar on mobile, so
 * "choose an app to save this to" is the real equivalent. Calls onStatus
 * with human-readable progress strings; throws on failure.
 */
export async function retrieveAndSaveFile({ fileHash, passkey, suggestedFilename, onStatus }) {
  onStatus?.('Reading on-chain record...');
  const custody = getReadOnlyCustody();
  const [owner, cidAlpha, cidBeta] = await custody.assets(fileHash);
  if (owner === ethers.ZeroAddress) throw new Error('No asset found on-chain for this file hash.');

  onStatus?.('Fetching encrypted shards...');
  const [shardAlpha, shardBeta] = await Promise.all([
    fetchShardFromIPFS(cidAlpha),
    fetchShardFromIPFS(cidBeta),
  ]);

  onStatus?.('Decrypting...');
  const dataUrl = await InayaKernel.reconstructAndDecrypt({ shardAlpha, shardBeta, passkey });

  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Unexpected decrypted data format.');
  const [, mimeType, base64Data] = match;
  const filename = suggestedFilename || `retrieved-${fileHash.slice(2, 10)}.${MIME_EXTENSIONS[mimeType] || 'bin'}`;

  onStatus?.('Saving to device...');
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(base64Data, { encoding: 'base64' });

  if (await Sharing.isAvailableAsync()) {
    // shareAsync's native "save/open with" sheet backgrounds the app —
    // same AppLockGate re-lock risk as UploadScreen.js's document picker.
    suspendAppLock();
    try {
      await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Save ${filename}` });
    } finally {
      resumeAppLock();
    }
    onStatus?.('Choose where to save the file.');
  } else {
    onStatus?.(`Saved: ${file.uri}`);
  }
}
