# Deploying The Replay Cup

The build output (`dist/`) is a fully static, self-contained SPA: no backend, no
external requests (no CDNs, fonts, analytics or APIs), no cookies, no tracking.

## Option A — Docker (recommended, config included)

```sh
docker build -t replay-cup .
docker run -p 8080:80 replay-cup     # → http://localhost:8080
```

`nginx.conf` already handles everything below (SPA fallback, security headers,
strict CSP, caching, gzip). Put TLS in front of it (reverse proxy or your
host's edge) — the container itself listens on plain HTTP.

## Option B — any static host (Netlify, Vercel, Pages, S3…)

Deploy `dist/` and configure two things:

1. **SPA fallback** — rewrite every non-file route to `/index.html`
   (`/bracket`, `/match/r16-4` etc. are client-side routes).
2. **Headers** — mirror the ones in `nginx.conf`:
   - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
   - `Cache-Control: no-cache` for `index.html`; `public, max-age=2592000, immutable` for `/assets/*` (filenames are content-hashed).

Serve over **HTTPS** — the "Copy match report" button uses the async Clipboard
API, which browsers only expose in secure contexts.

## Before announcing

- [ ] Fill in the two commented `og:url` / `og:image` tags in `index.html` with
      the real absolute domain URLs (`public/og-image.png` is already built,
      1200×630). LinkedIn reads these for the share card; use LinkedIn's Post
      Inspector to refresh its cache after deploying.
- [ ] `npm test && npm run build` green.
- [ ] Click through intro → bracket → a match → kick-off → result on the live
      domain, plus a hard refresh on a deep link like `/match/r16-4` (verifies
      the SPA fallback).

## Publishing the source (optional)

- `data/raw/` is gitignored — keep it that way. The StatsBomb event files and
  the FC 26 CSV are other people's distributions; the repo only carries the
  small derived JSON in `src/data/generated/` (with provenance headers).
- There is no LICENSE file yet. Pick one before making the repo public.
- StatsBomb's open-data licence asks publications using their data to credit
  them (done in-app on the methodology page). If you want to go strictly by
  their user agreement, they also ask for their logo on public-facing work —
  grab it from their brand resources and add it next to the credit if you
  prefer maximum caution.
