# Blocksworm Marketing Site

Next.js 15 + Tailwind site at **blocksworm.com**. Hybrid: marketing landing +
game iframe + (Phase C+) account hub.

## Architecture

```
blocksworm.com (Vercel, this site)
├── /          Marketing home
├── /play      Game iframe → rman21.github.io/blocksworn/...
├── /heroes    Hero gallery
├── /about     About page
└── /leaderboard  Public leaderboard via Firebase

rman21.github.io/blocksworn/  (legacy GitHub Pages)
└── blocksworn_index_fixed.html  (the actual game)

Firebase (existing project: blocksworm)
├── Anonymous Auth
└── Firestore (users / leaderboard / friends / gifts)
```

## Stack

- **Framework**: Next.js 15 + App Router + TypeScript
- **Styling**: Tailwind CSS (custom theme matches game palette)
- **Animation**: Framer Motion (lite usage)
- **Backend**: Firebase SDK (modular v10) — same project as game
- **Hosting**: Vercel (Next.js native)

## Deploy

This site auto-deploys to Vercel from the `/site/` subfolder of
`github.com/Rman21/blocksworn`.

Vercel project settings:
- Root Directory: `site`
- Build Command: `next build` (default)
- Output Directory: `.next` (default)
- Node Version: 20.x

## Local Dev (optional)

```bash
cd site
npm install
npm run dev
```

Open http://localhost:3000.
