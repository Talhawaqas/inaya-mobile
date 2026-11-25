// src/utils/jobPush.js -- lock-screen notifications for Manage Orders (new job, schedule change, rework, approvals).
// The phone registers an Expo push token with /api/orgs/ops/push/register for each company that has Manage Orders.
// The server sends only "New job WO-00012"-style text, never customer details. Tapping a notification opens the job.
// Android needs the Firebase (FCM) credentials in the Expo project; until they exist, getting a token fails quietly and
// technicians still see every update inside the app.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { orgFetch } from './orgApi';

const PROJECT_ID = 'd3ab3b26-0be8-4082-9f01-45a7b90d8f56';
const available = () => { try { return !!requireOptionalNativeModule('ExpoPushTokenManager') && !!requireOptionalNativeModule('ExpoNotificationPermissionsModule'); } catch { return false; } };
const N = () => require('expo-notifications');

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return; handlerSet = true;
  N().setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
}

/** Registers this phone for job notifications in each of the given companies. Safe to call often. */
export async function registerJobPush(orgIds = []) {
  if (!available() || Platform.OS === 'web' || !orgIds.length) return { registered: 0, reason: 'unavailable' };
  try {
    ensureHandler();
    const Notifications = N();
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('jobs', { name: 'Jobs', importance: Notifications.AndroidImportance.HIGH, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE });
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return { registered: 0, reason: 'denied' };
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    let n = 0;
    for (const orgId of orgIds) {
      const k = `inaya.jobPush.${orgId}`; if ((await AsyncStorage.getItem(k)) === token) { n++; continue; }
      await orgFetch('/api/orgs/ops/push/register', { method: 'POST', body: { orgId, token, platform: Platform.OS } });
      await AsyncStorage.setItem(k, token); n++;
    }
    return { registered: n };
  } catch (e) { return { registered: 0, reason: e?.message || 'failed' }; }
}

/** Calls onOpen({ orgId, jobId }) when a job notification is tapped (also for the one that launched the app). */
export function listenForJobTaps(onOpen) {
  if (!available()) return () => {};
  try {
    const Notifications = N();
    const handle = (resp) => { const d = resp?.notification?.request?.content?.data || {}; if (d.orgId && d.jobId) onOpen({ orgId: d.orgId, jobId: d.jobId }); };
    Notifications.getLastNotificationResponseAsync().then((r) => { if (r) handle(r); }).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  } catch { return () => {}; }
}
