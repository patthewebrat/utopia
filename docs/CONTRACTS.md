# UTOPIA — Engine Contracts (for renderer / UI / audio / save / integration agents)

The headless engine is complete and tested (`npm run simtest`). **All game mutations go
through `src/engine.ts`** — never poke `state` fields directly from UI code, and never
import from `src/sim/*` (those are engine internals). Reading `state` is free and expected.

File ownership: the engine team owns `src/types.ts`, `src/engine.ts`, `src/events.ts`,
`src/rng.ts`, `src/mapgen.ts`, `src/data/*`, `src/sim/*`, `scripts/simtest.ts`.
`src/main.ts` is a stub — the integration agent replaces it. `src/style.css` + `index.html`
body belong to the UI agent (keep `#world` canvas and `#ui` div ids).

---

## Lifecycle

```ts
import * as engine from './engine';

const state = engine.createGame('quickstart');     // or 'eldorians' … 'lucratians'
// main loop (renderer drives it):
engine.advance(state, dtSeconds);                  // applies speed & pause internally
```

- **1 game day = 1 real second at 1× speed** (`state.speed` ∈ 1|2|5, `state.paused`).
- `engine.setSpeed(state, s)` / `engine.setPaused(state, p)`. Secondary panels must call
  `setPaused(state, true)` on open and restore on close (UI's job).
- `engine.serialize(state)` / `engine.deserialize(json)` — GameState **is** the save file
  (plain JSON, no classes/Maps/functions). Save agent: download string, restore via upload.

## Events (UI subscription)

`src/events.ts` exports the global typed bus `events`. The sim queues events on
`state.pendingEvents`; `engine.advance()` drains and emits them.

```ts
engine.events.on('month',        (e) => …);  // { monthIndex }
engine.events.on('notification', (e) => …);  // { note: Notification }
engine.events.on('invention',    (e) => …);  // { inventionId, techLevel }
engine.events.on('techlevel',    (e) => …);  // { techLevel }
engine.events.on('attack',       (e) => …);  // { waveSize } — wave just spawned
engine.events.on('spyreport',    (e) => …);  // { report: SpyReport }
engine.events.on('medal',        (e) => …);  // { medal: 'bronze'|'gold' }
engine.events.on('gameover',     (e) => …);  // { victory, reason } (victory=true fires
                                             //   when the alien city falls; play continues)
engine.events.on('*', handler)               // everything
// on() returns an unsubscribe function.
```

**Notification shape** (also archived in `state.notifications` for the message panel):
`{ id, monthIndex, totalDays, kind, text, loc }` — `kind` ∈ info|warning|danger|invention|
spy|crime|event|attack|finance|medal|gameover; `loc` is `{x,y}|null` (Running-Man jump target).

## Reading state (renderer)

- Map: `state.mapW` (99) × `state.mapH` (75). Flat arrays indexed `y * state.mapW + x`:
  `terrain` (TerrainType strings), `oreYield`/`fuelYield` (0 = none, 1–9),
  `tileBuilding` (buildingId+1, 0 = empty), `wreckage` (0|1).
  Outer 4 tiles are border (unbuildable). Use `engine.depositVisible(state,x,y,'ore'|'fuel')`
  before drawing deposits; `engine.enemyVisible(state, x, y)` before drawing enemy units.
- Buildings: `state.buildings: BuildingInstance[]` — `{ id, type, x, y, hp, status:
  'scaffold'|'complete', progress, staff, reqStaff, powered, active (CC), facing (turret
  degrees), plasma, tankProgress, shipOrder, padShipId … }`. Defs in
  `engine.BUILDING_DEFS[type]` (name, cost, hp, maxStaff, blurb …).
- Units: `state.units: UnitInstance[]` — `{ id, kind, owner: 'player'|'enemy', x, y
  (fractional tiles), hp, maxHp, fuel (-1 = n/a), mode: 'ground'|'landed'|'hovering'|'flight',
  path, dest, offMap }`. Skip rendering units with `offMap !== null` (they are at the alien
  city). Defs in `engine.UNIT_DEFS[kind]`.
- Effects: `state.effects: EffectFx[]` — **renderer drains this each frame**
  (`state.effects.splice(0)`) and spawns transient visuals:
  `shot {fromX,fromY,toX,toY,by,beam}`, `missile`, `explosion {x,y,big}`, `mine {x,y}`.
- HUD numbers: `state.funds`, `state.stores {food,ore,gems,weapons,techGoods}`,
  `state.fuelStored`, `state.airBank`, `state.podCharge`, `state.power {supply,demand,shedTypes}`,
  `state.shortages {food,air,power,storesFull}` (warning icons), `engine.populationOf(state)`,
  `state.pop` (per class + birthRate), `state.morale.displayed`, `state.qol`,
  `state.crime.index`, `state.research {techLevel, rp, inventions}`, `state.finance`
  (taxRate, pendingTaxRate, grants, lastMonth ledger), `state.trade` (prices/supply/demand/
  retain), `state.spy.reports`, `state.markers` (8 × `{x,y}|null`), `state.stats` (medals,
  battles, deaths), `state.mode` ('playing'|'gameover') + `state.gameOverReason`.
- Date: day `state.dayOfMonth + 1`, `state.month`, `state.year` (DD/MM/YYYY, starts 01/01/2090).
- Scenario metadata: `engine.getScenario(state.scenarioId)` (briefing, biome, race name);
  `engine.SCENARIOS` for the selection screen. `engine.INVENTIONS` for the invention popups.

## Commands (all return `null` on success or an error **string**, unless noted)

```ts
// building
engine.canBuild(state, type, x, y)                    // string|null — use for ghost cursor
engine.build(state, type, x, y)                       // number (building id) | string
engine.demolish(state, x, y)                          // building→wreckage; wreckage→cleared
engine.setRequiredStaff(state, buildingId, n)         // REQD 0..10 (industry staffing)
engine.toggleCommandCentre(state, buildingId)         // make this CC the active one
engine.callSportsEvent(state)                         // opens 1st of next month

// finance / policy
engine.setTax(state, pct)                             // 0–20, locks in next 1 Jan
engine.addGrant(state, 'military'|'civilian'|'intelligence', amount)
engine.setBirthRate(state, 'none'|'low'|'medium'|'high')

// trade
engine.setRetain(state, commodity, pct)               // autotrade retain %
engine.manualTrade(state, { ore: +20, food: -50 })    // +buy / −sell, once per month
engine.dumpCommodity(state, commodity, amount)

// markers & units
engine.placeMarker(state, slot /*0–7*/, x, y)         // re-place same tile = remove
engine.clearMarker(state, slot); engine.clearAllMarkers(state)
engine.orderTank(state, tankId, markerSlot)
engine.orderTanksNearest(state, markerSlot, n, nearUnitId?)  // returns count sent
engine.orderShip(state, shipId, markerSlot, landOnArrival)   // false = hover on arrival
engine.stopUnit(state, unitId)
engine.buildShip(state, yardId, 'fighter'|…)          // ore+weapons consumed up front
engine.explorerBuildPad(state, shipId)                // 2,600 GR, 0.5 mo
engine.useTankTeleport(state, tankId, markerSlot)     // TL10
engine.fireMissile(state, launcherId, x, y)           // launcher tile frees after firing
engine.sendToAlienCity(state, unitId)                 // needs spy.cityLocated + active CC
```

## Game rules cheat-sheet the UI needs

- Build palette: grey out when `canBuild` fails; building requires placement within
  12 tiles (Chebyshev) of a Flux Pod; Space Moss Converter only on moss tiles.
- Tech-gated builds appear after their invention (`state.research.inventions`).
- The monthly tick happens automatically inside `advance` on day 30; listen to `'month'`
  to refresh panels.
- Victory = bronze medal (QoL ≥80 for 12 months, `state.stats.bronzeMedal`); gold at ≥90.
  `state.mode === 'gameover'` ends play (assassination or population 0).
- Audio hooks: subscribe to `'attack'`, `'notification'` (kind 'danger'), `'invention'`,
  `'medal'`, `'gameover'` for stingers; the four original MP3 tracks are the music layer.

## Determinism

All randomness flows through `state.rng` (mulberry32, seeded from scenario/mapSeed).
Identical command sequences against identical saves replay identically — do not call
`Math.random()` anywhere in engine-adjacent code.

---

## Appendix: Save / Load / Autosave (`src/save.ts`)

Save files are a small versioned envelope around the engine state:
`{ version: 1, savedAt: ISOString, scenarioId, state: GameState }` (pretty JSON).
`loadGame`/`restoreAutosave` also accept a bare `engine.serialize()` GameState.

```ts
import { saveGame, loadGame, initAutosave, restoreAutosave, clearAutosave,
         SAVE_VERSION, AUTOSAVE_KEY } from './save';

saveGame(state: GameState): void
// Serialises and triggers a browser download named "utopia-DD.MM.YYYY.json"
// (the colony date, slashes -> dots).

loadGame(file: File): Promise<GameState>
// Reads an uploaded file, validates version + required fields (map layers,
// pop, stores, finance, markers, …). Rejects with a friendly Error
// ("Not a valid UTOPIA save: …") — show err.message to the player.

initAutosave(getState: () => GameState | null): () => void
// Subscribes to the engine 'month' event and writes the current game to
// localStorage under AUTOSAVE_KEY ('utopia-autosave') every game-month.
// Call once after starting/loading a game; returns an unsubscribe function
// (call it before swapping in a new game, then initAutosave again).

restoreAutosave(): GameState | null   // null if absent or corrupt
clearAutosave(): void
```

The returned `GameState` must be fed back through the normal engine flow
(`engine.advance(state, dt)` etc.) — no extra hydration step is needed.

## Appendix: Audio (`src/audio.ts`)

One singleton, music (the four original tracks in `public/music/track1-4.mp3`)
plus a sample-free WebAudio SFX synth. Autoplay policy is handled internally:
calls made before the first user gesture are queued and start on the first
`pointerdown`/`keydown`.

```ts
import { audio, type SfxName, type MusicTrack } from './audio';

audio.playMusic(track: 1|2|3|4, loop = true)   // safe to call immediately
audio.stopMusic()
audio.getCurrentTrack(): MusicTrack | null
audio.playSfx(name: SfxName)
// SfxName = 'ui-click' | 'build-place' | 'construction-complete' |
//           'ship-complete' | 'laser' | 'explosion' | 'alert' |
//           'month-tick' | 'trade'
audio.setMusicEnabled(b) / audio.setSfxEnabled(b)   // toggles
audio.isMusicEnabled() / audio.isSfxEnabled()
audio.setMusicVolume(v 0..1) / audio.setSfxVolume(v 0..1)  // defaults 0.35 / 0.22
```

Suggested event hookups: `'attack'`/danger notification -> `alert`,
`'invention'`/construction-complete notification -> `construction-complete`,
`'month'` -> `month-tick`, build command success -> `build-place`,
trade success -> `trade`, renderer `shot` fx -> `laser`, `explosion` fx ->
`explosion`, ship-completed notification -> `ship-complete`, buttons -> `ui-click`.
