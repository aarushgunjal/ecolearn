# EcoLearn

EcoLearn is a sustainability learning platform for students, teachers, and local communities. It combines short lessons, item identification, official Delaware disposal guidance, classroom assignments, and shared learning progress.

**Website:** [ecolearn.dev](https://ecolearn.dev)

## Repository

| Path | Responsibility |
| --- | --- |
| `apps/platform-web` | Production React and Vite website |
| `apps/mobile-ecolearn` | Production Expo app for iOS and Android |
| `apps/platform-web/supabase` | Shared database migrations and server functions |
| `docs` | Architecture and security documentation |
| `scripts` | Development and verification utilities |
| `legacy` | Earlier prototypes, excluded from production builds |

## Development

Use Node.js 22 and npm. Each application has its own dependencies and lockfile.

```sh
npm run setup:web
cp apps/platform-web/.env.example apps/platform-web/.env.local
npm run dev
```

The website requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The native app uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Client keys are public; privileged server credentials must never be placed in either application.

```sh
npm run setup:mobile
npm run mobile
```

## Verification

```sh
npm run lint
npm run typecheck
npm run test:database
npm run test:web
npm run build
```

Browser tests require Playwright Chromium (`npm exec --prefix apps/platform-web -- playwright install chromium`). They use isolated fixtures unless an external test URL is explicitly configured. Database tests apply every migration to a temporary PostgreSQL-compatible database and exercise authorization, learning progress, notifications, and recovery.

## Design and security

- [Architecture](docs/architecture.md)
- [Security model](docs/security.md)
- [Copyright](COPYRIGHT.md) and [third-party notices](THIRD_PARTY_NOTICES.md)

Production web releases use `main`. Native binaries are built from `apps/mobile-ecolearn`. Database migrations are applied separately from server function deployments.
