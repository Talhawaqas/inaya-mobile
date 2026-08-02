// src/screens/MyFilesScreen.js
//
// "My Files" — this device's local upload history (see useUploadsHistory.js
// for why this can only ever be per-device, not a real account-wide list:
// InayaCustody has no on-chain enumeration function at all).

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useUploadsHistory } from '../hooks/useUploadsHistory';
import { colors, spacing, radius, fonts, glassCard } from '../theme';
import BackgroundGlow from '../components/BackgroundGlow';
import { retrieveAndSaveFile } from '../utils/retrieveFile';

export default function MyFilesScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { uploads } = useUploadsHistory();
  const [passkey, setPasskey] = useState('');
  const [workingHash, setWorkingHash] = useState(null);
  const [status, setStatus] = useState('');

  async function handleDownload(fileHash, filename) {
    if (!passkey) { setStatus('Enter the passkey used to encrypt this file first.'); return; }
    setWorkingHash(fileHash);
    try {
      await retrieveAndSaveFile({ fileHash, passkey, suggestedFilename: filename, onStatus: setStatus });
    } catch (err) {
      console.error('Download failed:', err);
      setStatus(err.message);
    } finally {
      setWorkingHash(null);
    }
  }

  return (
    <View style={styles.root}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
        <Text style={styles.title}>My Files</Text>
        <Text style={styles.subtitle}>Files uploaded from this device.</Text>

        <TextInput
          style={styles.input}
          placeholder="Decryption passkey (needed to download)"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={passkey}
          onChangeText={setPasskey}
        />
        {!!status && <Text style={styles.statusText}>{status}</Text>}

        {uploads.length === 0 ? (
          <Text style={styles.hint}>No uploads yet on this device — files you upload will show up here.</Text>
        ) : (
          uploads.map((u) => (
            <View key={u.fileHash} style={styles.row}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.filename} numberOfLines={1}>{u.filename}</Text>
                <Text style={styles.meta}>{new Date(u.uploadedAt).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => handleDownload(u.fileHash, u.filename)}
                disabled={workingHash === u.fileHash}
              >
                <Text style={styles.downloadButtonText}>
                  {workingHash === u.fileHash ? 'Working...' : 'Download'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: 24, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { fontSize: 13, fontFamily: fonts.sans, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  statusText: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginBottom: spacing.md, fontFamily: fonts.mono },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, marginTop: spacing.lg },
  row: {
    ...glassCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  filename: { fontSize: 13, fontFamily: fonts.sansBold, color: colors.textPrimary },
  meta: { fontSize: 11, fontFamily: fonts.sans, color: colors.textMuted, marginTop: spacing.xs },
  downloadButton: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  downloadButtonText: { color: colors.cyan, fontFamily: fonts.sansBold, fontSize: 11 },
});
