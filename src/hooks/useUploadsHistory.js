// src/hooks/useUploadsHistory.js
//
// Per-wallet local upload history — this app has no backend file listing of
// its own, so "My Files" (and the dashboard's Storage Used widget) is only
// ever what this specific device has uploaded (mirrors the web dApp's own
// local getFilenameMapping() lookup, same idea). Extracted out of
// StorageDashboardScreen.js so both the new My Files screen and the
// dashboard's storage widget share one source of truth instead of each
// reading AsyncStorage independently.

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from '../providers/WalletProvider';

const UPLOADS_STORAGE_KEY_PREFIX = 'inaya_uploads_';

export function useUploadsHistory() {
  const { address } = useWallet();
  const [uploads, setUploads] = useState([]);

  useEffect(() => {
    if (!address) { setUploads([]); return; }
    AsyncStorage.getItem(UPLOADS_STORAGE_KEY_PREFIX + address.toLowerCase())
      .then((raw) => setUploads(raw ? JSON.parse(raw) : []))
      .catch(() => setUploads([]));
  }, [address]);

  const persistUpload = useCallback(async (entry) => {
    if (!address) return;
    setUploads((prev) => {
      const next = [entry, ...prev];
      AsyncStorage.setItem(UPLOADS_STORAGE_KEY_PREFIX + address.toLowerCase(), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [address]);

  const totalUsedBytes = uploads.reduce((sum, u) => sum + (u.sizeBytes || 0), 0);

  return { uploads, persistUpload, totalUsedBytes };
}
