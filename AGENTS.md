# EcoLearn repository instructions

## Canonical branches

- `main` is the canonical production branch for EcoLearn.
- Netlify production deploys must come from `main`.
- `platform-rebuild` is a legacy branch. Do not treat it as the production branch or direct new production deployments to it.
- Use `codex/*` branches for isolated implementation work, then merge or fast-forward the tested release into `main` when the user authorizes a production push.

## Application locations

- The production website is in `apps/platform-web`.
- The production Expo iOS/Android app is in `apps/mobile-ecolearn`.
- Do not implement current EcoLearn features in the older `ecoscan` project or the legacy `apps/mobile-scanner` app.

## Deployment reminder

- Supabase Edge Function deployment workflows do not apply SQL migrations.
- Apply new files from `apps/platform-web/supabase/migrations` separately through the intended Supabase database migration process.
