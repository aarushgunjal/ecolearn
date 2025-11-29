**URL**: https://ecolearn.tech

## SPA routing on GitHub Pages

GitHub Pages serves static files and does not natively support client-side routing deep links (e.g., `/auth`, `/dashboard`). To ensure routes load directly, `404.html` fallbacks are included at the repo root and in `docs/`. These pages redirect unknown paths to `index.html` while preserving the original path, allowing the React router to render the correct view.

If you see "404 File not found" when visiting a deep link:

- Verify `docs/404.html` exists in the deployed site.
- Ensure the `CNAME` file is present (root and `docs/`) with `ecolearn.tech`.
- Confirm `vite.config.ts` builds to `docs/` and uses an appropriate `base` (custom domains typically work with `/`).
