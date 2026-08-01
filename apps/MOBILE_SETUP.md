# EcoLearn mobile apps — iPhone / Expo Go setup

There are two independent Expo apps in this repository:

| App | Folder | Purpose |
| --- | --- | --- |
| EcoScan | `apps/mobile-scanner` | Focused photo/camera waste scanner. |
| EcoLearn | `apps/mobile-ecolearn` | Signed-in platform companion: scanner, feedback, lessons, tools, nearby sites, and profile. |

## One-time configuration

1. Install **Expo Go** from the iPhone App Store.
2. In each mobile-app folder, copy `.env.example` to `.env`.
3. Put the values from the platform repository's `.env` into the mobile names:

   ```text
   VITE_SUPABASE_URL -> EXPO_PUBLIC_SUPABASE_URL
   VITE_SUPABASE_PUBLISHABLE_KEY -> EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

   The publishable/anon key is designed to be used by client apps; never put a
   Supabase service-role key in either mobile `.env` file.
4. Keep `.env` private. It is ignored by Git; commit only `.env.example`.
5. Put the iPhone and this computer on the same Wi-Fi network.

## Run EcoScan

```powershell
cd "C:\Users\Aarush\Documents\Coding\React\ecolearn-platform\apps\mobile-scanner"
npm.cmd start
```

Use the iPhone Camera app to scan the QR code, then tap **Open in Expo Go**.
Choose a photo or take a photo, then tap **Scan this item**. This app uses the
same `classify-scan` Supabase function as the web scanner.

## Run EcoLearn

Stop the first server with `Ctrl+C`, then run:

```powershell
cd "C:\Users\Aarush\Documents\Coding\React\ecolearn-platform\apps\mobile-ecolearn"
npm.cmd start
```

Scan the new QR code with the iPhone Camera app. For Expo Go testing, sign in
with **email/password**. You can scan, submit feedback, complete lessons,
search barcodes, read labels, find nearby sites, and update your profile.

## Network troubleshooting

If the QR code cannot reach your computer, stop the server and run:

```powershell
npx.cmd expo start --tunnel
```

The tunnel is slower but works on many school, guest, and restrictive Wi-Fi
networks. Keep the terminal open while using the app. JavaScript changes should
refresh automatically on the phone.

## Google sign-in limitation in Expo Go

Google OAuth needs a stable custom callback URL. Expo Go uses a temporary
`exp://` URL, so Google sign-in is intentionally unavailable in Expo Go. The
EcoLearn app displays this clearly and supports email/password testing there.

To test Google sign-in, use a native **development build** instead:

1. Add `ecolearn-mobile://auth/callback` to Supabase **Authentication → URL
   Configuration → Redirect URLs**.
2. Create/install an iOS development build with the `ecolearn-mobile` scheme.
3. Start Metro with `npx.cmd expo start --dev-client` and open the development
   build from the iPhone Home Screen.

## Device validation checklist

- [ ] Camera permission prompt appears; take-photo scanner returns a result.
- [ ] Photo-library scan returns the same type of result as the web scanner.
- [ ] EcoLearn email sign-in persists after closing and reopening Expo Go.
- [ ] A signed-in scan increases scan history/progress on the web platform.
- [ ] Feedback can be saved with no photo and, after consent, with one photo.
- [ ] A completed lesson appears completed after reopening the app/web platform.
- [ ] Barcode lookup, label reading, and nearby-site search return useful data.
- [ ] Map site button opens the installed maps app/browser.
- [ ] Profile name and notification preference sync back to the web platform.
