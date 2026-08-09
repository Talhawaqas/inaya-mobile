// src/screens/business/DocumentDetailScreen.js
//
// Document detail for the mobile Business Workspace, scoped per the SOW's
// mobile section: access level, permissions (view only — no editing on
// mobile this pass), open/decrypt, and sharing (generate/list/revoke).
// Deliberately no upload, no permission editing, no workflow actions
// (approve/reject/etc.) — those stay web-only administration for now.
//
// Decrypt reuses the exact same client-side pipeline as the existing
// Download/My Files screens (retrieveFile.js): fetch both encrypted shards
// from IPFS, then InayaKernel.reconstructAndDecrypt({shardAlpha, shardBeta,
// passkey}) — the custody-sdk's pure-JS implementation, verified
// byte-identical to WebCrypto (see the earlier research this session did
// before finding this package already solved on-device decryption). The
// only difference from retrieveFile.js is where the CIDs come from: a
// MongoDB-backed, permission-checked /retrieve endpoint here, not an
// on-chain custody.assets() lookup — org documents aren't looked up by
// fileHash the way personal wallet uploads are.

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { InayaKernel } from '@inaya-network/custody-sdk';
import { colors, spacing, radius, fonts, glassCard } from '../../theme';
import { orgFetch } from '../../utils/orgApi';
import { fetchShardFromIPFS } from '../../utils/custody';

const SHARE_PRESETS = ['1h', '24h', '7d', '30d'];

