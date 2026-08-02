// src/screens/DownloadScreen.js
//
// Dedicated Download route — retrieve a file by its on-chain fileHash
// (for anything uploaded elsewhere, or from before this device tracked
// uploads locally). "My Files" is the one-tap version of this for files
// this device already knows about.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts } from '../theme';
import GradientButton from '../components/GradientButton';
import BackgroundGlow from '../components/BackgroundGlow';
import { retrieveAndSaveFile } from '../utils/retrieveFile';

export default function DownloadScreen() {
  const tabBarHeight = useSafeAreaInsets().bottom;
  const [fileHash, setFileHash] = useState('');
  const [passkey, setPasskey] = useState('');
  const [status, setStatus] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  async function handleRetrieve() {
    if (!fileHash || !passkey) return;
    setIsWorking(true);
    try {
      await retrieveAndSaveFile({ fileHash, passkey, onStatus: setStatus });
    } catch (err) {
      console.error('Download failed:', err);
      setStatus(err.message);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <View style={styles.root}>
      <BackgroundGlow />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + spacing.xl }]}>
        <Text style={styles.title}>Download</Text>
        <Text style={styles.subtitle}>Retrieve and decrypt a file by its on-chain file hash.</Text>

        <TextInput
          style={styles.input}
          placeholder="0x... file hash"
          placeholderTextColor={colors.textMuted}
          value={fileHash}
          onChangeText={setFileHash}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Decryption passkey"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={passkey}
          onChangeText={setPasskey}
        />
        <GradientButton
          title="Retrieve & Download"
          onPress={handleRetrieve}
          disabled={!fileHash || !passkey || isWorking}
          loading={isWorking}
        />
        {!!status && <Text style={styles.statusText}>{status}</Text>}
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
  statusText: { color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: spacing.lg, fontFamily: fonts.mono },
});
