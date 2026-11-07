# QSCHOOL Mobile

Expo SDK 58 app for Android and iOS. It uses Expo Router, the shared palette in
`src/design-tokens.ts`, and QSCHOOL logo assets under `assets/`.

## Run locally

Set `EXPO_PUBLIC_API_URL` to the HTTPS QSCHOOL server in `apps/mobile/.env`, then
start Metro from this directory:

```bash
npx expo start
```

The app signs in QSCHOOL users and loads role-specific navigation. Parents and
students have family portal tabs. Teachers have class attendance and grade entry.
Admins have separate dashboard, classes, students, attendance, and grade tabs;
full student/staff management, fees, reports, and settings remain on the web app.
Mobile endpoints are under `src/app/api/v1/` in the web app. Bearer tokens are
stored with `expo-secure-store` and access tokens expire after one hour.

## Build and verify

```bash
npx expo-doctor
npx tsc --noEmit
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile preview-arm64
npx eas-cli@latest build --platform ios --profile simulator
```

The Android `preview` profile produces a universal APK for direct installation
on phones and emulators. `preview-arm64` produces a smaller APK for modern
64-bit ARM phones.
The iOS `simulator` profile produces an app archive for Xcode Simulator; iPhone
installation requires an Apple signed device build. Current local artifacts, when
present, are in the ignored `dist/` directory (`QSCHOOL-preview.apk`,
`QSCHOOL-preview-arm64.apk`, and `QSCHOOL-ios-simulator.tar.gz`).

Regenerate the Android, iOS, splash, and web icon variants after editing the SVG
masters with `npm run mobile:icons` from the repository root. Configure a stable
HTTPS API URL in the EAS `preview` environment before sharing builds; temporary
Cloudflare tunnel URLs expire and are for testing only.
