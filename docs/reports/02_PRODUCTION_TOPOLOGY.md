# Blocksworn — Production Topology

**Date:** 2026-05-14
**Audience:** Director + ops/infra contributors

---

## 1. Domain map

```
blocksworm.com (apex)
    ├── A record: 216.198.79.1 (Vercel anycast)
    ├── 308 redirect → www.blocksworm.com (configured at Vercel project level)
    └── Registrar: Namecheap
        └── Nameservers: pdns1.registrar-servers.com / pdns2.registrar-servers.com
                         (Namecheap BasicDNS)

www.blocksworm.com
    ├── CNAME: cname.vercel-dns.com → 64.29.17.65 / 216.198.79.65 (Vercel)
    ├── HTTPS: 200 OK
    └── Serves: Next.js marketing site (blocksworm-site Vercel project)

play.blocksworm.com
    ├── CNAME: cname.vercel-dns.com → 76.76.21.x / 66.33.60.x (Vercel)
    ├── HTTPS: 200 OK
    └── Serves: Pure legacy game (blocksworn-game Vercel project)

beta.blocksworm.com    [NOT PROVISIONED — reserved for T4.11 closed beta]
blocksworn.com (apex with N)    [parked by another registrar; not owned by us]
```

---

## 2. Vercel projects (under `romans-projects-60418408` team)

| Project | Root | Framework | Domains | Auto-deploy |
|---|---|---|---|---|
| `blocksworm-site` | `site/` | Next.js | www.blocksworm.com + blocksworm.com (308 → www) | from `main` on push |
| `blocksworn-game` | `/` | Vite | play.blocksworm.com | from `main` on push |
| `bezikaron2`, `bezikaron-2025` | — | — | unrelated | — |

The deleted `blocksworn` project from session start was a misconfigured duplicate of the marketing site; replaced by `blocksworm-site` during today's recovery.

---

## 3. Deploy pipeline

```
GitHub push to main
    ↓ (webhook)
Vercel CI clones, runs vercel build
    ↓
For blocksworn-game project:
    ├── npm ci
    ├── vite build → dist/assets/* (337 KB JS + 434 KB CSS)
    ├── mv dist/index.html dist/shell.html (frees / for legacy rewrite)
    ├── node scripts/inject-legacy-fixes.js → injects intro-skip <script>
    │    into dist/blocksworn_index_fixed.html
    ├── public/* copied verbatim → dist/* (includes 21 MB legacy HTML
    │    + 84 MB audio + 4 MB images + 18 icons)
    ├── vercel.json read for rewrites + cache headers
    └── Deploy to production
    ↓
GitHub Actions CI also runs in parallel:
    ├── lint (ESLint flat config, 0 warnings)
    ├── unit (Vitest, 1758/1758)
    ├── build (Vite + JS+CSS bundle <5 MB enforced)
    ├── smoke (Playwright on 4 projects)
    ├── visual (chromium regression vs 25 baselines)
    └── live (post-main only: Playwright against https://play.blocksworm.com)
```

The CI `live` job waits 90s for Vercel deploy to land, then probes the production URL with 7 assertions:
1. HTTP 200
2. Zero JS page errors at boot
3. Intro-video overlay hidden (suppression worked)
4. localStorage seeded correctly
5. No same-origin 404s
6. Critical assets (coin.png, cristal.png, menu.mp3) return 200
7. Game reaches actionable state (FTUE dialog OR menu) and a primary CTA click transitions to an active screen

---

## 4. Vercel cache strategy (vercel.json)

| Path pattern | Cache-Control | Rationale |
|---|---|---|
| `/assets/*` | `public, max-age=31536000, immutable` | Hashed Vite chunks — URL changes per build |
| `/(.*).{js,css,woff2,woff}` | same | Same reason |
| `/(.*).{png,jpg,webp,svg,mp3,ogg}` | `public, max-age=2592000` | Media assets (30 days) |
| `/blocksworn_index_fixed` | `public, max-age=0, must-revalidate` | The legacy HTML at /; must always check origin |
| `/shell` | same | Modular shell entry (parity-test URL) |
| `/` | same | Root |

Security headers applied globally:
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN`
- `Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()`

---

## 5. URL rewrites (vercel.json)

```
GET /              →  serve /blocksworn_index_fixed.html (21 MB legacy game)
GET /shell         →  serve /shell.html (Vite modular shell — parity testing)
GET /assets/*      →  serve dist/assets/*
GET /images/*      →  serve dist/images/*
GET /assets/audio/music/*.mp3  →  serve dist/assets/audio/music/*
```

`cleanUrls: true` — Vercel strips `.html` from served paths automatically; URLs are visited without the extension.

---

## 6. External services (status)

| Service | Status | Purpose | Backup behaviour |
|---|---|---|---|
| Sentry | DSN NOT configured | Error tracking | Errors silently swallowed; warning logged |
| Firebase | configured (no auth/Firestore yet wired live) | Future analytics + multiplayer state | Falls back to localStorage |
| RevenueCat | placeholder API key | IAP | Falls back to mock |
| Vercel | active | Hosting + deploy + CDN | — |
| Namecheap | active | Registrar + DNS | — |

Wiring real Sentry DSN, Firebase auth, RevenueCat keys are operational tasks for the closed beta (T4.11).

---

## 7. GitHub repository

- Owner: `Rman21`
- Repo: `blocksworn` (with N — code namespace)
- Branch protection: PRs auto-mergeable with squash; auto-merge enabled when CI passes
- Recent PRs: #158 (Phase 1) → #180 (music fix) — 23 PRs across all 4 phases

---

## 8. Roman's required action items (operational, not engineering)

| Action | Where | Estimated time | Blocks |
|---|---|---|---|
| Revoke Vercel API token used this session | https://vercel.com/account/tokens | 10s | Security (auto-expires in 1 day) |
| Provision `beta.blocksworm.com` subdomain in Namecheap DNS | Namecheap dashboard | 2 min | T4.11 closed beta |
| Add `beta.blocksworm.com` to Vercel `blocksworn-game` project | Vercel dashboard | 1 min | T4.11 closed beta |
| Create `#blocksworn-beta` Discord channel | Discord server | 5 min | T4.11 tester onboarding |
| Seed Chia testnet wallet (treasury) | Sage Wallet | 10 min | T4.11 + T4.12 mint flow |
| Configure Sentry DSN in Vercel env vars | Vercel project Settings → Environment | 2 min | Error tracking for beta |
| Configure RevenueCat production keys in Vercel | Vercel env | 2 min | IAP flow during beta |
| Set up dedicated Chia mainnet RPC + treasury puzzlehash | Pre-launch (T4.12) | 30 min | Production NFT launch |
