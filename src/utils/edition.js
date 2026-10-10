// src/utils/edition.js
//
// The Google Play edition of the app, built from the `play-release` branch (.github/workflows/build-apk.yml
// sets EXPO_PUBLIC_PLAY_EDITION=true as a workflow env var; Expo inlines EXPO_PUBLIC_ values at bundle time).
// It leaves out things Google Play's policies do not allow for this publisher or this payment method:
//   * Health OS (patient records): health apps must be published from an organization account.
//   * The in-app card checkout for storage plans: cloud storage purchases inside a Play app must use Google Play Billing.
//   * Staking and the cross-chain Bridge (App.js, StorageDashboardScreen.js): declaring either on Play Console's
//     Financial Features page (even non-custodial, even testnet-only) gates the whole app behind an organization
//     developer account, same as the two items above. Hidden here so the Play submission can truthfully answer
//     "my app doesn't provide any financial features" until the organization account exists (2026-01 target).
// Everything else (dApp features, Watcher Pioneer, upload/download, faucet, and Business Workspace sign-in for
// emergency access) is unchanged.
// The normal build and over-the-air updates for the existing APK (main branch) leave the flag unset, so nothing
// changes there.
export const PLAY_EDITION = process.env.EXPO_PUBLIC_PLAY_EDITION === 'true';
