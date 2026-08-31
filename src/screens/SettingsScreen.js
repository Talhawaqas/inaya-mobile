// src/screens/SettingsScreen.js
//
// App-level settings, reachable from the main drawer without needing a
// Business Workspace session — the biometric app-unlock toggle, and the
// User-Controlled Master Node Passkey Backup & Recovery section. It used
// to live inside Business Workspace's OrgHomeScreen, but the gate it
// controls (App.js's AppLockGate) has always applied to the WHOLE app,
// not just that section, so requiring a Workspace sign-in just to turn
// it on was a mismatch — moved here per user feedback so anyone can
// enable it regardless of whether they use Business Workspace at all.

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { createPasskeyBackup, restorePasskeyBackup, isPasskeyBackupEnvelope } from '@inaya-network/custody-sdk';
import { colors, spacing, radius, fonts, glassCard, THEMES, THEME_LABELS } from '../theme';
import { useTheme } from '../providers/ThemeProvider';
import { isBiometricAvailable, getBiometricEnabled, setBiometricEnabled } from '../utils/biometric';
import { setStoredPasskey, getStoredPasskey, clearStoredPasskey, hasStoredPasskey } from '../utils/passkeyStorage';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, setTheme } = useTheme();

  // Hidden entirely on a device with no Face ID/fingerprint enrolled —
  // never show a toggle for a capability that isn't there.
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [checking, setChecking] = useState(true);

  // ========================================================
  // 🔐 MASTER NODE PASSKEY — BACKUP & RECOVERY (User-Controlled Key
  // Recovery). Every crypto operation runs through custody-sdk's
  // createPasskeyBackup()/restorePasskeyBackup() — pure local crypto,
  // zero network calls on any path. The Create flow shares the resulting
  // .inayakey file out via the OS share sheet (Sharing.shareAsync) rather
  // than uploading it anywhere — the user picks where it goes (Files,
  // Drive, AirDrop, etc.), same "never auto-uploaded" guarantee as the
  // web app's Blob download.
  // ========================================================
  const [passkeyInput, setPasskeyInput] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [backupConfirmPassword, setBackupConfirmPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [pickedBackupFile, setPickedBackupFile] = useState(null); // { name, content }
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupMessageIsError, setBackupMessageIsError] = useState(false);
  const [storedPasskeyPresent, setStoredPasskeyPresent] = useState(false);
  const [secureStorageMessage, setSecureStorageMessage] = useState('');

  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);
      if (available) setBiometricEnabledState(await getBiometricEnabled());
      setChecking(false);
      setStoredPasskeyPresent(await hasStoredPasskey());
    })();
  }, []);

  async function toggleBiometric(value) {
    setBiometricEnabledState(value);
    await setBiometricEnabled(value);
  }

  async function handleCreateBackup() {
    setBackupMessage('');
    setBackupMessageIsError(false);
    if (!passkeyInput) {
      setBackupMessage('Enter the Master Node Passkey you want to back up.');
      setBackupMessageIsError(true);
      return;
    }
    if (backupPassword.length < 8) {
      setBackupMessage('Backup password must be at least 8 characters.');
      setBackupMessageIsError(true);
      return;
    }
    if (backupPassword !== backupConfirmPassword) {
      setBackupMessage("Passwords don't match.");
      setBackupMessageIsError(true);
      return;
    }
    setBackupBusy(true);
    try {
      const blob = await createPasskeyBackup(passkeyInput, backupPassword);
      const fileUri = FileSystem.cacheDirectory + `inaya-passkey-backup-${Date.now()}.inayakey`;
      await FileSystem.writeAsStringAsync(fileUri, blob, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/octet-stream', dialogTitle: 'Save your encrypted passkey backup' });
      }
      setBackupPassword('');
      setBackupConfirmPassword('');
      setBackupMessage('Encrypted backup created. Save it somewhere only you control — Inaya never received a copy.');
    } catch (err) {
      setBackupMessage(err.message || 'Could not create the backup.');
      setBackupMessageIsError(true);
    } finally {
      setBackupBusy(false);
    }
  }

  async function handlePickRestoreFile() {
    setBackupMessage('');
    setBackupMessageIsError(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      // Fast, friendly rejection of an obviously-wrong file before ever
      // asking for the backup password.
      if (!isPasskeyBackupEnvelope(content)) {
        setBackupMessage("This doesn't look like an Inaya passkey backup file.");
        setBackupMessageIsError(true);
        setPickedBackupFile(null);
        return;
      }
      setPickedBackupFile({ name: asset.name, content });
    } catch {
      setBackupMessage('Could not read that file.');
      setBackupMessageIsError(true);
    }
  }

  async function handleRestoreBackup() {
    setBackupMessage('');
    setBackupMessageIsError(false);
    if (!pickedBackupFile) {
      setBackupMessage('Select an encrypted backup file first.');
      setBackupMessageIsError(true);
      return;
    }
    setBackupBusy(true);
    try {
      // Throws with the exact "Unable to decrypt backup. Your recovery
      // password may be incorrect." message on a wrong password or a
      // corrupted/tampered file — rendered as err.message below, no
      // re-mapping needed.
      const recovered = await restorePasskeyBackup(pickedBackupFile.content, restorePassword);
      await setStoredPasskey(recovered);
      setStoredPasskeyPresent(true);
      setPasskeyInput(recovered);
      setRestorePassword('');
      setPickedBackupFile(null);
      setBackupMessage('Master Node Passkey recovered and stored securely on this device.');
    } catch (err) {
      setBackupMessage(err.message || 'Could not restore the backup.');
      setBackupMessageIsError(true);
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleStoreCurrentPasskey() {
    setSecureStorageMessage('');
    if (!passkeyInput) {
      setSecureStorageMessage('Enter a Master Node Passkey above first.');
      return;
    }
    await setStoredPasskey(passkeyInput);
    setStoredPasskeyPresent(true);
    setSecureStorageMessage('Stored in this device’s secure storage.');
  }

  async function handleLoadStoredPasskey() {
    setSecureStorageMessage('');
    const stored = await getStoredPasskey(); // biometric-gated when available
    if (!stored) {
      setSecureStorageMessage('No passkey available (none stored, or unlock was cancelled).');
      return;
    }
    setPasskeyInput(stored);
    setSecureStorageMessage('Loaded from secure storage.');
  }

  async function handleClearStoredPasskey() {
    await clearStoredPasskey();
    setStoredPasskeyPresent(false);
    setSecureStorageMessage('Cleared from secure storage.');
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
      <Text style={styles.title}>Settings</Text>

      {!checking && (
        <View style={[styles.card, styles.row, { marginTop: spacing.lg }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Biometric unlock</Text>
            <Text style={styles.rowHint}>
              {biometricAvailable
                ? 'Require Face ID / fingerprint to open the app'
                : 'Not available — no Face ID / fingerprint enrolled on this device'}
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={toggleBiometric}
            disabled={!biometricAvailable}
            trackColor={{ true: colors.cyan }}
          />
        </View>
      )}

      {/* ============================================================
          🎨 APP THEME (Phase 7) — White/Dark/Neon, persisted via
          AsyncStorage (ThemeProvider.js). Applies live to the drawer,
          headers, and nav chrome (App.js); see theme.js's header note
          for what's in scope vs. deferred for this pass.
         ============================================================ */}
      <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>🎨 App Theme</Text>
      <View style={[styles.card, styles.row, { marginTop: spacing.sm }]}>
        {THEMES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTheme(t)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.sm,
              alignItems: 'center',
              backgroundColor: theme === t ? 'rgba(0,242,254,0.15)' : 'transparent',
              borderWidth: 1,
              borderColor: theme === t ? colors.cyan : 'transparent',
            }}
          >
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 12, color: theme === t ? colors.cyan : colors.textMuted }}>
              {THEME_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ============================================================
          🔐 MASTER NODE PASSKEY — BACKUP & RECOVERY
          "Your key. Your backup. Your recovery. Inaya never holds it."
         ============================================================ */}
      <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>🔐 Master Node Passkey</Text>
      <View style={[styles.card, { marginTop: spacing.sm }]}>
        <Text style={styles.rowHint}>Secure your recovery</Text>

        <TextInput
          style={[styles.input, { marginTop: spacing.md }]}
          placeholder="Master Node Passkey"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={passkeyInput}
          onChangeText={setPasskeyInput}
        />

        <Text style={styles.subLabel}>Create Encrypted Backup</Text>
        <TextInput
          style={styles.input}
          placeholder="Backup password (at least 8 characters)"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={backupPassword}
          onChangeText={setBackupPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm backup password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={backupConfirmPassword}
          onChangeText={setBackupConfirmPassword}
        />
        <TouchableOpacity style={styles.button} onPress={handleCreateBackup} disabled={backupBusy}>
          {backupBusy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>Create Encrypted Backup</Text>}
        </TouchableOpacity>

        <Text style={[styles.subLabel, { marginTop: spacing.lg }]}>Restore From Backup</Text>
        <TouchableOpacity style={styles.button} onPress={handlePickRestoreFile}>
          <Text style={styles.buttonText}>{pickedBackupFile ? `✓ ${pickedBackupFile.name}` : 'Select Backup File'}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Backup password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={restorePassword}
          onChangeText={setRestorePassword}
        />
        <TouchableOpacity style={styles.button} onPress={handleRestoreBackup} disabled={backupBusy || !pickedBackupFile}>
          {backupBusy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>Restore Passkey</Text>}
        </TouchableOpacity>

        {!!backupMessage && (
          <Text style={[styles.messageText, backupMessageIsError && styles.messageTextError]}>{backupMessage}</Text>
        )}

        <Text style={[styles.subLabel, { marginTop: spacing.lg }]}>Manage Secure Storage</Text>
        <Text style={styles.rowHint}>
          {Platform.OS === 'web'
            ? 'On the web preview this falls back to local storage — on a real device it uses the OS Keystore.'
            : storedPasskeyPresent
              ? 'A passkey is currently stored securely on this device.'
              : 'No passkey currently stored on this device.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleStoreCurrentPasskey}>
          <Text style={styles.buttonText}>Store Current Passkey Securely</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleLoadStoredPasskey}>
          <Text style={styles.buttonText}>Load Passkey From Secure Storage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleClearStoredPasskey}>
          <Text style={[styles.buttonText, styles.buttonTextDanger]}>Clear Secure Storage</Text>
        </TouchableOpacity>
        {!!secureStorageMessage && <Text style={styles.messageText}>{secureStorageMessage}</Text>}

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Inaya cannot recover your Master Node Passkey. Keep your encrypted backup and recovery password safe. Losing both may result in permanent loss of access.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl },
  title: { fontSize: 20, fontFamily: fonts.sansExtraBold, color: colors.textPrimary, letterSpacing: 0.5 },
  sectionLabel: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  card: { ...glassCard, padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.textPrimary },
  rowHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  subLabel: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
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
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textPrimary },
  buttonDanger: { borderColor: 'rgba(248,113,113,0.3)' },
  buttonTextDanger: { color: colors.danger },
  messageText: { fontFamily: fonts.sans, fontSize: 12, color: colors.success, marginTop: spacing.xs, marginBottom: spacing.sm, lineHeight: 16 },
  messageTextError: { color: colors.danger },
  warningBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: { fontFamily: fonts.mono, fontSize: 11, color: colors.warning, lineHeight: 16, flex: 1 },
});