export default function DocumentDetailScreen({ route, navigation }) {
  const { orgId, documentId, filename } = route.params;
  const insets = useSafeAreaInsets();

  const [meta, setMeta] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [passkey, setPasskey] = useState('');
  const [opening, setOpening] = useState(false);
  const [openStatus, setOpenStatus] = useState('');
  const [openError, setOpenError] = useState('');

  const [permissions, setPermissions] = useState(null);
  const [permissionsError, setPermissionsError] = useState('');

  const [shares, setShares] = useState(null);
  const [sharesError, setSharesError] = useState('');
  const [creatingShare, setCreatingShare] = useState(false);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    setMetaError('');
    try {
      const data = await orgFetch(`/api/orgs/documents/${documentId}/retrieve?orgId=${orgId}`);
      setMeta(data);
    } catch (err) {
      setMetaError(err.message || 'Could not load this document.');
    } finally {
      setLoadingMeta(false);
    }
  }, [orgId, documentId]);

  const loadPermissions = useCallback(async () => {
    try {
      const data = await orgFetch(`/api/orgs/documents/${documentId}/permissions?orgId=${orgId}`);
      setPermissions(data);
    } catch (err) {
      setPermissionsError(err.message || '');
    }
  }, [orgId, documentId]);

  const loadShares = useCallback(async () => {
    try {
      const data = await orgFetch(`/api/orgs/documents/${documentId}/shares?orgId=${orgId}`);
      setShares(data.shares || []);
    } catch (err) {
      setSharesError(err.message || '');
    }
  }, [orgId, documentId]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { navigation.setOptions({ title: filename }); }, [navigation, filename]);

  const canManage = meta?.yourAccessLevel === 'MANAGE';
  useEffect(() => {
    if (canManage) {
      loadPermissions();
      loadShares();
    }
  }, [canManage, loadPermissions, loadShares]);

  async function handleOpen() {
    if (!passkey) return;
    setOpening(true);
    setOpenError('');
    try {
      setOpenStatus('Fetching encrypted shards...');
      const [shardAlpha, shardBeta] = await Promise.all([
        fetchShardFromIPFS(meta.cidAlpha),
        fetchShardFromIPFS(meta.cidBeta),
      ]);

      setOpenStatus('Decrypting...');
      const dataUrl = await InayaKernel.reconstructAndDecrypt({ shardAlpha, shardBeta, passkey });
      const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
      if (!match) throw new Error('Unexpected decrypted data format.');
      const [, mimeType, base64Data] = match;

      setOpenStatus('Saving to device...');
      const file = new File(Paths.cache, meta.filename || filename);
      file.create({ overwrite: true });
      file.write(base64Data, { encoding: 'base64' });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Save ${meta.filename || filename}` });
        setOpenStatus('Choose where to save the file.');
      } else {
        setOpenStatus(`Saved: ${file.uri}`);
      }
    } catch (err) {
      setOpenError('Wrong passkey, or the document could not be decrypted.');
      setOpenStatus('');
    } finally {
      setOpening(false);
    }
  }

  async function handleCreateShare(preset) {
    setCreatingShare(true);
    setSharesError('');
    try {
      const data = await orgFetch(`/api/orgs/documents/${documentId}/shares`, {
        method: 'POST',
        body: { orgId, expirationPreset: preset },
      });
      Share.share({ message: `Shared document link (expires ${new Date(data.expiresAt).toLocaleString()}): ${data.shareUrl}` });
      loadShares();
    } catch (err) {
      setSharesError(err.message || 'Could not create the share link.');
    } finally {
      setCreatingShare(false);
    }
  }

  async function handleRevokeShare(shareId) {
    try {
      await orgFetch(`/api/orgs/documents/${documentId}/shares/${shareId}/revoke`, { method: 'POST', body: { orgId } });
      loadShares();
    } catch (err) {
      setSharesError(err.message || 'Could not revoke the share.');
    }
  }

  if (loadingMeta) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  if (metaError) {
    return (
      <View style={[styles.root, styles.centered, { padding: spacing.xl }]}>
        <Text style={styles.error}>{metaError}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title} numberOfLines={2}>{meta.filename}</Text>
      <Text style={styles.subtitle}>
        {(meta.sizeBytes / 1024).toFixed(1)} KB · your access: {meta.yourAccessLevel}
      </Text>

      {/* OPEN / DECRYPT */}
      <View style={[styles.card, { marginTop: spacing.lg }]}>
        <Text style={styles.cardTitle}>Open document</Text>
        <Text style={styles.cardHint}>Enter the passkey this document was encrypted with to decrypt and save it to your device.</Text>
        <TextInput
          style={styles.input}
          value={passkey}
          onChangeText={setPasskey}
          placeholder="Passkey"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          editable={!opening}
        />
        <TouchableOpacity style={[styles.button, (opening || !passkey) && styles.buttonDisabled]} onPress={handleOpen} disabled={opening || !passkey}>
          {opening ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Decrypt & open</Text>}
        </TouchableOpacity>
        {openStatus ? <Text style={styles.statusText}>{openStatus}</Text> : null}
        {openError ? <Text style={styles.error}>{openError}</Text> : null}
      </View>

      {/* PERMISSIONS (view only, MANAGE-level access required by the backend) */}
      {canManage && (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={styles.cardTitle}>People with access</Text>
          {permissionsError ? <Text style={styles.error}>{permissionsError}</Text> : null}
          {permissions && (
            <>
              <View style={styles.permRow}>
                <Text style={styles.permEmail}>{permissions.owner}</Text>
                <Text style={styles.permLevel}>OWNER</Text>
              </View>
              {permissions.grants.map((g) => (
                <View key={g.email} style={styles.permRow}>
                  <Text style={styles.permEmail} numberOfLines={1}>{g.email}</Text>
                  <Text style={styles.permLevel}>{g.level}</Text>
                </View>
              ))}
              {permissions.grants.length === 0 && <Text style={styles.emptyText}>No additional explicit grants.</Text>}
            </>
          )}
        </View>
      )}

      {/* SHARING (MANAGE-level access required by the backend) */}
      {canManage && (
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={styles.cardTitle}>Secure sharing</Text>
          <Text style={styles.cardHint}>Generate a link that lets someone outside the company view this document without an account.</Text>
          <View style={styles.presetRow}>
            {SHARE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[styles.presetButton, creatingShare && styles.buttonDisabled]}
                onPress={() => handleCreateShare(preset)}
                disabled={creatingShare}
              >
                <Text style={styles.presetButtonText}>{preset}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {sharesError ? <Text style={styles.error}>{sharesError}</Text> : null}

          {shares && shares.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              {shares.map((s) => (
                <View key={s.shareId} style={styles.shareRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shareStatus}>{s.status.toUpperCase()}</Text>
                    <Text style={styles.shareMeta}>
                      expires {new Date(s.expiresAt).toLocaleDateString()} · used {s.useCount}{s.maxUses ? `/${s.maxUses}` : ''}
                    </Text>
                  </View>
                  {s.status === 'active' && (
                    <TouchableOpacity onPress={() => handleRevokeShare(s.shareId)}>
                      <Text style={styles.revokeText}>Revoke</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl },
  title: { fontSize: 17, fontFamily: fonts.sansExtraBold, color: colors.textPrimary },
  subtitle: { fontSize: 11, fontFamily: fonts.mono, color: colors.textMuted, marginTop: spacing.xs, textTransform: 'uppercase' },
  card: { ...glassCard, padding: spacing.lg },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  cardHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm, lineHeight: 16 },
  input: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  button: { marginTop: spacing.sm, backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.bg, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textSecondary, marginTop: spacing.sm },
  error: { fontFamily: fonts.sans, fontSize: 11, color: colors.danger, marginTop: spacing.sm },
  emptyText: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, fontStyle: 'italic' },
  permRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  permEmail: { flex: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.textPrimary },
  permLevel: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.cyan },
  presetRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  presetButton: {
    flex: 1, backgroundColor: 'rgba(0,242,254,0.1)', borderWidth: 1, borderColor: 'rgba(0,242,254,0.3)',
    borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center',
  },
  presetButtonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.cyan },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  shareStatus: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.textPrimary },
  shareMeta: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  revokeText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.danger },
});
