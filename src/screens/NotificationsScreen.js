// src/screens/NotificationsScreen.js
//
// In-app notification center — the OTA-deliverable half of the
// notification feature (see notificationsApi.js's header comment for
// scope). Shows referral/KYC events tied to the same activated-referrer
// email ReferralScreen.js already persists under ACTIVATED_EMAIL_KEY.
//
// Deliberately NOT tray-level push: expo-notifications is a listed
// dependency but was never added to app.json's plugins array, so the
// native Android permissions/receivers it needs were never compiled
// into the already-distributed APK. This screen is pure JS/UI, so it
// reaches existing installs via the expo-updates OTA channel already
// configured for this app -- no reinstall required. True push becomes a
// small follow-up once a new native build ships (e.g. for a Play Store
// listing), not a redesign of this screen.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fonts, glassCard } from '../theme';
import { getNotifications } from '../utils/notificationsApi';

const ACTIVATED_EMAIL_KEY = 'inaya_referral_activated_email';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (activatedEmail) => {
    if (!activatedEmail) {
      setNotifications([]);
      return;
    }
    try {
      const data = await getNotifications(activatedEmail);
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      // Fire-and-forget -- a failed fetch just leaves the last-known list.
    }
  }, []);

  useEffect(() => {
    (async () => {
      const persisted = await AsyncStorage.getItem(ACTIVATED_EMAIL_KEY);
      setEmail(persisted || null);
      await load(persisted || null);
      setIsLoading(false);
    })();
  }, [load]);

  async function onRefresh() {
    setIsRefreshing(true);
    await load(email);
    setIsRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.cyan} />}
    >
      <Text style={styles.title}>🔔 Notifications</Text>
      <Text style={styles.subtitle}>Activity on your referral code and identity verification.</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.xxl }} />
      ) : !email ? (
        <View style={[glassCard, styles.emptyCard]}>
          <Text style={styles.emptyText}>Activate a referral code first — notifications for referral and identity-verification activity will show up here once you have.</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={[glassCard, styles.emptyCard]}>
          <Text style={styles.emptyText}>You're all caught up — nothing new in the last 14 days.</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {notifications.map((n) => (
            <View key={n.id} style={[glassCard, styles.item]}>
              <Text style={styles.itemIcon}>{n.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{n.title}</Text>
                <Text style={styles.itemBody}>{n.body}</Text>
                <Text style={styles.itemTime}>{new Date(n.occurredAt).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  title: { fontFamily: fonts.sansExtraBold, fontSize: 24, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xl },
  emptyCard: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  item: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'flex-start' },
  itemIcon: { fontSize: 22 },
  itemTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
  itemBody: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  itemTime: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: spacing.xs },
});
