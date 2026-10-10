// src/screens/MeetScreen.js
//
// Inaya Meet, mobile (Internxt-inspired SOW, Workstream C, §7.30). Deliberately a WebView around
// the same /meet/[token] and business-workspace Meet UI the web app already has, not a second
// native WebRTC implementation -- modern mobile WebViews support getUserMedia with a real
// camera/microphone permission grant, so this satisfies the SOW's minimum bar (view invitation,
// join, camera/mic, participant list, chat, leave) without pulling in react-native-webrtc and a
// second media stack to maintain (SOW §7.31's "do not create a fifth native application," read
// the same way for a second media engine). Hosting/scheduling from mobile is out of scope for this
// pass, same as the SOW allows ("initial goal should be real cross-platform participation").
//
// Camera/mic permission grants need app.json's android.permissions (CAMERA/RECORD_AUDIO, added
// alongside this screen) and a real native build -- an existing install only gets this screen
// over OTA, but camera/mic access needs the next store/APK build to actually take effect.

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts } from '../theme';
import BackgroundGlow from '../components/BackgroundGlow';

const WEB_ORIGIN = 'https://www.inayanetwork.com';

function normalizeJoinInput(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  // Accept a full link (any origin) or a bare token -- same tolerance the web MeetView's
  // "paste a meeting link" field already has.
  const m = /\/meet\/([A-Za-z0-9_-]+)/.exec(s);
  if (m) return `${WEB_ORIGIN}/meet/${m[1]}`;
  if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return `${WEB_ORIGIN}/meet/${s}`;
  return null;
}

export default function MeetScreen() {
  const insets = useSafeAreaInsets();
  const [joinInput, setJoinInput] = useState('');
  const [activeUrl, setActiveUrl] = useState(null);
  const [error, setError] = useState('');

  const join = () => {
    const url = normalizeJoinInput(joinInput);
    if (!url) { setError('Paste a valid Inaya Meet link.'); return; }
    setError('');
    setActiveUrl(url);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <BackgroundGlow />
      <Text style={styles.title}>Inaya Meet</Text>
      <Text style={styles.subtitle}>
        Join a private video meeting with a link someone shared with you. Hosting and scheduling meetings is available on the web and
        desktop app for now.
      </Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TextInput
        value={joinInput}
        onChangeText={setJoinInput}
        placeholder="Paste a meeting link"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.joinButton} onPress={join} disabled={!joinInput.trim()}>
        <Text style={styles.joinButtonText}>Join Meeting</Text>
      </TouchableOpacity>

      <Modal visible={!!activeUrl} animationType="slide" onRequestClose={() => setActiveUrl(null)}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.modalTitle}>Meeting</Text>
          <TouchableOpacity onPress={() => setActiveUrl(null)} style={styles.closeButton}>
            <Text style={styles.closeText}>✕ Leave</Text>
          </TouchableOpacity>
        </View>
        {!!activeUrl && (
          <WebView
            source={{ uri: activeUrl }}
            style={styles.webview}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.cyan} />
              </View>
            )}
            // Camera/mic for WebRTC inside the WebView -- Android needs the explicit grant type;
            // iOS (WKWebView) honors getUserMedia once the Info.plist usage strings above are
            // present, no extra prop needed.
            mediaCapturePermissionGrantType={Platform.OS === 'android' ? 'grant' : undefined}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['https://www.inayanetwork.com', `${WEB_ORIGIN}/*`]}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  title: { fontFamily: fonts.sansExtraBold, fontSize: 20, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 18 },
  error: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.warning, marginBottom: spacing.sm },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.textPrimary, fontFamily: fonts.sans, fontSize: 13, marginBottom: spacing.sm },
  joinButton: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  joinButtonText: { fontFamily: fonts.sansExtraBold, fontSize: 12, color: '#000', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.navBar, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  closeButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.06)' },
  closeText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textSecondary },
  webview: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
