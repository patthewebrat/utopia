# UTOPIA — The Creation of a Nation (browser remake)

A from-scratch, modern, browser-based remake of **Utopia: The Creation of a Nation**
(Gremlin Graphics, 1991). It is **not** an emulator and **not** a pixel port: the game
logic, names, races, buildings, inventions and gameplay follow the original, while all
art is new, original, high-resolution and procedurally drawn, presented in a smooth
pan-and-zoom isometric view that shows far more of the world than the original 320×200
screen. It runs entirely in the browser — no server, no accounts, no telemetry.

## Running it

```
npm install
npx vite
```

Then open the printed URL (default `http://localhost:5173`). For a production build:
`npx vite build` (output in `dist/`, servable from any static host). Requirements:
Node 20+ and a modern browser.

## Controls

| Input | Action |
|---|---|
| Left click | Select / inspect a tile, building or unit; place buildings in Build mode |
| Right click / `Esc` | Cancel current mode, close panel, return to Info mode |
| Middle- or right-drag, edge scroll, `WASD` / arrow keys | Pan the camera |
| Mouse wheel | Zoom in / out |
| `B` | Build palette |
| `X` | Demolish mode (second click on wreckage clears it) |
| `M` | Colony map screen (overlays: buildings, ore, fuel, radar, movement, power, weapons) |
| `P` / `Space` | Pause / resume |
| `1×` `2×` `5×` HUD buttons | Game speed |
| `F1`–`F6` | The six advisers (Psychiatrist, Administrator, Finance, Engineer, Research, Commander) |
| `1`–`8` | Place/move a tactical marker on the hovered tile |
| `Shift+D` | Clear all markers |
| `H` / `?` | Colony Manual — in-game player guide |

## Saving and loading

Saves are plain **JSON files downloaded to your machine** — there is no server.
Open **Disk / Options → SAVE GAME** to download `utopia-DD.MM.YYYY.json`, and
**LOAD GAME…** (or **LOAD COLONY…** on the title screen) to restore one by uploading
the file. Save files are a versioned envelope (`version`, `scenarioId`, `savedAt`,
`state`) containing the full simulation state; loading runs a strict validator and
field migration, so tampered or truncated files are rejected with a message rather
than crashing. An autosave is also kept in the browser's local storage and offered as
**RESUME** on the title screen. The simulation is deterministic (seeded PRNG), so a
restored save replays identically.

## Architecture

- **`src/types.ts`, `src/data/`** — all game data as typed constant tables: buildings,
  inventions per tech level, the ten enemy races, research, ships, world events and
  global constants. Engineers transcribe `docs/GAME_SPEC.md` here; nothing is re-derived.
- **`src/sim/`** — the headless simulation: `tick.ts` (day/month loop), `economy.ts`
  (food/air/power/stores), `population.ts`, `qol.ts`, `research.ts`, `build.ts`,
  `trade.ts`, `crime.ts`, `spy.ts`, `combat.ts`, `units.ts` (A* movement, ships, tanks),
  `ai.ts` (enemy colony growth and attack waves) and `events.ts`. It has no DOM
  dependencies and is exercised directly by the headless test suite.
- **`src/engine.ts`, `src/mapgen.ts`, `src/rng.ts`, `src/save.ts`** — the public engine
  API (commands + event bus), seeded world generation, the mulberry32 PRNG, and
  versioned save serialization/validation/migration.
- **`src/art/`** — procedural art: every terrain tile, building, unit and effect is
  drawn in code (`terrain.ts`, `buildings.ts`, `units.ts`, `effects.ts`) onto sprite
  canvases using a shared palette (`palette.ts`) and isometric helpers (`iso.ts`).
  No original game assets are included.
- **`src/render/`** — `camera.ts` (pan/zoom/input) and `renderer.ts`, a Canvas 2D
  isometric renderer with depth-sorted sprites, day cycle and overlays, targeting 60 fps.
- **`src/ui/`** — all UI is DOM/CSS (no framework): HUD (`hud.ts`), panel layer with the
  build palette, building info, industry, finance, trade, advisers, spying, map screen
  and disk panels (`ui/panels/`), modals, toasts, adviser portraits and SVG icons.
- **`src/main.ts`, `src/audio.ts`** — bootstrap, title screen, the frame loop tying
  engine → renderer → UI together, and the music/SFX layer (the four original in-game
  tracks in `public/music/` as an optional music layer; SFX are synthesized).
- **`scripts/simtest.ts`** — headless regression suite (`npx tsx scripts/simtest.ts`):
  long-run economy, combat, defeat paths and determinism checks (byte-identical
  24-month seeded replays, save round-trips mid-attack).

## Faithfulness to the 1991 original

Everything player-visible is faithful to the original game: the ten alien races
(Eldorians → Lucratians, in difficulty order 1–10) with their personalities and attack
styles, the full building set (Living Quarters, Hydroponics, Life Support, Space Moss
Converter, Power Station, Solar Panels, Flux Pods, Hospital, Laboratory, Mine, Chemical
Plant, Arms Laboratory, Workshop, Store, Fuel Tank, Command Centre, Security HQ, Sports
Complex, Radar, Laser Turret, Missile Launcher, Tank/Ship Construction Yards, Launch
Pad…), tech levels 1–10 with their inventions (Morgro Hydroponics, Solar Generator,
Land Mines, Plasma Gun, HDX warheads, Compressed Fuel Tanks, Matter Transporter, Tank
Teleport…), the Quality-of-Life goal (80% sustained for 12 months = Bronze, 90% = Gold),
the six advisers, spying, trade, crime/cartels, disease, taxes applying on 1 January,
and confirmed numeric anchors such as the 8,200 GR Chemical Plant, 50 MW Power Station,
12-tile Flux Pod build radius, the 30° / 6-tile laser turret and the 8 tactical markers.

**`docs/GAME_SPEC.md`** is the authoritative numeric design. Where the original's exact
values are confirmed (from the manual and `UTOPIA_EMULATOR_BRIEF.md`) they are used
verbatim; where the original never documented a number (most costs, rates, HP values,
formulas), the spec fills the gap with canonical values invented to be self-consistent
and balanced around the confirmed anchors. Deliberate modernizations: fullscreen
isometric viewport with free pan/zoom instead of the fixed 320×200 window, DOM panels
instead of the Amiga screens, JSON file save/load instead of floppy disks, a seeded
deterministic simulation, and per-scenario briefing text written for this remake.

## Credits

The original **Utopia: The Creation of a Nation** (Celestial Software / Gremlin
Graphics, 1991): original concept by **Graeme Ing** and **Robert Crack**; programming
by **Graeme Ing**; additional concept by Sean Kelly and James North-Hearn; graphics by
"Berni"; music and FX by Imagitech Design Ltd. (composer **Barry Leitch**); manual by
Sean Kelly. This remake is an unofficial fan tribute: all rights to the original game,
its names and its design belong to their respective owners. All code and art here are
new and original; the optional music layer renders the original four in-game tracks.
