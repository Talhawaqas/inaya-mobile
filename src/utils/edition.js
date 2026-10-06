// src/utils/edition.js
//
// The Google Play edition of the app (EAS build profile "play" sets EXPO_PUBLIC_PLAY_EDITION=true; Expo inlines EXPO_PUBLIC_ values at bundle time).
// It leaves out two things Google Play's policies do not allow for this publisher or this payment method:
//   * Health OS (patient records): health apps must be published from an organization account.
//   * The in-app card checkout for storage plans: cloud storage purchases inside a Play app must use Google Play Billing.
// Everything else (dApp features, staking, Watcher Pioneer, upload/download, and Business Workspace sign-in for emergency access) is unchanged.
// The normal build and over-the-air updates for the existing APK leave the flag unset, so nothing changes there.
export const PLAY_EDITION = process.env.EXPO_PUBLIC_PLAY_EDITION === 'true';
