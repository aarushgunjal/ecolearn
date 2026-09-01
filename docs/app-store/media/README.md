# EcoLearn App Store Media Capture Kit

Prepared: August 31, 2026

Final App Store screenshots and preview video must show the actual TestFlight iOS build. Do not submit browser captures, design mockups, Expo Go developer chrome, real student names, real class codes, real email addresses, or real location history.

## Required capture setup

- Build: the exact release candidate uploaded to App Store Connect.
- Device target: iPhone 16 Pro Max / current 6.9-inch App Store class.
- Screenshot output: portrait PNG or JPEG, no alpha. Apple accepts 1320×2868, 1290×2796, or 1260×2736 for this class.
- Preview output: portrait 886×1920, H.264 or ProRes, 15–30 seconds, no more than 30 fps.
- Account: fictional App Review account only.
- Status bar: normal, consistent time/battery, no personal notifications.
- Data: use the seeded fictional school/class/community data. Never show a reusable password or private join code.

## Ten-screenshot set

Capture these in order and save them under `final/iphone-6.9/` using the exact filenames below.

1. `01-home.png` — Home dashboard with a plausible fictional learner name, XP, level, streak, and the next lesson. Marketing caption: **Small choices. Real impact.**
2. `02-scan.png` — Scanner ready state with separate **Choose from gallery** and **Take a photo** controls plus predictive name search. Caption: **Know what goes where.**
3. `03-verified-result.png` — A fictional aluminum-can scan with an official DNREC match, exact disposal guidance, and source attribution. Caption: **Delaware guidance you can trust.**
4. `04-map.png` — Nearby disposal map with fictional/current public facility results and no home address visible. Caption: **Find the right drop-off nearby.**
5. `05-learn.png` — Learning path with completed and upcoming lessons. Caption: **Build your eco instinct.**
6. `06-lesson.png` — A polished quiz step with one answer selected but no incorrect/error state. Caption: **Learn by doing.**
7. `07-community.png` — Student-safe community view showing multiple memberships and fictional aliases. Caption: **Belong to more than one community.**
8. `08-classroom.png` — Teacher/classroom view with assignments, completion, and common misconceptions using fictional data. Caption: **A classroom built for action.**
9. `09-school-standings.png` — School community and class standings with fictional class names. Caption: **Turn progress into friendly competition.**
10. `10-achievements-profile.png` — Achievements/profile with badges, account controls, privacy, support, and licenses reachable. Caption: **Keep growing. Keep contributing.**

## App Preview 1 — learner journey (24 seconds)

| Time | Actual in-app action | Optional concise overlay |
| ---: | --- | --- |
| 0–3 s | Home dashboard | Small choices. Real impact. |
| 3–8 s | Open scanner, choose a prepared single-item can photo | Scan an everyday item |
| 8–12 s | Show verified DNREC result and source | Get official Delaware guidance |
| 12–16 s | Open nearby map | Find the right drop-off |
| 16–20 s | Complete one lesson question | Learn by doing |
| 20–24 s | Show XP/badge/community progress | Make progress together |

## App Preview 2 — classroom/community (24 seconds)

| Time | Actual in-app action | Optional concise overlay |
| ---: | --- | --- |
| 0–4 s | Open Community | More than a leaderboard |
| 4–8 s | Switch between fictional class and community memberships | One learner, many communities |
| 8–13 s | Teacher opens assignments/completion | Assign. Learn. Understand. |
| 13–18 s | Show common misconceptions and announcement | See where students need help |
| 18–24 s | Show school standings and achievement | Build momentum together |

## App Preview 3 — educator overview (optional, 20 seconds)

Use only if the educator workflow is fully functional in the release candidate. Show lesson preview, assignment creation, class completion, a classroom announcement, and school standings. Do not show unfinished buttons or placeholder metrics.

## Capture procedure

1. Install the processed TestFlight build on a supported iPhone.
2. Sign in with the fictional review account and reset all seeded demo state.
3. Turn on Do Not Disturb and hide personal keyboard suggestions/notifications.
4. Capture the ten still screens in the exact order above.
5. Use iOS Screen Recording for each preview take. Keep every visible interaction inside EcoLearn.
6. Trim to 15–30 seconds on macOS/iPhone without adding unsupported device frames or misleading UI.
7. Verify every screenshot against the release build, then upload through App Store Connect.

## Release gate

The attached single home screenshot is not sufficient for a ten-image set. Final native assets cannot be truthfully generated from this Windows checkout alone because no iOS simulator or connected iPhone capture stream is available here. Once the ten raw TestFlight captures are copied into `raw/iphone-6.9/`, they can be checked for dimensions, privacy, consistency, and App Store compliance before upload.
