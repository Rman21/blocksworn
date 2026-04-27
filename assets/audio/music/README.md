# Music Tracks

Per BLOCKSWORN_AUDIO_SOUND.md §3 + §15.

## Currently shipped (5 tracks · pirate-themed v1)

| File | Context | Mapped to |
|---|---|---|
| `ebunny-pirate-adventure-361663.mp3` | atmospheric / ascending | menu, world map, chapter screen |
| `alex_besss-pirate-ship-battle-433529.mp3` | battle intensity | boss fights |
| `audiodollar-pirate-music-pirate-331490.mp3` | general pirate ambient | tower mode |
| `win.mp3` | triumphant | post-victory cinematic |
| `lose.mp3` | reflective | defeat modal |

Total: ~18 MB. Source: Pixabay Music (verify CC0 / CC-BY licensing on
each track page before commercial release per spec §10.3).

## Routing (in `MUSIC_TRACKS` const, blocksworn_index_fixed.html)

```js
const MUSIC_TRACKS = {
  menu:    'assets/audio/music/ebunny-pirate-adventure-361663.mp3',
  chapter: 'assets/audio/music/ebunny-pirate-adventure-361663.mp3',
  boss:    'assets/audio/music/alex_besss-pirate-ship-battle-433529.mp3',
  tower:   'assets/audio/music/audiodollar-pirate-music-pirate-331490.mp3',
  victory: 'assets/audio/music/win.mp3',
  defeat:  'assets/audio/music/lose.mp3',
};
```

`playContextMusic(context)` is invoked on `showScreen` transitions
(menu/select/shop/dailies/tower/season → 'menu' or 'tower') and at
`startBossBattle` start ('boss').

## Future tracks needed (per spec §3.1 — 12 tracks total)

```
menu-main.mp3          [✓ adventure track in use]
chapter-1.mp3          [✓ adventure track in use]
chapter-2.mp3          [ ] mysterious / sinister
boss-pyredrake.mp3     [✓ battle track in use]
boss-tyrant.mp3        [ ] deep ocean kraken
boss-treant.mp3        [ ] tribal forest spirit
boss-phoenix.mp3       [ ] heroic golden brass
boss-lich.mp3          [ ] dark final boss climax
tower-mode.mp3         [✓ pirate ambient in use]
victory.mp3            [✓ win.mp3]
defeat.mp3             [✓ lose.mp3]
```

## License compliance

All tracks should be CC0 or CC-BY (no SA, no ND, no NC). For CC-BY tracks,
add credits to game's About / Settings → Credits screen per spec §10.4.

## Format

- MP3 192 kbps recommended (128 kbps min)
- 1.5-3 MB per 90-second loop preferred
- Total music budget: ~30 MB across all final tracks

## Sources (per spec §10.1)

1. **Pixabay Music** (pixabay.com/music) — CC0
2. **Incompetech** (Kevin MacLeod) — CC-BY (attribution required)
3. **Bensound** — Free with attribution
4. **Free Music Archive** — varied licenses
5. **ccMixter** — Creative Commons
