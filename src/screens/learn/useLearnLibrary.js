// src/screens/learn/useLearnLibrary.js
//
// Shared local-first saved/progress state for Inaya Learn. AsyncStorage is
// the source of truth for anonymous use (no wallet needed) — same
// read-on-mount/write-through pattern ReferralScreen.js uses for its
// resume feature. When a wallet is connected (useWallet(), already used
// throughout this app), state also syncs to the backend
// (src/utils/learnApi.js) keyed by wallet address — same trust model as
// Faucet/Referrals/Watcher Pioneer (client-provided address, no
// signature/session required for this feature).
//
// On connect, local and backend state are merged (union by videoId,
// backend wins on conflict) once per wallet, and any locally-only entries
// are pushed up so nothing saved anonymously is lost once a wallet
// connects.

import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from '../../providers/WalletProvider';
import {
  listSavedLearnVideos,
  listLearnProgress,
  saveLearnVideo,
  unsaveLearnVideo,
  saveLearnProgress,
} from '../../utils/learnApi';

const SAVED_KEY = 'inaya_learn_saved';
const PROGRESS_KEY = 'inaya_learn_progress';

async function readLocal(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeLocal(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort — local cache write failing shouldn't break the UI
  }
}

function mergeByVideoId(local, remote) {
  const map = new Map(local.map((v) => [v.videoId, v]));
  for (const r of remote) map.set(r.videoId, r); // backend wins on conflict
  return [...map.values()];
}

export function useLearnLibrary() {
  const { address, isConnected } = useWallet();
  const [saved, setSaved] = useState([]);
  const [progress, setProgress] = useState([]);
  const [ready, setReady] = useState(false);
  const mergedForWallet = useRef(null);

  useEffect(() => {
    (async () => {
      const [localSaved, localProgress] = await Promise.all([readLocal(SAVED_KEY), readLocal(PROGRESS_KEY)]);
      setSaved(localSaved);
      setProgress(localProgress);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready || !isConnected || !address) return;
    if (mergedForWallet.current === address) return;
    mergedForWallet.current = address;

    (async () => {
      try {
        const [localSaved, localProgress, remoteSavedRes, remoteProgressRes] = await Promise.all([
          readLocal(SAVED_KEY),
          readLocal(PROGRESS_KEY),
          listSavedLearnVideos(address),
          listLearnProgress(address),
        ]);
        const remoteSaved = remoteSavedRes.items || [];
        const remoteProgress = remoteProgressRes.items || [];

        const mergedSaved = mergeByVideoId(localSaved, remoteSaved);
        const mergedProgress = mergeByVideoId(localProgress, remoteProgress);
        setSaved(mergedSaved);
        setProgress(mergedProgress);
        writeLocal(SAVED_KEY, mergedSaved);
        writeLocal(PROGRESS_KEY, mergedProgress);

        const remoteSavedIds = new Set(remoteSaved.map((r) => r.videoId));
        for (const item of localSaved) {
          if (!remoteSavedIds.has(item.videoId)) {
            saveLearnVideo({ walletAddress: address, ...item }).catch(() => {});
          }
        }
      } catch {
        // Offline or backend hiccup — local state remains authoritative for this session.
      }
    })();
  }, [ready, isConnected, address]);

  const isVideoSaved = useCallback((videoId) => saved.some((v) => v.videoId === videoId), [saved]);

  const getVideoProgress = useCallback((videoId) => progress.find((p) => p.videoId === videoId) || null, [progress]);

  const toggleSave = useCallback(async (video) => {
    const alreadySaved = saved.some((v) => v.videoId === video.videoId);
    const next = alreadySaved ? saved.filter((v) => v.videoId !== video.videoId) : [{ ...video, savedAt: new Date().toISOString() }, ...saved];
    setSaved(next);
    writeLocal(SAVED_KEY, next);

    if (isConnected && address) {
      try {
        if (alreadySaved) {
          await unsaveLearnVideo({ walletAddress: address, videoId: video.videoId });
        } else {
          await saveLearnVideo({ walletAddress: address, ...video });
        }
      } catch {
        // Local state already updated — backend sync can retry on next merge.
      }
    }
    return !alreadySaved;
  }, [saved, isConnected, address]);

  const updateProgress = useCallback(async (entry) => {
    const next = [{ ...entry, updatedAt: new Date().toISOString() }, ...progress.filter((p) => p.videoId !== entry.videoId)];
    setProgress(next);
    writeLocal(PROGRESS_KEY, next);

    if (isConnected && address) {
      saveLearnProgress({ walletAddress: address, ...entry }).catch(() => {});
    }
  }, [progress, isConnected, address]);

  return { ready, saved, progress, isVideoSaved, getVideoProgress, toggleSave, updateProgress, walletAddress: address };
}
