# Music Tracks

Per BLOCKSWORN_AUDIO_SOUND.md §3 + §15.

## Currently shipped (12 tracks — full per-chapter + per-boss coverage)

### Top-level / single contexts

| File | Context |
|---|---|
| `ebunny-pirate-adventure-361663.mp3` | menu (Chapter 1 default) |
| `audiodollar-pirate-music-pirate-331490.mp3` | tower / season |
| `win.mp3` | victory cinematic |
| `lose.mp3` | defeat modal |

### Per-chapter map (menu music swaps with currentChapter)

| Chapter | Track |
|---|---|
| 1 — Ashen Dominion | `ebunny-pirate-adventure-361663.mp3` |
| 2 — Bloom of Madness | `chapter 2.mp3` |
| 3 — Veil of Forgotten Gods | `cosmic.mp3` |
| 4 — Court of the Fallen Heavens | `royal.mp3` |
| 5 — Cradle of First Flame | `cosmic.mp3` (placeholder) |

### Per-boss map (boss fight music)

| Boss | Image key | Track |
|---|---|---|
| Pyredrake (dragon) | Boss_1 | `alex_besss-pirate-ship-battle-433529.mp3` |
| Abyssal Tyrant (kraken) | Boss_2 | `kraken boss.mp3` |
| Grovewarden (treant) | Boss_3 | `trent boss.mp3` |
| Solar Phoenix | Boss_4 | `phoenix boss.mp3` |
| Crypt Lich | Boss_5 | `lich boss.mp3` |
| Other bosses (Ch2/Ch3 etc.) | — | falls back to bossDefault (= pirate-ship-battle) |

Total: ~88 MB. Source: Pixabay Music (verify CC0 / CC-BY licensing on
each track page before commercial release per spec §10.3).

## Routing (in `MUSIC_TRACKS` const, blocksworn_index_fixed.html)

```js
const MUSIC_TRACKS = {
  menu:    'assets/audio/music/ebunny-pirate-adventure-361663.mp3',
  tower:   'assets/audio/music/audiodollar-pirate-music-pirate-331490.mp3',
  victory: 'assets/audio/music/win.mp3',
  defeat:  'assets/audio/music/lose.mp3',
  chapter: { 1: ..., 2: ..., 3: ..., 4: ..., 5: ... },
  boss:    { Boss_1: ..., Boss_2: ..., Boss_3: ..., Boss_4: ..., Boss_5: ... },
  bossDefault: 'assets/audio/music/alex_besss-pirate-ship-battle-433529.mp3',
};
```

Resolver `_resolveMusicUrl(context)` picks the right URL based on
currentChapter / currentBoss state. Filenames with spaces are URL-encoded
(`kraken boss.mp3` → `kraken%20boss.mp3`).

`playContextMusic(context)` is invoked on:
- `showScreen` transitions: menu/select/shop/dailies → 'menu' (chapter-aware);
  tower/season → 'tower'
- `startBossBattle` start → 'boss' (per-boss-aware)
- `onBossDefeated` (1200ms after) → 'victory'
- `showDefeatModal` (1200ms after) → 'defeat'

## Music budget warning

Total ~88 MB exceeds spec §13.2 budget of 20-30 MB. HTML5 Audio streams
files (no full-RAM load), so playback is fine. For final ship: consider
re-encoding at 128 kbps to cut ~50% size, or trimming long tracks to
60-90s loops per spec §3.1.

## License compliance

All tracks should be CC0 or CC-BY (no SA, no ND, no NC). For CC-BY tracks,
add credits to game's About / Settings → Credits screen per spec §10.4.

## Format

- MP3 192 kbps recommended (128 kbps min)
- 1.5-3 MB per 90-second loop preferred
- Current files range 1.6 MB - 28.8 MB

## Sources (per spec §10.1)

1. **Pixabay Music** (pixabay.com/music) — CC0
2. **Incompetech** (Kevin MacLeod) — CC-BY (attribution required)
3. **Bensound** — Free with attribution
4. **Free Music Archive** — varied licenses
5. **ccMixter** — Creative Commons
