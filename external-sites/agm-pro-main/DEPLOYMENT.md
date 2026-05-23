# Deployment Guide

This app is ready to deploy as a static frontend for board demos and AGM operations using the current mock-backed production mode.

## Render

The repository now includes [render.yaml](C:/Users/james/Downloads/Compressed/agm-pro-main/render.yaml).

Render setup:

1. Push this repository to GitHub.
2. In Render, create a new Static Site from the repo.
3. Render should detect `render.yaml` automatically.
4. If you configure it manually, use:
   - Root Directory: `src/frontend`
   - Build Command: `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm build:render`
   - Publish Directory: `dist`
5. Confirm the SPA rewrite rule sends `/*` to `/index.html`.

## cPanel

Use the frontend build output in `src/frontend/dist`.

Steps:

1. Run `pnpm build:cpanel` from the repo root, or run `pnpm build:cpanel` inside `src/frontend`.
2. Upload everything inside `src/frontend/dist` to your cPanel site root, usually `public_html/`.
3. Make sure the generated `.htaccess` file is uploaded too.
4. Open your domain and test routes like `/dashboard`, `/registration`, and `/reports`.

## Notes

- Production builds currently use mock mode through [src/frontend/.env.production](C:/Users/james/Downloads/Compressed/agm-pro-main/src/frontend/.env.production), which is the safest option for immediate demo deployment.
- If you later connect a real backend, replace the production env settings and update `env.json` accordingly.
