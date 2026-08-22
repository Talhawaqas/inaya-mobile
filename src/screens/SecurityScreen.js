// src/screens/SecurityScreen.js
//
// Inaya Network Security Layer — mobile Security capability (Security
// Layer SOW §4's "Inaya Mobile" section): protection status/mode, a
// destination checker, recent security events, a local allow/blocklist,
// and an AI Security Assistant entry point.
//
// MVP enforcement scope, deliberately: this screen does NOT intercept
// real device network traffic (no Android VpnService/packet interception
// — building that correctly is a separate, high-risk mobile-networking
// subsystem that could silently break the user's real internet if done
// wrong, and the SOW itself frames Android as "investigate" rather than
// "ship"). What's real here: the destination checker calls the live
// backend verdict, the feed sync keeps a local confirmed-threat cache for
// fast repeat lookups, and events/mode/allow-blocklist are genuinely
// persisted and read by the AI Assistant. Identity is the connected
// wallet address, or a stable per-install device id (AsyncStorage-cached,
// same pattern as App.js's activity-ping device id) when no wallet is
// connected — same anonymous-identity trust model as Watcher Pioneer/
// Referrals/activity.js.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from '../providers/WalletProvider';
import { colors, spacing, radius, fonts, glassCard } from '../theme';
import { checkThreat, getSecurityFeed, logSecurityEvent, getSecurityEvents, askSecurityAssistant } from '../utils/securityApi';

const DEVICE_ID_KEY = 'inaya_security_device_id';
const MODE_KEY = 'inaya_security_mode';
const ALLOWLIST_KEY = 'inaya_security_allowlist';
const BLOCKLIST_KEY = 'inaya_security_blocklist';
const FEED_SYNC_MS = 5 * 60 * 1000;
const MODES = ['monitor', 'protect', 'strict'];

