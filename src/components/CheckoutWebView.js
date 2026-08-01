// src/components/CheckoutWebView.js
//
// Modal wrapping a WebView for Stripe Checkout — mobile can't embed Stripe's
// hosted checkout page inline the way a website redirect (window.location.href)
// does, so this loads it in an in-app WebView and watches for the
// success_url/cancel_url pattern create-checkout-session configures
// (https://www.inayanetwork.com/?checkout=success&tier=...&session_id=...
// or ?checkout=cancelled) to detect completion and close automatically.
//
// Avoids the global URL constructor (not reliably polyfilled in Hermes) —
// plain regex query-param extraction instead.

import React from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing, radius, fonts } from '../theme';

function getQueryParam(url, key) {
  const match = url.match(new RegExp('[?&]' + key + '=([^&]*)'));
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
}

export default function CheckoutWebView({ visible, url, onClose, onResult }) {
  function handleNavigationStateChange(navState) {
    const currentUrl = navState?.url;
    if (!currentUrl || !currentUrl.includes('checkout=')) return;
    const status = getQueryParam(currentUrl, 'checkout');
    if (!status) return;
    onResult?.({
      status,
      sessionId: getQueryParam(currentUrl, 'session_id'),
      tier: getQueryParam(currentUrl, 'tier'),
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Secure Checkout</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕ Close</Text>
        </TouchableOpacity>
      </View>
      {!!url && (
        <WebView
          source={{ uri: url }}
          onNavigationStateChange={handleNavigationStateChange}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.cyan} />
            </View>
          )}
          style={styles.webview}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navBar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: spacing.xxxl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  closeButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.06)' },
  closeText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.textSecondary },
  webview: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
