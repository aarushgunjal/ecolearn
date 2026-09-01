# EcoLearn Feature Parity and Password-Recovery Validation

Reviewed: August 31, 2026

## Password recovery

| Stage | Web | iOS/Android | Result |
| --- | --- | --- | --- |
| Forgot-password entry point | Sign-in dialog → **Forgot password?** | Sign-in screen → **Forgot password?** | Implemented |
| Reset email request | Supabase `resetPasswordForEmail` | Supabase `resetPasswordForEmail` | Implemented |
| Recovery link target | `https://ecolearn.dev/reset-password` | `ecolearn-mobile://auth/reset-password` | Implemented in code; must be allowlisted in Supabase |
| Recovery session handling | Supabase `PASSWORD_RECOVERY` event | Deep-link session parser + `PASSWORD_RECOVERY` event | Implemented |
| New-password validation | Minimum 8 characters and confirmation | Minimum 8 characters and confirmation | Implemented |
| Password update | Supabase `updateUser({ password })` | Supabase `updateUser({ password })` | Implemented |

Automated web validation mocks the reset endpoint so no real user email or credentials are transmitted. A final end-to-end test still requires the production Supabase redirect allowlist and a real TestFlight device.

## Core parity matrix

| Capability | Web | Mobile | Status / intentional difference |
| --- | --- | --- | --- |
| Email sign-up/sign-in/sign-out | Yes | Yes | Parity |
| Google sign-in | Yes | Yes in development/production build | Expo Go limitation is intentional |
| Sign in with Apple | No | iOS only | Native platform requirement; web parity not required |
| Password recovery | Yes | Yes | Parity after this change |
| Home progress, XP, streak, recent activity | Yes | Yes | Parity |
| Photo scan | Browser camera/gallery controls | Native camera/gallery | Parity with platform-native UX |
| Name search and predictive DNREC suggestions | Yes | Yes | Parity |
| Barcode and label tools | Yes | Yes | Parity |
| Official DNREC matching and DSWA related video | Yes | Yes | Parity; web embeds video, mobile opens official video |
| Nearby disposal locations | Interactive Leaflet map | Native map | Parity |
| Lessons and quizzes | Yes | Yes | Parity |
| Challenges, achievements, XP claims | Yes | Yes | Parity |
| Community/class/school membership | Yes | Yes | Parity through shared Supabase RPCs |
| Multiple community/class memberships | Supported by shared membership model | Supported by shared membership model | Parity |
| Teacher assignments, announcements, events, standings | Yes | Yes | Parity through shared hub payload/actions |
| Role-aware student/teacher/admin experiences | Yes | Yes | Parity; admin analytics remains web-focused |
| Profile/display name/account deletion | Yes | Yes | Parity |
| Privacy, terms, support, deletion, licenses | Yes | Opens canonical web legal pages | Intentional single-source legal content |

## Web-only surfaces not presented as mobile parity gaps

- The web **Organizations** campaign and **Notifications** pages currently use local browser state and illustrative metrics. They are not production backend capabilities and should not be copied into the native app as if they were real.
- Web **Local Rules** stores a Delaware county preference locally. Core official DNREC guidance is already available on mobile through scan results and nearby-location tools.
- The web admin analytics view is appropriate for a larger screen and is not a student-facing feature.

These surfaces should either be connected to real backend data in a future scoped release or removed from production navigation; duplicating placeholder behavior on mobile would reduce product quality rather than improve parity.

## Remaining release checks

- Verify both Supabase reset URLs are allowlisted.
- Complete one real reset on the deployed web app and one on the TestFlight iPhone build.
- Confirm Google and Apple auth redirect URLs in production.
- Test community role permissions with fictional student, teacher, and admin accounts.
- Confirm location-denial behavior and map results on a physical iPhone and Android device.
