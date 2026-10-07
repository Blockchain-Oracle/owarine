# Sound sources

Every effect in `trade/` and `games/` is CC0 (public domain) from Kenney — no attribution required; recorded for
provenance. Re-encoded with `ffmpeg -vn -codec:a libmp3lame -qscale:a 4`. The same files ship on the web under
`web/public/sounds/` (see its `SOURCES.md`, which also covers the older root-level effects). The other files at this
folder's root predate this table and are not covered by it.

## Trading set (`trade/`)

Same encoding, plus `silenceremove=start_periods=1:start_threshold=-50dB` to trim leading silence. Identical
copies ship in `mobile/assets/sounds/trade/`.

| File | Original | Pack |
|---|---|---|
| trade/tap.mp3 | `tick_004.ogg` | Kenney — Interface Sounds (kenney.nl/assets/interface-sounds, CC0) |
| trade/open-up.mp3 | `maximize_004.ogg` | Kenney — Interface Sounds (CC0) |
| trade/open-down.mp3 | `minimize_004.ogg` | Kenney — Interface Sounds (CC0) |
| trade/close-win.mp3 | `handleCoins2.ogg` | Kenney — RPG Audio (kenney.nl/assets/rpg-audio, CC0) |
| trade/close-loss.mp3 | `impactSoft_medium_000.ogg` | Kenney — Impact Sounds (kenney.nl/assets/impact-sounds, CC0) |
| trade/profit-tick.mp3 | `glass_005.ogg` | Kenney — Interface Sounds (CC0) |
| trade/sheet-open.mp3 | `open_002.ogg` | Kenney — Interface Sounds (CC0) |
| trade/sheet-close.mp3 | `close_002.ogg` | Kenney — Interface Sounds (CC0) |
| trade/key.mp3 | `click1.ogg` | Kenney — UI Audio (kenney.nl/assets/ui-audio, CC0) |
| trade/swipe-confirm.mp3 | `card-slide-2.ogg` (first 0.32 s, faded) mixed with `metalLatch.ogg` at +0.24 s | Kenney — Casino Audio (kenney.nl/assets/casino-audio, CC0) + RPG Audio (CC0) |
| trade/success.mp3 | `handleCoins.ogg` | Kenney — RPG Audio (CC0) |
| trade/toggle.mp3 | `toggle_001.ogg` | Kenney — Interface Sounds (CC0) |
| trade/error.mp3 | `error_008.ogg` | Kenney — Interface Sounds (CC0) |

## Games set (`games/`)

Same encoding and silence trim. Identical copies ship in `mobile/assets/sounds/games/`.

| File | Original | Pack |
|---|---|---|
| games/card-deal.mp3 | `card-slide-1.ogg` | Kenney — Casino Audio (kenney.nl/assets/casino-audio, CC0) |
| games/card-flip.mp3 | `card-place-2.ogg` | Kenney — Casino Audio (CC0) |
| games/card-slam.mp3 | `impactWood_heavy_000.ogg` | Kenney — Impact Sounds (kenney.nl/assets/impact-sounds, CC0) |
| games/reel-spin.mp3 | `scroll_001.ogg` | Kenney — Interface Sounds (kenney.nl/assets/interface-sounds, CC0) |
| games/reel-stop.mp3 | `impactMetal_light_000.ogg` | Kenney — Impact Sounds (CC0) |
| games/jackpot.mp3 | `jingles_STEEL07.ogg` | Kenney — Music Jingles (kenney.nl/assets/music-jingles, CC0) |
| games/rocket-launch.mp3 | `thrusterFire_000.ogg` (first 1.6 s, faded) | Kenney — Sci-fi Sounds (kenney.nl/assets/sci-fi-sounds, CC0) |
| games/rocket-boost.mp3 | `thrusterFire_001.ogg` (first 0.8 s, faded) | Kenney — Sci-fi Sounds (CC0) |
| games/target-hit.mp3 | `impactPunch_medium_000.ogg` | Kenney — Impact Sounds (CC0) |
| games/countdown-beep.mp3 | `tone1.ogg` | Kenney — Digital Audio (kenney.nl/assets/digital-audio, CC0) |
| games/countdown-go.mp3 | `highUp.ogg` | Kenney — Digital Audio (CC0) |
| games/coin.mp3 | `chips-collide-1.ogg` | Kenney — Casino Audio (CC0) |
