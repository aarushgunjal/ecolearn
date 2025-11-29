**Name**: EcoLearn


**Description**: EcoLearn is designed to help make the challenges of sustainable living engaging, rewarding, and social. Inspired by the gamified learning model of Duolingo, it transforms eco-friendly actions into daily challenges that feel more like a game than a chore. Instead of memorizing vocabulary, users “level up” by practicing real-world habits that reduce waste, save energy, and promote sustainable choices. 


**How to use**: Open the website and create an account to save data. To scan, simply open the scan section and scan whatever items you want one at a time or upload an image.


**URL**: https://ecolearn.tech

## SPA routing on GitHub Pages

GitHub Pages serves static files and does not natively support client-side routing deep links (e.g., `/auth`, `/dashboard`). To ensure routes load directly, `404.html` fallbacks are included at the repo root and in `docs/`. These pages redirect unknown paths to `index.html` while preserving the original path, allowing the React router to render the correct view.

If you see "404 File not found" when visiting a deep link:

- Verify `docs/404.html` exists in the deployed site.
- Ensure the `CNAME` file is present (root and `docs/`) with `ecolearn.tech`.
- Confirm `vite.config.ts` builds to `docs/` and uses an appropriate `base` (custom domains typically work with `/`).