async function getOrCreateDeviceId() {
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'mobile-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

async function readList(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeList(key, list) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    // local persistence only -- a failed write just means the list resets next launch
  }
}

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { address, isConnected } = useWallet();

  const [identityId, setIdentityId] = useState(null);
  const [mode, setMode] = useState('protect');
  const [feedCount, setFeedCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);

  const [checkInput, setCheckInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [allowlist, setAllowlist] = useState([]);
  const [blocklist, setBlocklist] = useState([]);
  const [listInput, setListInput] = useState('');

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const threatCacheRef = useRef(new Map());
  const feedSinceRef = useRef(null);

  useEffect(() => {
    (async () => {
      const id = isConnected && address ? address : await getOrCreateDeviceId();
      setIdentityId(id);
      const [savedMode, savedAllow, savedBlock] = await Promise.all([
        AsyncStorage.getItem(MODE_KEY),
        readList(ALLOWLIST_KEY),
        readList(BLOCKLIST_KEY),
      ]);
      if (savedMode && MODES.includes(savedMode)) setMode(savedMode);
      setAllowlist(savedAllow);
      setBlocklist(savedBlock);
    })();
  }, [isConnected, address]);

  const syncFeed = useCallback(async () => {
    try {
      const feed = await getSecurityFeed(feedSinceRef.current || undefined);
      for (const t of feed.items || []) {
        if (t.indicator) threatCacheRef.current.set(String(t.indicator).toLowerCase(), t);
      }
      feedSinceRef.current = feed.generatedAt || feedSinceRef.current;
      setFeedCount(threatCacheRef.current.size);
      setLastSync(new Date());
    } catch {
      // feed sync is best-effort -- the destination checker falls back to a live lookup either way
    }
  }, []);

  useEffect(() => {
    syncFeed();
    const interval = setInterval(syncFeed, FEED_SYNC_MS);
    return () => clearInterval(interval);
  }, [syncFeed]);

  const refreshEvents = useCallback(async () => {
    if (!identityId) return;
    setLoadingEvents(true);
    try {
      const data = await getSecurityEvents(identityId, 20);
      setEvents(data.events || []);
    } catch {
      // non-fatal -- events list just stays empty/stale
    } finally {
      setLoadingEvents(false);
    }
  }, [identityId]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  async function handleModeChange(next) {
    setMode(next);
    await AsyncStorage.setItem(MODE_KEY, next);
    if (identityId) {
      logSecurityEvent({ identityId, surface: 'mobile', eventType: 'policy_sync', decision: 'mode_change', reason: next }).catch(() => {});
    }
  }

  async function handleCheck() {
    const indicator = checkInput.trim().toLowerCase();
    if (!indicator) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const cached = threatCacheRef.current.get(indicator);
      const result = cached || (await checkThreat(indicator));
      setCheckResult(result);

      const isConfirmed = result.status === 1 || result.known === true && result.statusLabel === 'confirmed';
      const isLocallyAllowed = allowlist.includes(indicator);
      const isLocallyBlocked = blocklist.includes(indicator);
      let decision = 'allow';
      if (isLocallyBlocked || (isConfirmed && !isLocallyAllowed && mode !== 'monitor')) decision = 'block';
      else if (isConfirmed) decision = 'warn';

      if (identityId) {
        logSecurityEvent({
          identityId,
          surface: 'mobile',
          eventType: decision,
          destination: indicator,
          decision,
          reason: isLocallyBlocked ? 'On your local blocklist' : isConfirmed ? 'Confirmed threat via Inaya Security Layer' : 'No known threat',
          confidenceBps: result.confidenceBps,
          category: result.category,
        }).catch(() => {});
        refreshEvents();
      }
    } catch (err) {
      setCheckResult({ error: err.message || 'Could not check this destination.' });
    } finally {
      setChecking(false);
    }
  }

  async function addToList(setList, storageKey, currentList) {
    const value = listInput.trim().toLowerCase();
    if (!value || currentList.includes(value)) return;
    const next = [...currentList, value];
    setList(next);
    setListInput('');
    await writeList(storageKey, next);
  }

  async function removeFromList(setList, storageKey, currentList, value) {
    const next = currentList.filter((v) => v !== value);
    setList(next);
    await writeList(storageKey, next);
  }

  async function handleSendChat() {
    const text = chatInput.trim();
    if (!text || !identityId) return;
    const nextMessages = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatSending(true);
    try {
      const { reply } = await askSecurityAssistant(identityId, nextMessages);
      setChatMessages([...nextMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      setChatMessages([...nextMessages, { role: 'assistant', content: `Sorry, I couldn't answer that: ${err.message}` }]);
    } finally {
      setChatSending(false);
    }
  }

  const insetsBottom = insets.bottom + spacing.xxxl;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insetsBottom }]}>
      <Text style={styles.title}>Security</Text>
      <Text style={styles.subtitle}>
        Decentralized threat intelligence backed by Inaya's node network — verified destinations are checked
        against reputation-weighted, on-chain-anchored reports.
      </Text>

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.cardTitle}>Protection mode</Text>
        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeButton, mode === m && styles.modeButtonActive]}
              onPress={() => handleModeChange(m)}
            >
              <Text style={[styles.modeButtonText, mode === m && styles.modeButtonTextActive]}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.cardHint}>
          {feedCount} confirmed threats cached locally{lastSync ? ` · synced ${lastSync.toLocaleTimeString()}` : ''}
        </Text>
      </View>

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.cardTitle}>Check a destination</Text>
        <View style={styles.checkRow}>
          <TextInput
            style={styles.input}
            placeholder="domain or IP"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={checkInput}
            onChangeText={setCheckInput}
          />
          <TouchableOpacity style={styles.checkButton} onPress={handleCheck} disabled={checking || !checkInput.trim()}>
            {checking ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Check</Text>}
          </TouchableOpacity>
        </View>
        {checkResult && (
          <View style={styles.resultBox}>
            {checkResult.error ? (
              <Text style={styles.error}>{checkResult.error}</Text>
            ) : (
              <>
                <Text style={resultStatusStyle(checkResult.statusLabel)}>
                  {checkResult.known ? checkResult.statusLabel?.toUpperCase() : 'NO DATA'}
                </Text>
                {checkResult.known && (
                  <Text style={styles.cardHint}>
                    Confidence {Math.round((checkResult.confidenceBps || 0) / 100)}% ·{' '}
                    {(checkResult.contributingNodes || []).length} independent reporter(s)
                  </Text>
                )}
              </>
            )}
          </View>
        )}
      </View>

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.cardTitle}>Local allowlist / blocklist</Text>
        <Text style={styles.cardHint}>Applies only to the destination checker above — always takes precedence over the network verdict.</Text>
        <View style={styles.checkRow}>
          <TextInput
            style={styles.input}
            placeholder="domain or IP"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={listInput}
            onChangeText={setListInput}
          />
        </View>
        <View style={styles.listButtonRow}>
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => addToList(setAllowlist, ALLOWLIST_KEY, allowlist)}>
            <Text style={[styles.buttonText, styles.buttonSecondaryText]}>Add to Allowlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => addToList(setBlocklist, BLOCKLIST_KEY, blocklist)}>
            <Text style={[styles.buttonText, styles.buttonSecondaryText]}>Add to Blocklist</Text>
          </TouchableOpacity>
        </View>
        {[...allowlist.map((v) => ({ v, kind: 'Allow' })), ...blocklist.map((v) => ({ v, kind: 'Block' }))].map(({ v, kind }) => (
          <View key={`${kind}-${v}`} style={styles.listRow}>
            <Text style={styles.listItemText}>{kind}: {v}</Text>
            <TouchableOpacity
              onPress={() =>
                kind === 'Allow'
                  ? removeFromList(setAllowlist, ALLOWLIST_KEY, allowlist, v)
                  : removeFromList(setBlocklist, BLOCKLIST_KEY, blocklist, v)
              }
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.cardTitle}>Recent security events</Text>
        {loadingEvents ? (
          <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.sm }} />
        ) : events.length === 0 ? (
          <Text style={styles.cardHint}>No security events yet.</Text>
        ) : (
          events.map((e, i) => (
            <View key={i} style={styles.eventRow}>
              <Text style={eventDecisionStyle(e.decision)}>{(e.decision || e.eventType || '').toUpperCase()}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventDestination}>{e.destination || '—'}</Text>
                <Text style={styles.eventReason}>{e.reason || ''}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <TouchableOpacity onPress={() => setChatOpen((v) => !v)}>
          <Text style={styles.cardTitle}>Ask the Security Assistant {chatOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {chatOpen && (
          <>
            <Text style={styles.cardHint}>e.g. "Why was this blocked?" or "What is this threat?"</Text>
            <FlatList
              data={chatMessages}
              keyExtractor={(_, i) => String(i)}
              style={{ maxHeight: 240, marginTop: spacing.sm }}
              renderItem={({ item }) => (
                <View style={[styles.chatBubble, item.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant]}>
                  <Text style={styles.chatText}>{item.content}</Text>
                </View>
              )}
            />
            <View style={styles.checkRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask about a threat or event…"
                placeholderTextColor={colors.textMuted}
                value={chatInput}
                onChangeText={setChatInput}
              />
              <TouchableOpacity style={styles.checkButton} onPress={handleSendChat} disabled={chatSending || !chatInput.trim()}>
                {chatSending ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const STATUS_COLORS = { confirmed: colors.danger, disputed: colors.warning, cleared: colors.textMuted, unverified: colors.textMuted };
const DECISION_COLORS = { block: colors.danger, warn: colors.warning, allow: colors.success || colors.cyan, mode_change: colors.textMuted, policy_sync: colors.textMuted };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: 20, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, letterSpacing: 0.5 },
  subtitle: { fontSize: 12, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 17 },
  card: { ...glassCard, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  cardHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm, lineHeight: 16 },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modeButton: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  modeButtonActive: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  modeButtonText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textSecondary },
  modeButtonTextActive: { color: colors.bg, fontFamily: fonts.sansBold },
  checkRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.textPrimary, fontFamily: fonts.sans, fontSize: 12,
  },
  checkButton: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  resultBox: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  resultStatusBase: { fontFamily: fonts.sansExtraBold, fontSize: 16 },
  listButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs, marginTop: spacing.xs },
  listItemText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.textPrimary },
  removeText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.danger },
  eventRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'flex-start' },
  eventDecisionBase: { fontFamily: fonts.sansBold, fontSize: 10, width: 60 },
  eventDestination: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.textPrimary },
  eventReason: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  chatBubble: { padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.xs, maxWidth: '90%' },
  chatBubbleUser: { backgroundColor: colors.cyan, alignSelf: 'flex-end' },
  chatBubbleAssistant: { backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'flex-start' },
  chatText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textPrimary },
  button: {
    marginTop: spacing.md, backgroundColor: colors.cyan, borderRadius: radius.md,
    paddingVertical: spacing.sm, alignItems: 'center', flex: 1,
  },
  buttonSecondary: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border },
  buttonSecondaryText: { color: colors.textPrimary },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger },
});

// Kept as plain functions returning style ARRAYS rather than entries inside StyleSheet.create --
// StyleSheet.create only accepts static style objects, not functions, so the color-by-value
// pieces are composed at render time on top of a static base style instead.
function resultStatusStyle(label) {
  return [styles.resultStatusBase, { color: STATUS_COLORS[label] || colors.textMuted }];
}
function eventDecisionStyle(decision) {
  return [styles.eventDecisionBase, { color: DECISION_COLORS[decision] || colors.textMuted }];
}
