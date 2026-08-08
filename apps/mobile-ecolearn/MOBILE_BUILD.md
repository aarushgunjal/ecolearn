# EcoLearn mobile build guide

EcoLearn targets Expo SDK 57 and React Native 0.86. The app is configured for
Android and iOS with camera, photo-library, and foreground-location permission
messages, separate native version numbers, app identifiers, adaptive artwork,
and development, preview, simulator, and production build profiles.

## Local configuration

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the same Supabase project used by
   the web platform.
3. Install dependencies with `npm install`.
4. Validate the project with `npm run check`.

Never place the Supabase service-role key or an OpenRouter key in this mobile
app. The publishable Supabase key is the only client key expected here.

## Running the JavaScript app

- `npm run start` starts Metro for an EcoLearn development build.
- `npm run start:clear` does the same after clearing Metro's cache.
- `npm run start:go` explicitly targets Expo Go.
- `npm run start:go:tunnel` is the Expo Go fallback when the phone and computer
  cannot communicate over the local network.

During Expo's SDK 57 transition, the public App Store and Play Store builds of
Expo Go may still target SDK 54. A store-installed Expo Go app cannot load this
SDK 57 project until Expo releases a matching client. Keep EcoLearn on SDK 57
and use a development build instead of downgrading the production project.

Expo publishes an official SDK 57 Expo Go APK for Android outside Google Play:

<https://expo.dev/go?device=true&platform=android&sdkVersion=57>

Install that APK on an Android phone, run `npm run start:go`, and scan the QR
code while the phone and computer are on the same network. This does not require
an Expo account or Google Play Console account. iOS does not allow the same
account-free physical-device sideloading path; use a matching Expo Go release
when Apple makes it available, an iOS Simulator on a Mac, or a signed
development build later.

## Account-free verification

These commands create the same production JavaScript and asset bundles that the
native builds consume:

```powershell
npm run bundle:android
npm run bundle:ios
```

An Android native build can be compiled locally without a Google Play Console
account after installing Android Studio, an Android SDK, and a compatible JDK:

```powershell
npx expo run:android
```

On macOS, an iOS Simulator build can be compiled locally with Xcode without an
Apple Developer Program membership:

```bash
npx expo run:ios
```

Windows cannot run Xcode or the iOS Simulator.

## EAS build profiles

Cloud builds require a free Expo account and one-time project linking with
`npx eas-cli@latest init`. When linking, keep the existing slug, bundle ID, and
Android package from `app.json`.

- `npm run eas:android:preview` creates an installable Android APK. It does not
  require a Google Play Console account.
- `npm run eas:ios:simulator` creates an unsigned iOS Simulator app. It does not
  require an Apple Developer Program membership, but it only runs on a Mac.
- `development` creates a custom development client for device testing.
- `production` creates store-ready artifacts when signing accounts are ready.

Before an EAS cloud build, add the two `EXPO_PUBLIC_SUPABASE_*` variables to the
Expo project's environment. Do not commit `.env`.

Before testing account deletion, deploy the repository's `delete-account`
Supabase Edge Function using the existing GitHub workflow. Also deploy the web
app so `/privacy`, `/terms`, and `/delete-account` are publicly reachable.

## Where account requirements begin

- A physical iPhone/iPad development or preview build needs Apple signing and
  therefore Apple Developer Program access.
- TestFlight and App Store distribution need Apple Developer Program and App
  Store Connect access.
- Android APK development and direct installation do not need Google Play.
- Google Play internal testing or production distribution needs a Play Console
  developer account.

The configured identifiers are `com.ecolearn.mobile` on both platforms. Treat
them as permanent once the app is registered or distributed.

See `STORE_RELEASE_CHECKLIST.md` for the listing draft, data-practice inventory,
and the decisions that remain before store submission.
